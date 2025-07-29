'use strict';

const _ = require('lodash');
const jwt = require('jsonwebtoken');
const shiroTrie = require('shiro-trie');

const consts = require('./../constants');
const sleep = require('util').promisify(setTimeout);
const forwarded = require('forwarded-for');

function getRemoteIP (req) {
  const address = forwarded(req, req.headers);
  return address.ip;
}

function init (env, ctx) {

  const ipdelaylist = require('./delaylist')(env, ctx);
  const addFailedRequest = ipdelaylist.addFailedRequest;
  const shouldDelayRequest = ipdelaylist.shouldDelayRequest;
  const requestSucceeded = ipdelaylist.requestSucceeded;

  var authorization = {};
  var storage = authorization.storage = require('./storage')(env, ctx);
  var defaultRoles = (env.settings.authDefaultRoles || '').split(/[, :]/);

  /**
   * Loads JWT from request
   * 
   * @param {*} req 
   */
  function extractJWTfromRequest (req) {

    if (req.auth_token) return req.auth_token;

    let token;

    if (req.header('Authorization')) {
      const parts = req.header('Authorization').split(' ');
      if (parts.length === 2 && parts[0] === 'Bearer') {
        token = parts[1];
      }
    }

    if (!token) {
      let accessToken = req.query.token;
      if (!accessToken && req.body) {
        if (_.isArray(req.body) && req.body.length > 0 && req.body[0].token) {
          accessToken = req.body[0].token;
          delete req.body[0].token;
        } else if (req.body.token) {
          accessToken = req.body.token;
          delete req.body.token;
        }
      }

      if (accessToken) {
        // validate and parse the token
        const authed = authorization.authorize(accessToken);
        if (authed && authed.token) {
          token = authed.token;
        }
      }
    }

    if (token) { req.auth_token = token; }

    return token;
  }

  authorization.extractToken = extractJWTfromRequest;

  /**
   * Fetches the API_SECRET from the request
   * 
   * @param {*} req Express request object
   */
  function apiSecretFromRequest (req) {

    if (req.api_secret) return req.api_secret;

    let secret = req.query && req.query.secret ? req.query.secret : req.header('api-secret');

    if (!secret && req.body) {
      // try to get the secret from the body, but don't leave it there
      if (_.isArray(req.body) && req.body.length > 0 && req.body[0].secret) {
        secret = req.body[0].secret;
        delete req.body[0].secret;
      } else if (req.body.secret) {
        secret = req.body.secret;
        delete req.body.secret;
      }
    }

    // store the secret hash on the request since the req may get processed again
    if (secret) { req.api_secret = secret; }
    return secret;
  }

  function authorizeAdminSecret (secret, req) {
    // Check global admin secret first
    if (env.enclave.isApiKey(secret)) {
      return true;
    }
    
    // In multi-tenant mode, check tenant-specific API secret
    if (env.MULTI_TENANT_ENABLED && req && req.tenant) {
      const tenantModel = require('../models/tenant')(env, ctx);
      return tenantModel.validateApiSecret(req.tenant, secret);
    }
    
    return false;
  }

  authorization.seenPermissions = [];

  authorization.expandedPermissions = function expandedPermissions () {
    var permissions = shiroTrie.new();
    permissions.add(authorization.seenPermissions);
    return permissions;
  };

  authorization.resolveWithRequest = function resolveWithRequest (req, callback) {
    const resolveData = {
      api_secret: apiSecretFromRequest(req)
      , token: extractJWTfromRequest(req)
      , ip: getRemoteIP(req)
      , req: req  // Pass the request object for tenant context
    };
    authorization.resolve(resolveData, callback);
  };

  /**
   * Check if the Apache Shiro-style permission object includes the permission.
   * 
   * Returns a boolean true / false depending on if the permission is found.
   * 
   * @param {*} permission Desired permission
   * @param {*} shiros Shiros
   */

  authorization.checkMultiple = function checkMultiple (permission, shiros) {
    var found = _.find(shiros, function checkEach (shiro) {
      return shiro && shiro.check(permission);
    });
    return _.isObject(found);
  };

  /**
   * Resolve an API secret or token and return the permissions associated with
   * the secret / token
   * 
   * @param {*} data 
   * @param {*} callback 
   */
  authorization.resolve = async function resolve (data, callback) {

    if (!data.ip) {
      console.error('Trying to authorize without IP information');
      return callback(null, { shiros: [] });
    }

    data.api_secret = data.api_secret || null;

    if (data.api_secret == 'null') { // TODO find what's sending this anomaly
      data.api_secret = null;
    }

    const requestDelay = shouldDelayRequest(data.ip);

    if (requestDelay) {
      await sleep(requestDelay);
    }

    const authAttempted = (data.api_secret || data.token) ? true : false;
    const defaultShiros = storage.rolesToShiros(defaultRoles);

    // If there is no token or secret, return default permissions
    if (!authAttempted) {
      const result = { shiros: defaultShiros, defaults: true };
      if (callback) { callback(null, result); }
      return result;
    }

    // Check for API_SECRET first as that allows bailing out fast
    // Pass the request object to check tenant-specific secrets
    if (data.api_secret && authorizeAdminSecret(data.api_secret, data.req)) {
      requestSucceeded(data.ip);
      var admin = shiroTrie.new();
      admin.add(['*']);
      const result = { shiros: [admin] };
      if (callback) { callback(null, result); }
      return result;
    }

    // If we reach this point, we must be dealing with a role based token

    let token = null;

    // Tokens have to be well formed JWTs
    try {
      const verified = env.enclave.verifyJWT(data.token);
      token = verified.accessToken;
    } catch (err) {}

    // Check if there's a token in the secret

    if (!token && data.api_secret) {
      if (storage.doesAccessTokenExist(data.api_secret)) {
        token = data.api_secret;
      }
    }

    const defaultResult = { shiros: defaultShiros, defaults: true };

    if (!token) {
      addFailedRequest(data.ip);
      if (callback) { callback(null, defaultResult); }
      return defaultResult;
    }

    var subject = storage.findSubject(token);

    if (!subject) {
      addFailedRequest(data.ip);
      if (callback) { callback(null, defaultResult); }
      return defaultResult;
    }

    var shiros = storage.rolesToShiros(subject.roles);
    authorization.seenPermissions = _.chain(shiros).reduce(function sharesReducer (acc, shiro) {
      return acc.concat(shiro.permissions());
    }, []).uniq().value().sort();

    requestSucceeded(data.ip);
    const result = { shiros: shiros, subject: subject };
    if (callback) { callback(null, result); }
    return result;
  };

  authorization.isPermitted = function isPermitted (permission) {

    function check(req, res, next) {

      // Always check authorization based on request if available
      authorization.resolveWithRequest(req, function checkResult (err, result) {
        
        if (err) {
          console.error('Error resolving authorization:', err);
          return res.sendJSONStatus(res, consts.HTTP_INTERNAL_ERROR, 'Authorization Error', err);
        }

        const permitted = authorization.checkMultiple(permission, result.shiros);

        if (permitted) {
          next();
          return;
        }

        res.sendJSONStatus(res, consts.HTTP_UNAUTHORIZED, 'Unauthorized', 'Invalid/Missing');
      });
    }

    return check;
  };

  authorization.isPermittedAsync = async function isPermittedAsync (permission, req) {
    const remoteIP = getRemoteIP(req);
    var secret = apiSecretFromRequest(req);
    var token = extractJWTfromRequest(req);

    const data = { api_secret: secret, token, ip: remoteIP, req: req };

    const permissions = await authorization.resolve(data);
    const permitted = authorization.checkMultiple(permission, permissions.shiros);

    return permitted;
  };

  /**
   * Generates a JWT based on an access token / authorizes an existing token
   * 
   * @param {*} accessToken token to be used for generating a JWT for the client
   */
  authorization.authorize = function authorize (accessToken) {


    let userToken = accessToken;
    const decodedToken = env.enclave.verifyJWT(accessToken);

    if (decodedToken && decodedToken.accessToken) {
      userToken = decodedToken.accessToken;
    }

    var subject = storage.findSubject(userToken);
    var authorized = null;

    if (subject) {
      const token = env.enclave.signJWT({ accessToken: subject.accessToken });

      const decoded = env.enclave.verifyJWT(token);
      
      if (decoded) {
        authorized = {
          token
          , sub: subject.name
          , permissionGroups: subject.roles.join(' ')
          , iat: decoded.iat
          , exp: decoded.exp
        };
      }
    }

    return authorized;
  };

  authorization.setCache = function setCache (cache) {
    if (cache && cache.entries) {
      ipdelaylist.setCache(cache.entries);
    }
  }

  authorization.getCache = function getCache() {
    return { 
      entries: ipdelaylist.getCache() 
    };
  }

  return authorization;
}

module.exports = init;
'use strict';

const _get = require('lodash/get');
const express = require('express');
const compression = require('compression');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const randomToken = require('random-token');

const path = require('path');
const fs = require('fs');
const ejs = require('ejs');

function resolvePath(filePath) {
  if (fs.existsSync(filePath)) return filePath;
  let p = path.join(__dirname, filePath);
  if (fs.existsSync(p)) return p;
  p = path.join(process.cwd(), filePath);
  if (fs.existsSync(p)) return p;
  return require.resolve(filePath);
}

function create (env, ctx) {
  var app = express();
  var appInfo = env.name + ' ' + env.version;
  app.set('title', appInfo);
  app.enable('trust proxy');
  
  // Security headers
  var insecureUseHttp = env.insecureUseHttp;
  var secureHstsHeader = env.secureHstsHeader;
  
  if (!insecureUseHttp) {
    console.info('Redirecting http traffic to https because INSECURE_USE_HTTP=', insecureUseHttp);
    app.use((req, res, next) => {
      if (req.header('x-forwarded-proto') === 'https' || req.secure) {
        next();
      } else {
        res.redirect(307, `https://${req.header('host')}${req.url}`);
      }
    });
    
    if (secureHstsHeader) {
      const enableCSP = env.secureCsp ? true : false;
      let cspPolicy = false;
      
      if (enableCSP) {
        var secureCspReportOnly = env.secureCspReportOnly;
        if (secureCspReportOnly) {
          console.info('Enabled SECURE_CSP (Content Security Policy header). Not enforcing. Report only.');
        } else {
          console.info('Enabled SECURE_CSP (Content Security Policy header). Enforcing.');
        }

        let frameAncestors = ["'self'"];
        for (let i = 0; i <= 8; i++) {
          let u = env.settings['frameUrl' + i];
          if (u) {
            frameAncestors.push(u);
          }
        }

        cspPolicy = {
          directives: {
            defaultSrc: ["'self'"]
            , styleSrc: ["'self'", 'https://fonts.googleapis.com/', 'https://fonts.gstatic.com/', "'unsafe-inline'"]
            , scriptSrc: ["'self'", "'unsafe-inline'"]
            , fontSrc: ["'self'", 'https://fonts.googleapis.com/', 'https://fonts.gstatic.com/', 'data:']
            , imgSrc: ["'self'", 'data:']
            , objectSrc: ["'none'"]
            , reportUri: '/report-violation'
            , baseUri: ["'none'"]
            , formAction: ["'self'"]
            , connectSrc: ["'self'", "ws:", "wss:", 'https://fonts.googleapis.com/', 'https://fonts.gstatic.com/']
            , frameSrc: ["'self'"]
            , frameAncestors: frameAncestors
          }
          , reportOnly: secureCspReportOnly
        };
      }

      console.info('Enabled SECURE_HSTS_HEADER (HTTP Strict Transport Security)');
      const helmet = require('helmet');
      var includeSubDomainsValue = env.secureHstsHeaderIncludeSubdomains;
      var preloadValue = env.secureHstsHeaderPreload;
      
      app.use(helmet({
        hsts: {
          maxAge: 31536000
          , includeSubDomains: includeSubDomainsValue
          , preload: preloadValue
        }
        , frameguard: false
        , contentSecurityPolicy: cspPolicy
      }));

      if (enableCSP) {
        app.use(helmet.referrerPolicy({ policy: 'no-referrer' }));
        app.use(bodyParser.json({ type: ['json', 'application/csp-report'] }));
        app.post('/report-violation', (req, res) => {
          if (req.body) {
            console.log('CSP Violation: ', req.body);
          } else {
            console.log('CSP Violation: No data received!');
          }
          res.status(204).end();
        });
      }
    }
  } else {
    console.info('Security settings: INSECURE_USE_HTTP=', insecureUseHttp, ', SECURE_HSTS_HEADER=', secureHstsHeader);
  }

  app.set('view engine', 'ejs');
  app.engine('html', require('ejs').renderFile);
  app.set("views", resolvePath('/views'));

  let cacheBuster = process.env.NODE_ENV == 'development' ? 'developmentMode': randomToken(16);
  app.locals.cachebuster = cacheBuster;
  app.locals.bundle = '/bundle';
  app.locals.mode = 'production';
  let lastModified = new Date();

  app.get("/robots.txt", (req, res) => {
    res.setHeader('Content-Type', 'text/plain');
    res.send(['User-agent: *','Disallow: /'].join('\n'));
  });

  const swcontent = fs.readFileSync(resolvePath('/views/service-worker.js'), { encoding: 'utf-8' });
  app.get("/sw.js", (req, res) => {
    res.setHeader('Content-Type', 'application/javascript');
    if (process.env.NODE_ENV !== 'development') {
      res.setHeader('Last-Modified', lastModified.toUTCString());
    }
    res.send(ejs.render(swcontent, { locals: app.locals} ));
  });

  // Static files
  var maxAge = 7 * 24 * 60 * 60 * 1000;
  if (process.env.NODE_ENV === 'development') {
    maxAge = 1;
    console.log('Development environment detected, setting static file cache age to 1 second');
  }

  var staticFiles = express.static(resolvePath(env.static_files), { maxAge });
  app.use(staticFiles);
  
  // Try to serve bundles from webpack output first, fallback to static
  const projectRoot = path.resolve(__dirname, '../..');
  const webpackOutputPath = path.join(projectRoot, 'node_modules/.cache/_ns_cache/public');
  const staticBundlePath = resolvePath('/static/bundle');
  
  app.use('/bundle', (req, res, next) => {
    // Try webpack output first
    express.static(webpackOutputPath, { maxAge })(req, res, (err) => {
      if (err || res.headersSent) {
        return next(err);
      }
      // Fallback to static bundle
      express.static(staticBundlePath, { maxAge })(req, res, next);
    });
  });
  
  app.use('/translations', express.static(resolvePath('/translations'), { maxAge }));

  // Handle boot errors
  if (ctx.bootErrors && ctx.bootErrors.length > 0) {
    const bootErrorView = require('./booterror')(env, ctx);
    bootErrorView.setLocals(app.locals);
    app.get('*', bootErrorView);
    return app;
  }

  // CORS support
  if (env.settings.isEnabled('cors')) {
    var allowOrigin = _get(env, 'extendedSettings.cors.allowOrigin') || '*';
    console.info('Enabled CORS, allow-origin:', allowOrigin);
    app.use(function allowCrossDomain (req, res, next) {
      res.header('Access-Control-Allow-Origin', allowOrigin);
      res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With, X-Tenant-ID, X-Tenant-Subdomain');

      if ('OPTIONS' === req.method) {
        res.send(200);
      } else {
        next();
      }
    });
  }

  // Multi-tenant middleware
  const tenantResolver = require('../middleware/tenantResolver')(env, ctx);
  const tenantDataloader = require('../middleware/tenantDataloader')(env, ctx);
  const auth = require('../middleware/auth')(env, ctx);

  // Apply compression
  app.use(compression({
    filter: function shouldCompress (req, res) {
      return compression.filter(req, res);
    }
  }));
  
  // Parse cookies
  app.use(cookieParser());

  // Authentication routes (public, no tenant required for registration)
  app.use('/api/auth', require('../api/auth/')(env, ctx));
  app.use('/api/tenants', require('../api/tenants/')(env, ctx));
  app.use('/api/register', require('../api/tenants/register-enhanced')(env, ctx));
  app.use('/api/tenant-settings', require('../api/tenant-settings')(env, ctx));

  // Login page (public)
  app.get('/login', (req, res) => {
    res.render('login.html', { locals: app.locals });
  });
  
  // Registration page (public)
  app.get('/register', (req, res) => {
    res.render('register.html', { locals: app.locals });
  });

  // Simple import API (temporary) - before tenant resolver for simplicity
  app.use('/api/simple-import', bodyParser.json({ limit: 1048576 * 50 }), require('../api/import/simple')(app, {}, ctx, env));

  // Apply tenant resolver for all other routes
  app.use(tenantResolver);
  
  // Load tenant data after resolver
  app.use(tenantDataloader);

  // Check authentication for non-public routes
  app.use((req, res, next) => {
    // Skip auth for public pages and API status
    const publicPaths = ['/api/v1/status', '/api/v1/echo', '/manifest.json', '/sw.js', '/login', '/register', '/api/auth', '/api/register', '/api/simple-import'];
    if (publicPaths.some(path => req.path.startsWith(path))) {
      return next();
    }

    // For API routes, ALWAYS use server-side JWT auth
    // This is critical for device integration
    if (req.path.startsWith('/api/')) {
      return auth.authenticate(req, res, next);
    }

    // For web pages, use a hybrid approach:
    // 1. Check for auth cookie (for server-side rendering)
    // 2. If no cookie, the client-side will handle redirect
    if (req.cookies && req.cookies.nightscout_token) {
      // Verify the cookie token
      const token = req.cookies.nightscout_token;
      try {
        const decoded = auth.verifyToken(token);
        req.user = decoded;
        next();
      } catch (err) {
        // Invalid token, clear cookie and continue
        res.clearCookie('nightscout_token');
        next();
      }
    } else {
      // No server-side auth, let client handle it
      next();
    }
  });

  // API routes with multi-tenant support
  // Create middleware that dynamically creates API handlers with tenant context
  function createTenantAwareApiMiddleware(apiModuleFactory, apiArgs = []) {
    return function(req, res, next) {
      // Use tenant-specific context if available, otherwise use global context
      const requestCtx = req.ctx || ctx;
      
      // Ensure requestCtx has all required properties from global ctx
      if (!requestCtx.wares && ctx.wares) {
        requestCtx.wares = ctx.wares;
      }
      if (!requestCtx.authorization && ctx.authorization) {
        requestCtx.authorization = ctx.authorization;
      }
      if (!requestCtx.ddata && ctx.ddata) {
        requestCtx.ddata = ctx.ddata;
      }
      if (!requestCtx.plugins && ctx.plugins) {
        requestCtx.plugins = ctx.plugins;
      }
      
      // Special handling for API v1 which needs wares parameter
      if (apiModuleFactory === api && !apiArgs.includes(requestCtx.wares)) {
        apiArgs = [requestCtx.wares, ...apiArgs];
      }
      
      // Create the API module with the appropriate context
      const apiModule = typeof apiModuleFactory === 'function' 
        ? apiModuleFactory(env, requestCtx, ...apiArgs)
        : apiModuleFactory;
      
      // Execute the API module
      apiModule(req, res, next);
    };
  }
  
  // Mount API routes with tenant-aware middleware
  const apiRoot = require('../api/root');
  const api = require('../api/');
  const api2 = require('../api2/');
  const api3 = require('../api3/');

  // App pages configuration
  var appPages = {
    "/": {
      file: "index.html"
      , type: "index"
    }
    , "/admin": {
      file: "adminindex.html"
      , title: 'Admin Tools'
      , type: 'admin'
    }
    , "/food": {
      file: "foodindex.html"
      , title: 'Food Editor'
      , type: 'food'
    }
    , "/profile": {
      file: "profileindex.html"
      , title: 'Profile Editor'
      , type: 'profile'
    }
    , "/report": {
      file: "reportindex.html"
      , title: 'Nightscout Reporting'
      , type: 'report'
    }
    , "/clock.html": {
      file: "clock.html"
      , title: 'Nightscout Clock'
      , type: 'clock'
    }
    , "/bgclock.html": {
      file: "bgclock.html"
      , title: 'Nightscout BG Clock'
      , type: 'bgclock'
    }
  };

  // Setup app pages with multi-tenant context
  Object.keys(appPages).forEach(function(page) {
    app.get(page, (req, res) => {
      var renderPage = appPages[page];
      var locals = app.locals;
      
      // Add tenant info to locals
      locals.tenant = req.tenant;
      locals.user = req.user;
      
      res.render(renderPage.file, {
        locals: locals,
        title: renderPage.title ? renderPage.title : '',
        type: renderPage.type ? renderPage.type : '',
        settings: env.settings
      });
    });
  });

  // Web authentication middleware that actually blocks access
  const requireWebAuth = (req, res, next) => {
    if (req.cookies && req.cookies.nightscout_token) {
      const token = req.cookies.nightscout_token;
      try {
        const decoded = auth.verifyToken(token);
        req.user = decoded;
        next();
      } catch (err) {
        // Invalid token, redirect to login
        res.clearCookie('nightscout_token');
        return res.redirect('/login?redirect=' + encodeURIComponent(req.originalUrl));
      }
    } else {
      // No auth, redirect to login
      return res.redirect('/login?redirect=' + encodeURIComponent(req.originalUrl));
    }
  };

  // Clock views with multi-tenant support
  const clockviews = require('./clocks.js');
  app.use("/clock", tenantResolver, requireWebAuth, (req, res, next) => {
    // Create locals with tenant context
    const tenantLocals = Object.assign({}, app.locals, {
      tenant: req.tenant,
      user: req.user
    });
    
    // Initialize clock views with tenant-aware locals
    const clockApp = clockviews();
    clockApp.setLocals(tenantLocals);
    
    // Handle the request
    clockApp(req, res, next);
  });

  // Simple clock route that works with multi-tenant
  const simpleClock = require('./simple-clock.js');
  app.use("/sclock", tenantResolver, requireWebAuth, tenantDataloader, simpleClock());

  // Simple food editor route that works with multi-tenant
  const simpleFood = require('./simple-food.js');
  app.use("/sfood", bodyParser.json(), tenantResolver, requireWebAuth, tenantDataloader, simpleFood());
  
  // Simple profile editor route that works with multi-tenant
  const simpleProfile = require('./simple-profile.js');
  app.use("/sprofile", bodyParser.json(), tenantResolver, requireWebAuth, tenantDataloader, simpleProfile());

  // API routes
  const swaggerPath = path.join(__dirname, '../../node_modules/swagger-ui-dist');
  app.use('/api-docs', express.static(swaggerPath, { maxAge }));
  app.use('/swagger-ui-dist', (req, res) => {
    res.redirect(307, '/api-docs');
  });

  app.use('/api/v1', bodyParser.json({ limit: 1048576 * 50 }), createTenantAwareApiMiddleware(api));
  app.use('/api/v2', bodyParser.json({ limit: 1048576 * 50 }), createTenantAwareApiMiddleware(api2, [api]));
  app.use('/api/v3', createTenantAwareApiMiddleware(api3));
  app.use('/api', bodyParser.json({ limit: 1048576 * 50 }), createTenantAwareApiMiddleware(api));
  
  // Import API for data migration
  app.use('/api/import', bodyParser.json({ limit: 1048576 * 50 }), createTenantAwareApiMiddleware(require('../api/import')));

  // Pebble API
  app.get('/pebble', function(req, res, next) {
    const requestCtx = req.ctx || ctx;
    requestCtx.pebble(req, res, next);
  });

  // Error handling
  app.use(function(err, req, res, next) {
    console.error('Global error handler:', err);
    res.status(500).json({
      status: 500,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? err.message : 'An error occurred'
    });
  });

  return app;
}

module.exports = create;
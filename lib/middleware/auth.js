'use strict';

const jwt = require('jsonwebtoken');
const _ = require('lodash');

function init(env, ctx) {
  const userModel = require('../models/user')(env, ctx);
  const tenantModel = require('../models/tenant')(env, ctx);
  
  // JWT configuration
  const JWT_SECRET = env.JWT_SECRET || env.api_secret || 'nightscout-multitenant-secret';
  const JWT_EXPIRES_IN = env.JWT_EXPIRES_IN || '24h';
  const JWT_REFRESH_EXPIRES_IN = env.JWT_REFRESH_EXPIRES_IN || '7d';
  
  const auth = {};
  
  // Generate JWT token
  auth.generateToken = function(user, tenant) {
    const payload = {
      userId: user.userId,
      tenantId: user.tenantId,
      email: user.email,
      role: user.role,
      subdomain: tenant.subdomain,
      permissions: user.permissions || []
    };
    
    const accessToken = jwt.sign(payload, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
      issuer: 'nightscout-multitenant',
      subject: user.userId
    });
    
    const refreshToken = jwt.sign(
      { userId: user.userId, type: 'refresh' },
      JWT_SECRET,
      { expiresIn: JWT_REFRESH_EXPIRES_IN }
    );
    
    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: JWT_EXPIRES_IN
    };
  };
  
  // Verify JWT token
  auth.verifyToken = function(token) {
    try {
      return jwt.verify(token, JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        throw new Error('Token expired');
      } else if (err.name === 'JsonWebTokenError') {
        throw new Error('Invalid token');
      }
      throw err;
    }
  };
  
  // Extract token from request
  auth.extractToken = function(req) {
    // Check Authorization header
    const authHeader = req.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }
    
    // Check query parameter (for WebSocket connections)
    if (req.query.token) {
      return req.query.token;
    }
    
    // Check cookie (if enabled)
    if (env.AUTH_ENABLE_COOKIES === 'true' && req.cookies && req.cookies.auth_token) {
      return req.cookies.auth_token;
    }
    
    return null;
  };
  
  // Authentication middleware
  auth.authenticate = async function(req, res, next) {
    try {
      const token = auth.extractToken(req);
      
      if (!token) {
        // Check if this is a public endpoint
        if (isPublicEndpoint(req.path)) {
          return next();
        }
        
        // For compatibility with existing Nightscout, check API_SECRET
        if (env.ENABLE_API_SECRET_FALLBACK !== 'false') {
          const legacyAuth = await checkLegacyAuth(req);
          if (legacyAuth) {
            req.user = legacyAuth;
            return next();
          }
        }
        
        return res.status(401).json({
          status: 401,
          message: 'Authentication required',
          error: 'No authentication token provided'
        });
      }
      
      // Verify token
      const decoded = auth.verifyToken(token);
      
      // Load full user data
      const user = await userModel.findById(decoded.userId);
      if (!user || !user.isActive) {
        return res.status(401).json({
          status: 401,
          message: 'Invalid user',
          error: 'User not found or inactive'
        });
      }
      
      // Verify tenant match
      if (req.tenant && user.tenantId !== req.tenant.tenantId) {
        return res.status(403).json({
          status: 403,
          message: 'Access denied',
          error: 'User does not belong to this tenant'
        });
      }
      
      // Attach user to request
      req.user = user;
      req.auth = decoded;
      
      next();
    } catch (err) {
      console.error('Authentication error:', err);
      
      if (err.message === 'Token expired') {
        return res.status(401).json({
          status: 401,
          message: 'Token expired',
          error: 'Please refresh your authentication token'
        });
      }
      
      res.status(401).json({
        status: 401,
        message: 'Authentication failed',
        error: err.message
      });
    }
  };
  
  // Authorization middleware - check roles
  auth.authorize = function(...allowedRoles) {
    return function(req, res, next) {
      if (!req.user) {
        return res.status(401).json({
          status: 401,
          message: 'Authentication required'
        });
      }
      
      if (!allowedRoles.includes(req.user.role)) {
        return res.status(403).json({
          status: 403,
          message: 'Insufficient permissions',
          error: `Role '${req.user.role}' not allowed. Required: ${allowedRoles.join(', ')}`
        });
      }
      
      next();
    };
  };
  
  // Permission-based authorization
  auth.requirePermission = function(permission) {
    return function(req, res, next) {
      if (!req.user) {
        return res.status(401).json({
          status: 401,
          message: 'Authentication required'
        });
      }
      
      if (!userModel.hasPermission(req.user, permission)) {
        return res.status(403).json({
          status: 403,
          message: 'Insufficient permissions',
          error: `Permission '${permission}' required`
        });
      }
      
      next();
    };
  };
  
  // Refresh token endpoint handler
  auth.refreshToken = async function(req, res) {
    try {
      const refreshToken = req.body.refreshToken;
      if (!refreshToken) {
        return res.status(400).json({
          status: 400,
          message: 'Refresh token required'
        });
      }
      
      const decoded = auth.verifyToken(refreshToken);
      if (decoded.type !== 'refresh') {
        return res.status(400).json({
          status: 400,
          message: 'Invalid refresh token'
        });
      }
      
      const user = await userModel.findById(decoded.userId);
      if (!user || !user.isActive) {
        return res.status(401).json({
          status: 401,
          message: 'Invalid user'
        });
      }
      
      const tenant = await tenantModel.findById(user.tenantId);
      if (!tenant || !tenant.isActive) {
        return res.status(401).json({
          status: 401,
          message: 'Invalid tenant'
        });
      }
      
      const tokens = auth.generateToken(user, tenant);
      res.json(tokens);
    } catch (err) {
      res.status(401).json({
        status: 401,
        message: 'Token refresh failed',
        error: err.message
      });
    }
  };
  
  // Check if endpoint is public
  function isPublicEndpoint(path) {
    const publicPaths = [
      '/api/v1/status',
      '/api/auth/login',
      '/api/auth/register',
      '/api/auth/forgot-password',
      '/api/auth/reset-password'
    ];
    
    return publicPaths.some(p => path.startsWith(p));
  }
  
  // Legacy API_SECRET authentication for compatibility
  async function checkLegacyAuth(req) {
    const apiSecret = req.query.secret || req.get('api-secret');
    if (!apiSecret) return null;
    
    // Check if it matches the master API secret
    if (env.enclave && env.enclave.isApiKey(apiSecret)) {
      // Create a system user representation
      return {
        userId: 'system',
        tenantId: req.tenant ? req.tenant.tenantId : 'system',
        role: 'admin',
        email: 'system@nightscout',
        isSystem: true,
        permissions: ['*']
      };
    }
    
    // Check if it matches tenant-specific API secret
    if (req.tenant) {
      const tenantModel = require('../models/tenant')(env, ctx);
      if (tenantModel.validateApiSecret(req.tenant, apiSecret)) {
        // Create a tenant API user representation
        return {
          userId: 'tenant-api',
          tenantId: req.tenant.tenantId,
          role: 'admin',
          email: `api@${req.tenant.subdomain}`,
          isSystem: true,
          isTenantApi: true,
          permissions: ['*']
        };
      }
    }
    
    return null;
  }
  
  // Login endpoint handler
  auth.login = async function(req, res) {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({
          status: 400,
          message: 'Email and password required'
        });
      }
      
      if (!req.tenant) {
        return res.status(400).json({
          status: 400,
          message: 'Tenant context required'
        });
      }
      
      const user = await userModel.authenticate(req.tenant.tenantId, email, password);
      if (!user) {
        return res.status(401).json({
          status: 401,
          message: 'Invalid credentials'
        });
      }
      
      const tokens = auth.generateToken(user, req.tenant);
      
      res.json({
        ...tokens,
        user: {
          userId: user.userId,
          email: user.email,
          role: user.role,
          profile: user.profile
        }
      });
    } catch (err) {
      console.error('Login error:', err);
      res.status(500).json({
        status: 500,
        message: 'Login failed',
        error: err.message
      });
    }
  };
  
  // Logout endpoint handler (mainly for token blacklisting if implemented)
  auth.logout = async function(req, res) {
    // In a production system, you might want to blacklist the token here
    res.json({
      status: 200,
      message: 'Logged out successfully'
    });
  };
  
  return auth;
}

module.exports = init;
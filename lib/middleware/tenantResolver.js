'use strict';

const _ = require('lodash');

function init(env, ctx) {
  const tenantModel = require('../models/tenant')(env, ctx);
  const connectionManager = require('../utils/connectionManager')(env);
  
  // Extract tenant from request
  function extractTenantIdentifier(req) {
    // Method 1: Subdomain extraction (preferred)
    if (env.TENANT_SUBDOMAIN_ENABLED !== 'false') {
      const host = req.get('host') || '';
      const subdomain = extractSubdomain(host);
      if (subdomain) {
        return { type: 'subdomain', value: subdomain };
      }
    }
    
    // Method 2: Header-based (for API clients)
    const tenantHeader = req.get('X-Tenant-ID') || req.get('X-Tenant-Subdomain');
    if (tenantHeader) {
      return { type: 'header', value: tenantHeader };
    }
    
    // Method 3: Query parameter (for testing)
    if (req.query.tenant) {
      return { type: 'query', value: req.query.tenant };
    }
    
    // Method 4: Default tenant (for single-tenant mode compatibility)
    if (env.DEFAULT_TENANT) {
      return { type: 'default', value: env.DEFAULT_TENANT };
    }
    
    return null;
  }
  
  // Extract subdomain from host
  function extractSubdomain(host) {
    if (!host) return null;
    
    // Remove port if present
    const hostname = host.split(':')[0];
    
    // Get base domain from environment or use default
    const baseDomain = env.BASE_DOMAIN || 'localhost';
    
    // Handle localhost specially for development
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return null;
    }
    
    // Extract subdomain
    const parts = hostname.split('.');
    const baseParts = baseDomain.split('.');
    
    if (parts.length > baseParts.length) {
      const subdomainParts = parts.slice(0, parts.length - baseParts.length);
      return subdomainParts.join('.');
    }
    
    return null;
  }
  
  // Middleware function
  async function tenantResolver(req, res, next) {
    try {
      // Skip tenant resolution for certain paths
      const skipPaths = ['/api/v1/status', '/api/v1/verifyauth', '/api/tenants/register'];
      if (skipPaths.some(path => req.path.startsWith(path))) {
        return next();
      }
      
      // Extract tenant identifier
      const identifier = extractTenantIdentifier(req);
      
      if (!identifier) {
        // No tenant identifier found
        return res.status(400).json({
          status: 400,
          message: 'Tenant identification required',
          error: 'No tenant identifier found in request'
        });
      }
      
      // Find tenant
      let tenant;
      if (identifier.type === 'subdomain' || identifier.type === 'default') {
        tenant = await tenantModel.findBySubdomain(identifier.value);
      } else {
        // For header/query, try subdomain first, then tenant ID
        tenant = await tenantModel.findBySubdomain(identifier.value);
        if (!tenant) {
          tenant = await tenantModel.findById(identifier.value);
        }
      }
      
      if (!tenant) {
        return res.status(404).json({
          status: 404,
          message: 'Tenant not found',
          error: `No active tenant found for: ${identifier.value}`
        });
      }
      
      // Get tenant database connection
      const tenantDb = await connectionManager.getTenantDb(tenant);
      
      // Attach tenant info to request
      req.tenant = tenant;
      req.tenantDb = tenantDb;
      
      // Create a request-specific context with tenant database
      // This avoids race conditions between concurrent requests
      req.ctx = Object.create(ctx);
      req.ctx.store = {
        db: tenantDb,
        collection: function(name) {
          return tenantDb.collection(name);
        },
        // Keep original master connection available
        master: ctx.store
      };
      
      // Also create tenant-aware data access layers
      // These will use the tenant-specific store
      const createTenantAware = (module) => {
        if (typeof module === 'function') {
          return module(env, req.ctx);
        }
        return module;
      };
      
      // Initialize tenant-specific data modules
      req.ctx.entries = createTenantAware(require('../server/entries'));
      req.ctx.treatments = createTenantAware(require('../server/treatments'));
      req.ctx.devicestatus = createTenantAware(require('../server/devicestatus'));
      req.ctx.profile = createTenantAware(require('../server/profile'));
      req.ctx.food = createTenantAware(require('../server/food'));
      req.ctx.activity = createTenantAware(require('../server/activity'));
      
      // Log tenant access
      console.log(`Request for tenant: ${tenant.subdomain} (${tenant.tenantId})`);
      
      next();
    } catch (err) {
      console.error('Tenant resolution error:', err);
      res.status(500).json({
        status: 500,
        message: 'Tenant resolution failed',
        error: err.message
      });
    }
  }
  
  // Helper to check if request is for a tenant admin
  tenantResolver.isTenantAdmin = function(req) {
    return req.user && req.user.role === 'admin' && req.user.tenantId === req.tenant.tenantId;
  };
  
  // Helper to validate tenant access
  tenantResolver.validateAccess = function(req, res, next) {
    if (!req.tenant) {
      return res.status(400).json({
        status: 400,
        message: 'No tenant context'
      });
    }
    
    if (!req.user) {
      return res.status(401).json({
        status: 401,
        message: 'Authentication required'
      });
    }
    
    if (req.user.tenantId !== req.tenant.tenantId) {
      return res.status(403).json({
        status: 403,
        message: 'Access denied',
        error: 'User does not belong to this tenant'
      });
    }
    
    next();
  };
  
  return tenantResolver;
}

module.exports = init;
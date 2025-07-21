'use strict';

const _ = require('lodash');

function init(env, ctx) {
  const dataloader = require('../data/dataloader');
  const sandbox = require('../sandbox')();
  
  // Middleware to ensure tenant data is loaded
  async function tenantDataloader(req, res, next) {
    try {
      // Skip if no tenant context
      if (!req.ctx || !req.tenant) {
        return next();
      }
      
      // Skip for certain paths that don't need data
      const skipPaths = ['/api/auth', '/api/tenants', '/api/register'];
      if (skipPaths.some(path => req.path.startsWith(path))) {
        return next();
      }
      
      // Initialize cache for this tenant if not already done
      if (!req.ctx.cache) {
        req.ctx.cache = require('../server/cache')(env, req.ctx);
      }
      
      // Initialize dataloader for this tenant if not already done
      if (!req.ctx.dataloader) {
        req.ctx.dataloader = dataloader(env, req.ctx);
      }
      
      // Initialize ddata if not already done
      if (!req.ctx.ddata) {
        req.ctx.ddata = require('../data/ddata')();
      }
      
      // Load data for this tenant
      await new Promise((resolve, reject) => {
        req.ctx.dataloader.update(req.ctx.ddata, { lastUpdated: Date.now() }, (err) => {
          if (err) {
            console.error('Error loading tenant data:', err);
            reject(err);
          } else {
            resolve();
          }
        });
      });
      
      // Initialize plugins if not already done
      if (!req.ctx.plugins) {
        // Get tenant settings if available
        const tenantSettings = req.ctx.settings || env.settings;
        
        // Ensure required context objects exist
        if (!req.ctx.levels) {
          req.ctx.levels = ctx.levels || require('../levels');
        }
        if (!req.ctx.moment) {
          req.ctx.moment = ctx.moment || require('moment');
        }
        
        req.ctx.plugins = require('../plugins')({
          settings: tenantSettings,
          language: req.ctx.language || ctx.language,
          levels: req.ctx.levels,
          moment: req.ctx.moment
        }).registerServerDefaults();
      }
      
      // Create env object with tenant settings for sandbox
      const tenantEnv = Object.assign({}, env, {
        settings: req.ctx.settings || env.settings
      });
      
      // Create sandbox with loaded data
      const sbx = sandbox.serverInit(tenantEnv, req.ctx);
      
      // Debug: Check if dbstats are in sbx.data
      console.log(`Sandbox data.dbstats:`, sbx.data.dbstats);
      console.log(`Sandbox settings.enable:`, sbx.settings.enable);
      console.log(`Available plugins:`, req.ctx.plugins && req.ctx.plugins.plugins ? Object.keys(req.ctx.plugins.plugins) : 'No plugins loaded');
      
      // Set properties from plugins
      req.ctx.plugins.setProperties(sbx);
      
      // Ensure properties object exists
      if (!sbx.properties) {
        sbx.properties = {};
      }
      
      // Store sandbox in context
      req.ctx.sbx = sbx;
      
      // Initialize properties endpoint with tenant context
      if (!req.ctx.properties) {
        req.ctx.properties = require('../api2/properties')(env, req.ctx);
      }
      
      console.log(`Data loaded for tenant ${req.tenant.subdomain}, dbstats:`, req.ctx.ddata.dbstats);
      console.log(`Sandbox properties dbsize:`, req.ctx.sbx.properties.dbsize);
      console.log(`All sandbox properties:`, Object.keys(req.ctx.sbx.properties));
      
      next();
    } catch (err) {
      console.error('Tenant dataloader error:', err);
      res.status(500).json({
        status: 500,
        message: 'Failed to load tenant data',
        error: err.message
      });
    }
  }
  
  return tenantDataloader;
}

module.exports = init;
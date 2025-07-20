'use strict';

function configure(app, env, ctx) {
  const express = require('express');
  const api = express.Router();
  const connectionManager = require('../utils/connectionManager')(env);
  
  // Middleware to get tenant context
  async function getTenantContext(req, res, next) {
    try {
      // Get tenant from subdomain or token
      let tenantId;
      
      if (req.user && req.user.tenantId) {
        tenantId = req.user.tenantId;
      } else {
        const host = req.get('host');
        const subdomain = host.split('.')[0];
        const TenantModel = require('../models/tenant')(env, ctx);
        const tenant = await TenantModel.findOne({ subdomain: subdomain });
        if (tenant) {
          tenantId = tenant.tenantId;
        }
      }
      
      if (!tenantId) {
        return res.status(400).json({ error: 'Tenant not found' });
      }
      
      // Get tenant database
      const TenantModel = require('../models/tenant')(env, ctx);
      const tenant = await TenantModel.findById(tenantId);
      if (!tenant || !tenant.isActive) {
        return res.status(404).json({ error: 'Tenant not found or inactive' });
      }
      
      const tenantDb = await connectionManager.getTenantDb(tenant);
      
      // Create tenant context
      req.tenantCtx = {
        tenant: tenant,
        tenantDb: tenantDb,
        store: {
          db: tenantDb,
          collection: function(name) {
            return tenantDb.collection(name);
          }
        }
      };
      
      // Initialize tenant settings model with tenant context
      req.tenantSettings = require('../models/tenant-settings')(env, req.tenantCtx);
      
      next();
    } catch (err) {
      console.error('Error getting tenant context:', err);
      res.status(500).json({ error: 'Server error' });
    }
  }
  
  // Get tenant settings
  api.get('/tenant-settings', getTenantContext, async function(req, res) {
    try {
      const settings = await req.tenantSettings.findByTenantId(req.tenantCtx.tenant.tenantId);
      
      // Remove sensitive data before sending
      if (settings) {
        if (settings.bridge && settings.bridge.password) {
          settings.bridge.passwordSet = true;
          delete settings.bridge.password;
        }
        if (settings.mmconnect && settings.mmconnect.password) {
          settings.mmconnect.passwordSet = true;
          delete settings.mmconnect.password;
        }
      }
      
      res.json(settings || {});
    } catch (err) {
      console.error('Error getting tenant settings:', err);
      res.status(500).json({ error: 'Failed to get settings' });
    }
  });
  
  // Update bridge settings
  api.post('/tenant-settings/bridge', getTenantContext, async function(req, res) {
    try {
      const bridgeSettings = req.body;
      
      // Validate required fields
      if (!bridgeSettings.userName) {
        return res.status(400).json({ error: 'Dexcom username is required' });
      }
      
      // If password is not provided but was previously set, keep the old one
      if (!bridgeSettings.password && req.body.keepPassword) {
        const current = await req.tenantSettings.findByTenantId(req.tenantCtx.tenant.tenantId);
        if (current && current.bridge && current.bridge.password) {
          bridgeSettings.password = current.bridge.password;
        }
      } else if (!bridgeSettings.password) {
        return res.status(400).json({ error: 'Dexcom password is required' });
      }
      
      // Set defaults
      bridgeSettings.enable = bridgeSettings.enable !== false;
      bridgeSettings.interval = bridgeSettings.interval || 150000; // 2.5 minutes
      bridgeSettings.minutes = bridgeSettings.minutes || 1440;
      bridgeSettings.maxCount = bridgeSettings.maxCount || 1;
      bridgeSettings.maxFailures = bridgeSettings.maxFailures || 3;
      bridgeSettings.firstFetchCount = bridgeSettings.firstFetchCount || 3;
      
      await req.tenantSettings.updateBridge(req.tenantCtx.tenant.tenantId, bridgeSettings);
      
      // Restart bridge if it was running
      const bridgeMultiTenant = require('../plugins/bridge-multitenant')(env, ctx.bus);
      if (bridgeSettings.enable) {
        // Get entries collection for this tenant
        const entries = require('../server/entries')(env, req.tenantCtx);
        
        // Get full settings (with decrypted password)
        const fullSettings = await req.tenantSettings.findByTenantId(req.tenantCtx.tenant.tenantId);
        
        bridgeMultiTenant.startForTenant(
          req.tenantCtx.tenant.tenantId,
          fullSettings,
          entries,
          req.tenantCtx
        );
      } else {
        bridgeMultiTenant.stopForTenant(req.tenantCtx.tenant.tenantId);
      }
      
      res.json({ success: true, message: 'Bridge settings updated' });
    } catch (err) {
      console.error('Error updating bridge settings:', err);
      res.status(500).json({ error: 'Failed to update settings' });
    }
  });
  
  // Update MM Connect settings
  api.post('/tenant-settings/mmconnect', getTenantContext, async function(req, res) {
    try {
      const mmSettings = req.body;
      
      // Validate required fields
      if (!mmSettings.userName) {
        return res.status(400).json({ error: 'CareLink username is required' });
      }
      
      // If password is not provided but was previously set, keep the old one
      if (!mmSettings.password && req.body.keepPassword) {
        const current = await req.tenantSettings.findByTenantId(req.tenantCtx.tenant.tenantId);
        if (current && current.mmconnect && current.mmconnect.password) {
          mmSettings.password = current.mmconnect.password;
        }
      } else if (!mmSettings.password) {
        return res.status(400).json({ error: 'CareLink password is required' });
      }
      
      // Set defaults
      mmSettings.enable = mmSettings.enable !== false;
      mmSettings.interval = mmSettings.interval || 60000; // 1 minute
      mmSettings.sgvLimit = mmSettings.sgvLimit || 24;
      mmSettings.maxRetryDuration = mmSettings.maxRetryDuration || 32;
      mmSettings.verbose = !!mmSettings.verbose;
      mmSettings.storeRawData = !!mmSettings.storeRawData;
      
      await req.tenantSettings.updateMMConnect(req.tenantCtx.tenant.tenantId, mmSettings);
      
      // TODO: Restart MM Connect if needed (similar to bridge)
      
      res.json({ success: true, message: 'MiniMed Connect settings updated' });
    } catch (err) {
      console.error('Error updating MM Connect settings:', err);
      res.status(500).json({ error: 'Failed to update settings' });
    }
  });
  
  // Delete tenant settings
  api.delete('/tenant-settings', getTenantContext, async function(req, res) {
    try {
      await req.tenantSettings.remove(req.tenantCtx.tenant.tenantId);
      
      // Stop any running services
      const bridgeMultiTenant = require('../plugins/bridge-multitenant')(env, ctx.bus);
      bridgeMultiTenant.stopForTenant(req.tenantCtx.tenant.tenantId);
      
      res.json({ success: true, message: 'Settings deleted' });
    } catch (err) {
      console.error('Error deleting tenant settings:', err);
      res.status(500).json({ error: 'Failed to delete settings' });
    }
  });
  
  return api;
}

module.exports = configure;
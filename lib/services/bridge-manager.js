'use strict';

const _ = require('lodash');

function init(env, ctx) {
  const connectionManager = require('../utils/connectionManager')(env);
  const bridgeMultiTenant = require('../plugins/bridge-multitenant')(env, ctx.bus);
  const tenantModel = require('../models/tenant')(env, ctx);
  
  const manager = {
    activeBridges: new Map(),
    
    // Initialize bridges for all active tenants with bridge configured
    async initializeAll() {
      console.log('Initializing bridges for all tenants...');
      
      try {
        // Get all active tenants
        const tenants = await tenantModel.listActive();
        console.log(`Found ${tenants.length} active tenants`);
        
        // Initialize bridge for each tenant
        for (const tenant of tenants) {
          try {
            await this.initializeTenant(tenant);
          } catch (err) {
            console.error(`Failed to initialize bridge for tenant ${tenant.tenantId}:`, err);
          }
        }
        
        console.log(`Bridge manager initialized with ${this.activeBridges.size} active bridges`);
      } catch (err) {
        console.error('Failed to initialize bridge manager:', err);
      }
    },
    
    // Initialize bridge for a specific tenant
    async initializeTenant(tenant) {
      if (!tenant || !tenant.isActive) {
        return false;
      }
      
      try {
        // Get tenant database
        const tenantDb = await connectionManager.getTenantDb(tenant);
        
        // Create tenant context
        const tenantCtx = {
          tenant: tenant,
          tenantDb: tenantDb,
          store: {
            db: tenantDb,
            collection: function(name) {
              return tenantDb.collection(name);
            }
          },
          bus: ctx.bus  // Share the main event bus
        };
        
        // Get tenant settings
        const tenantSettings = require('../models/tenant-settings')(env, tenantCtx);
        const settings = await tenantSettings.findByTenantId(tenant.tenantId);
        
        if (!settings || !settings.bridge || !settings.bridge.enable) {
          console.log(`Bridge not enabled for tenant ${tenant.subdomain}`);
          return false;
        }
        
        // Get entries collection for this tenant
        const entries = require('../server/entries')(env, tenantCtx);
        
        // Start bridge
        const started = bridgeMultiTenant.startForTenant(
          tenant.tenantId,
          settings,
          entries,
          tenantCtx
        );
        
        if (started) {
          this.activeBridges.set(tenant.tenantId, {
            tenant: tenant,
            startedAt: new Date(),
            settings: settings.bridge
          });
          console.log(`Bridge started for tenant ${tenant.subdomain}`);
        }
        
        return started;
      } catch (err) {
        console.error(`Error initializing bridge for tenant ${tenant.tenantId}:`, err);
        return false;
      }
    },
    
    // Stop bridge for a specific tenant
    stopTenant(tenantId) {
      const stopped = bridgeMultiTenant.stopForTenant(tenantId);
      if (stopped) {
        this.activeBridges.delete(tenantId);
        console.log(`Bridge stopped for tenant ${tenantId}`);
      }
      return stopped;
    },
    
    // Restart bridge for a tenant (e.g., after settings change)
    async restartTenant(tenantId) {
      this.stopTenant(tenantId);
      
      const tenant = await tenantModel.findById(tenantId);
      if (tenant) {
        return await this.initializeTenant(tenant);
      }
      return false;
    },
    
    // Get status of all bridges
    getStatus() {
      const status = {
        totalActive: this.activeBridges.size,
        bridges: []
      };
      
      this.activeBridges.forEach((info, tenantId) => {
        status.bridges.push({
          tenantId: tenantId,
          subdomain: info.tenant.subdomain,
          startedAt: info.startedAt,
          uptime: Date.now() - info.startedAt.getTime(),
          interval: info.settings.interval
        });
      });
      
      return status;
    },
    
    // Shutdown all bridges
    shutdown() {
      console.log('Shutting down all bridges...');
      bridgeMultiTenant.stopAll();
      this.activeBridges.clear();
    }
  };
  
  // Set up event listeners
  ctx.bus.on('teardown', function() {
    manager.shutdown();
  });
  
  // Listen for tenant events
  ctx.bus.on('tenant:created', async function(tenant) {
    console.log('New tenant created, checking for bridge setup...');
    await manager.initializeTenant(tenant);
  });
  
  ctx.bus.on('tenant:settings:updated', async function(data) {
    if (data && data.tenantId) {
      console.log('Tenant settings updated, restarting bridge...');
      await manager.restartTenant(data.tenantId);
    }
  });
  
  return manager;
}

module.exports = init;
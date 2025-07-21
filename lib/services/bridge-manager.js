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
      console.log('[BRIDGE-MANAGER] Initializing bridges for all tenants...');
      
      try {
        // Get all active tenants
        const tenants = await tenantModel.listActive();
        console.log(`[BRIDGE-MANAGER] Found ${tenants.length} active tenants`);
        
        // Initialize bridge for each tenant
        for (const tenant of tenants) {
          try {
            console.log(`[BRIDGE-MANAGER] Processing tenant: ${tenant.subdomain} (${tenant.tenantId})`);
            const initialized = await this.initializeTenant(tenant);
            console.log(`[BRIDGE-MANAGER] Tenant ${tenant.subdomain} bridge initialized:`, initialized);
          } catch (err) {
            console.error(`[BRIDGE-MANAGER] Failed to initialize bridge for tenant ${tenant.tenantId}:`, err);
          }
        }
        
        console.log(`[BRIDGE-MANAGER] Bridge manager initialized with ${this.activeBridges.size} active bridges`);
      } catch (err) {
        console.error('[BRIDGE-MANAGER] Failed to initialize bridge manager:', err);
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
        console.log(`[BRIDGE-MANAGER] Connected to database: ${tenant.databaseName}`);
        
        // Create tenant context with required properties
        const tenantCtx = {
          tenant: tenant,
          tenantDb: tenantDb,
          store: {
            db: tenantDb,
            collection: function(name) {
              return tenantDb.collection(name);
            }
          },
          bus: ctx.bus || require('../bus')(env.settings, {}),  // Use main bus or create new
          ddata: ctx.ddata || require('../data/ddata')(),  // Use main ddata or create new
          settings: env.settings
        };
        
        // Get tenant settings from tenant database
        const settingsCollection = tenantDb.collection('settings');
        const settings = await settingsCollection.findOne({});
        console.log(`[BRIDGE-MANAGER] Settings lookup result for ${tenant.subdomain}:`, {
          found: !!settings,
          hasBridge: !!settings?.bridge,
          bridgeEnabled: settings?.bridge?.enable
        });
        
        if (!settings || !settings.bridge || !settings.bridge.enable) {
          console.log(`[BRIDGE-MANAGER] Bridge not enabled for tenant ${tenant.subdomain}`);
          console.log(`[BRIDGE-MANAGER] Settings found:`, !!settings);
          console.log(`[BRIDGE-MANAGER] Bridge config:`, !!settings?.bridge);
          console.log(`[BRIDGE-MANAGER] Bridge enabled:`, settings?.bridge?.enable);
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
          console.log(`[BRIDGE-MANAGER] Bridge started successfully for tenant ${tenant.subdomain}`);
        } else {
          console.log(`[BRIDGE-MANAGER] Bridge failed to start for tenant ${tenant.subdomain}`);
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
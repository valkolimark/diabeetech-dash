'use strict';

/**
 * Middleware to inject tenant-specific context into API routes
 * This middleware must run AFTER tenantResolver
 */

function createTenantContextMiddleware(env, ctx) {
  
  return function tenantContext(req, res, next) {
    // If we have a tenant-specific context, temporarily override the global ctx properties
    // This is safe because Node.js is single-threaded and handles one request at a time
    if (req.ctx) {
      // Store original values
      const originalStore = ctx.store;
      const originalEntries = ctx.entries;
      const originalTreatments = ctx.treatments;
      const originalDevicestatus = ctx.devicestatus;
      const originalProfile = ctx.profile;
      const originalFood = ctx.food;
      const originalActivity = ctx.activity;
      
      // Override with tenant-specific values
      ctx.store = req.ctx.store;
      ctx.entries = req.ctx.entries;
      ctx.treatments = req.ctx.treatments;
      ctx.devicestatus = req.ctx.devicestatus;
      ctx.profile = req.ctx.profile;
      ctx.food = req.ctx.food;
      ctx.activity = req.ctx.activity;
      
      // Restore original values after request is processed
      const cleanup = () => {
        ctx.store = originalStore;
        ctx.entries = originalEntries;
        ctx.treatments = originalTreatments;
        ctx.devicestatus = originalDevicestatus;
        ctx.profile = originalProfile;
        ctx.food = originalFood;
        ctx.activity = originalActivity;
      };
      
      // Ensure cleanup happens after response is sent
      res.on('finish', cleanup);
      res.on('close', cleanup);
      res.on('error', cleanup);
    }
    
    next();
  };
}

module.exports = createTenantContextMiddleware;
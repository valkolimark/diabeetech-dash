'use strict';

/**
 * Middleware to wrap API route handlers with tenant-specific context
 * This ensures that all API routes use the tenant-specific database
 * without modifying the original route implementations
 */

function createApiContextWrapper(env, ctx) {
  
  // Wrapper function for API route factories
  function wrapApiRoute(routeFactory) {
    // Return a middleware function that Express can use
    return function(req, res, next) {
      // Use tenant-specific context if available, otherwise fall back to global context
      const requestCtx = req.ctx || ctx;
      
      // Create the route handler with the appropriate context
      const routeHandler = routeFactory(req.app, req.app.wares || ctx.wares, requestCtx, env);
      
      // Execute the route handler
      routeHandler(req, res, next);
    };
  }
  
  // Wrapper for API modules that return Express routers
  function wrapApiModule(moduleFactory) {
    return function(req, res, next) {
      // Use tenant-specific context if available
      const requestCtx = req.ctx || ctx;
      
      // Create the router with the appropriate context
      const router = moduleFactory(req.app, ctx.wares, requestCtx, env);
      
      // Execute the router
      router(req, res, next);
    };
  }
  
  return {
    wrapApiRoute,
    wrapApiModule
  };
}

module.exports = createApiContextWrapper;
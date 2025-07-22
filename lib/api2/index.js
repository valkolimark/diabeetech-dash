'use strict';

function create (env, ctx, apiv1) {
  var express = require('express')
    ,  app = express( )
    ;

    const ddata = require('../data/endpoints')(env, ctx);
    const notificationsV2 = require('./notifications-v2')(app, ctx);
    const summary = require('./summary')(env, ctx);

    app.use('/', apiv1);
    // Create properties endpoint directly
    const properties = require('./properties')(env, ctx);
    app.use('/properties', properties);
    // Add tenant admin check for authorization endpoints in multi-tenant mode
    if (env.MULTI_TENANT_ENABLED === 'true') {
      app.use('/authorization', (req, res, next) => {
        if (!req.tenant || !req.tenant.isAdmin) {
          return res.status(403).json({
            status: 403,
            message: 'Access denied',
            error: 'Admin functionality not available for this tenant'
          });
        }
        next();
      }, ctx.authorization.endpoints);
    } else {
      app.use('/authorization', ctx.authorization.endpoints);
    }
    app.use('/ddata', ddata);
    app.use('/notifications', notificationsV2);
    app.use('/summary', summary);
    
  return app;
}

module.exports = create;

'use strict';

function create (env, ctx, apiv1) {
  var express = require('express')
    ,  app = express( )
    ;

    const ddata = require('../data/endpoints')(env, ctx);
    const notificationsV2 = require('./notifications-v2')(app, ctx);
    const summary = require('./summary')(env, ctx);

    app.use('/', apiv1);
    // Use request-specific properties if available (multi-tenant), otherwise use global
    app.use('/properties', function(req, res, next) {
      const properties = (req.ctx && req.ctx.properties) ? req.ctx.properties : ctx.properties;
      if (properties) {
        properties(req, res, next);
      } else {
        res.status(500).json({ error: 'Properties endpoint not initialized' });
      }
    });
    app.use('/authorization', ctx.authorization.endpoints);
    app.use('/ddata', ddata);
    app.use('/notifications', notificationsV2);
    app.use('/summary', summary);
    
  return app;
}

module.exports = create;

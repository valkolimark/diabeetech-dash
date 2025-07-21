'use strict';

function configure (app, wares, env, ctx) {
  var express = require('express'),
    forwarded = require('forwarded-for'),
    api = express.Router( )
    ;

  api.use(wares.sendJSONStatus);
  api.use(wares.extensions([
    'json', 'svg', 'csv', 'txt', 'png', 'html', 'js'
  ]));

  // Use middleware that checks for tenant-specific authorization
  api.use(function checkAuth(req, res, next) {
    const auth = (req.ctx && req.ctx.authorization) ? req.ctx.authorization : ctx.authorization;
    auth.isPermitted('api:status:read')(req, res, next);
  });

  // Status badge/text/json
  api.get('/status', function (req, res) {
    
    // Use tenant-specific settings if available
    const tenantSettings = (req.ctx && req.ctx.settings) ? req.ctx.settings : env.settings;
    const tenantAuth = (req.ctx && req.ctx.authorization) ? req.ctx.authorization : ctx.authorization;
    
    let extended = tenantSettings.filteredSettings ? tenantSettings.filteredSettings(app.extendedClientSettings) : app.extendedClientSettings;
    let settings = tenantSettings.filteredSettings ? tenantSettings.filteredSettings(tenantSettings) : tenantSettings;

    var authToken = req.query.token || req.query.secret || '';

    function getRemoteIP (req) {
      const address = forwarded(req, req.headers);
      return address.ip;
    }

    var date = new Date();
    var info = { status: 'ok'
      , name: app.get('name')
      , version: app.get('version')
      , serverTime: date.toISOString()
      , serverTimeEpoch: date.getTime()
      , apiEnabled: app.enabled('api')
      , careportalEnabled: app.enabled('api') && tenantSettings.enable && tenantSettings.enable.indexOf('careportal') > -1
      , boluscalcEnabled: app.enabled('api') && tenantSettings.enable && tenantSettings.enable.indexOf('boluscalc') > -1
      , settings: settings
      , extendedSettings: extended
      , authorized: tenantAuth.authorize(authToken, getRemoteIP(req))
      , runtimeState: ctx.runtimeState
    };

    var badge = 'http://img.shields.io/badge/Nightscout-OK-green';
    return res.format({
      html: function ( ) {
        res.send('<h1>STATUS OK</h1>');
      },
      png: function ( ) {
        res.redirect(302, badge + '.png');
      },
      svg: function ( ) {
        res.redirect(302, badge + '.svg');
      },
      js: function ( ) {
        var parts = ['this.serverSettings =', JSON.stringify(info), ';'];

        res.send(parts.join(' '));
      },
      text: function ( ) {
        res.send('STATUS OK');
      },
      json: function ( ) {
        res.json(info);
      }
    });
  });

  return api;
}
module.exports = configure;

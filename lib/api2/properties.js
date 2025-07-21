'use strict';

var _isEmpty = require('lodash/isEmpty');
var _filter = require('lodash/filter');
var _pick = require('lodash/pick');

var express = require('express');
var sandbox = require('../sandbox')();

function create (env, ctx) {
  var properties = express( );

  /**
   * Supports the paths:
   * /v2/properties - All properties
   * /v2/properties/prop1 - Only prop1
   * /v2/properties/prop1,prop3 - Only prop1 and prop3
   *
   * Expecting to define extended syntax and support for several query params
   */
  // Use middleware that checks for authorization in the request context
  properties.use(function checkAuth(req, res, next) {
    const auth = (req.ctx && req.ctx.authorization) ? req.ctx.authorization : ctx.authorization;
    if (!auth) {
      console.error('Properties endpoint: No authorization available');
      return res.status(500).json({ error: 'Authorization not initialized' });
    }
    // Check permissions
    auth.isPermitted('api:entries:read')(req, res, function() {
      auth.isPermitted('api:treatments:read')(req, res, next);
    });
  });
  properties.get(['/', '/*'], function getProperties (req, res) {

    // Use request-specific sbx if available (multi-tenant), otherwise use global
    var sbx = (req.ctx && req.ctx.sbx) ? req.ctx.sbx : ctx.sbx;
    
    if (!sbx) {
      console.error('Properties endpoint: No sandbox available');
      return res.status(500).json({ error: 'Sandbox not initialized' });
    }
    
    if (!sbx.properties) {
      console.error('Properties endpoint: No properties in sandbox');
      return res.status(500).json({ error: 'Properties not available' });
    }

    function notEmpty (part) {
      return ! _isEmpty(part);
    }

    var segments = _filter(req.path.split('/'), notEmpty);

    var selected = [ ];

    if (segments.length > 0) {
      selected = _filter(segments[0].split(','), notEmpty);
    }

    var result = sbx.properties;

    if (selected.length > 0) {
      result = _pick(sbx.properties, selected);
    }

    result = env.settings.filteredSettings(result);
    
    if (req.query && req.query.pretty) {
      res.setHeader('Content-Type', 'application/json');
      res.send(JSON.stringify(result, null, 2));
    } else {
      res.json(result);
    }

  });


  return properties;
}

module.exports = create;

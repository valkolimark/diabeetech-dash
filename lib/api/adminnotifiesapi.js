'use strict';

const _ = require('lodash');
const consts = require('../constants');

function configure (ctx) {
  const express = require('express')
    , api = express.Router();

  api.get('/adminnotifies', function(req, res) {
    // Check tenant admin in multi-tenant mode
    if (process.env.MULTI_TENANT_ENABLED === 'true' && (!req.tenant || !req.tenant.isAdmin)) {
      return res.status(403).json({
        status: 403,
        message: 'Access denied',
        error: 'Admin functionality not available for this tenant'
      });
    }

    ctx.authorization.resolveWithRequest(req, function resolved (err, result) {

      const isAdmin = ctx.authorization.checkMultiple('*:*:admin', result.shiros); //full admin permissions
      const response = {
        notifies: []
        , notifyCount: 0
      };

      if (ctx.adminnotifies) {
        const notifies = _.filter(ctx.adminnotifies.getNotifies(), function isOld (obj) {
          return (obj.persistent || (Date.now() - obj.lastRecorded) < 1000 * 60 * 60 * 8);
        });

        if (isAdmin) { response.notifies = notifies }
        response.notifyCount = notifies.length;
      }

      res.sendJSONStatus(res, consts.HTTP_OK, response);
    });
  });

  return api;
}

module.exports = configure;

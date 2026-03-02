'use strict';

const express = require('express');
const router = express.Router();

// GET /api/v1/admin/glucose/overview - Latest glucose for all tenants
router.get('/overview', async function(req, res) {
  try {
    const ctx = req.app.get('ctx');
    const connectionManager = ctx.multiTenant.connectionManager;
    const tenantModel = ctx.multiTenant.models.tenant;

    // Get all active tenants
    const tenants = await tenantModel.listActive();

    // Get bridge status for cross-reference
    const bridgeStatus = ctx.bridgeManager ? ctx.bridgeManager.getStatus() : { bridges: [] };
    const runningMap = new Map();
    bridgeStatus.bridges.forEach(function(b) {
      runningMap.set(b.tenantId, b);
    });

    // Query latest SGV from each tenant's database
    const results = await Promise.allSettled(tenants.map(async function(tenant) {
      try {
        const tenantDb = await connectionManager.getTenantDb(tenant);
        const latestEntry = await tenantDb.collection('entries')
          .findOne(
            { type: 'sgv' },
            { sort: { date: -1 } }
          );

        const now = Date.now();
        let minutesAgo = null;
        let staleness = 'none';

        if (latestEntry && latestEntry.date) {
          minutesAgo = Math.round((now - latestEntry.date) / 60000);
          if (minutesAgo < 6) {
            staleness = 'fresh';
          } else if (minutesAgo < 15) {
            staleness = 'aging';
          } else {
            staleness = 'stale';
          }
        }

        return {
          tenantId: tenant.tenantId,
          tenantName: tenant.tenantName || tenant.name || tenant.subdomain,
          subdomain: tenant.subdomain,
          latestSgv: latestEntry ? latestEntry.sgv : null,
          direction: latestEntry ? latestEntry.direction : null,
          date: latestEntry ? latestEntry.date : null,
          dateString: latestEntry ? latestEntry.dateString : null,
          minutesAgo: minutesAgo,
          staleness: staleness,
          bridgeRunning: !!runningMap.get(tenant.tenantId)
        };
      } catch (err) {
        return {
          tenantId: tenant.tenantId,
          tenantName: tenant.tenantName || tenant.name || tenant.subdomain,
          subdomain: tenant.subdomain,
          latestSgv: null,
          direction: null,
          date: null,
          dateString: null,
          minutesAgo: null,
          staleness: 'error',
          bridgeRunning: false,
          error: err.message
        };
      }
    }));

    const tenantData = results
      .filter(function(r) { return r.status === 'fulfilled'; })
      .map(function(r) { return r.value; });

    // BG thresholds for frontend color coding
    const thresholds = {
      urgentHigh: parseInt(process.env.BG_HIGH) || 260,
      high: parseInt(process.env.BG_TARGET_TOP) || 180,
      targetTop: parseInt(process.env.BG_TARGET_TOP) || 180,
      targetBottom: parseInt(process.env.BG_TARGET_BOTTOM) || 80,
      low: 70,
      urgentLow: parseInt(process.env.BG_LOW) || 55
    };

    res.json({
      success: true,
      data: {
        tenants: tenantData,
        thresholds: thresholds
      }
    });
  } catch (error) {
    console.error('Admin glucose overview error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch glucose overview', details: error.message });
  }
});

module.exports = router;

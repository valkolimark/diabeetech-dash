'use strict';

const express = require('express');
const router = express.Router();

// Strip accidental backslash escaping from passwords (e.g. \! \$ \")
// Dexcom passwords don't contain literal backslashes
function sanitizePassword(pw) {
  if (!pw || typeof pw !== 'string') return pw;
  return pw.replace(/\\([!@#$%^&*()'"?])/g, '$1');
}

// GET /api/v1/admin/bridges - List all tenants with bridge status
router.get('/', async function(req, res) {
  try {
    const ctx = req.app.get('ctx');
    const connectionManager = ctx.multiTenant.connectionManager;
    const tenantModel = ctx.multiTenant.models.tenant;

    // Get all active tenants
    const tenants = await tenantModel.listActive();

    // Get bridge manager status
    const bridgeStatus = ctx.bridgeManager ? ctx.bridgeManager.getStatus() : { bridges: [] };
    const runningMap = new Map();
    bridgeStatus.bridges.forEach(function(b) {
      runningMap.set(b.tenantId, b);
    });

    // Query each tenant's settings for bridge config
    const bridges = await Promise.allSettled(tenants.map(async function(tenant) {
      try {
        const tenantDb = await connectionManager.getTenantDb(tenant);
        const settings = await tenantDb.collection('settings').findOne({});
        const bridge = settings && settings.bridge ? settings.bridge : {};
        const running = runningMap.get(tenant.tenantId);

        return {
          tenantId: tenant.tenantId,
          tenantName: tenant.tenantName || tenant.name || tenant.subdomain,
          subdomain: tenant.subdomain,
          dexcomUsername: bridge.userName || '',
          bridgeEnabled: !!bridge.enable,
          bridgeRunning: !!running,
          uptime: running ? running.uptime : 0,
          startedAt: running ? running.startedAt : null,
          interval: bridge.interval || 156000
        };
      } catch (err) {
        return {
          tenantId: tenant.tenantId,
          tenantName: tenant.tenantName || tenant.name || tenant.subdomain,
          subdomain: tenant.subdomain,
          dexcomUsername: '',
          bridgeEnabled: false,
          bridgeRunning: false,
          uptime: 0,
          startedAt: null,
          interval: 0,
          error: err.message
        };
      }
    }));

    const results = bridges
      .filter(function(r) { return r.status === 'fulfilled'; })
      .map(function(r) { return r.value; });

    res.json({
      success: true,
      data: { bridges: results }
    });
  } catch (error) {
    console.error('Admin bridges list error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch bridges', details: error.message });
  }
});

// PUT /api/v1/admin/bridges/:tenantId - Update Dexcom credentials
router.put('/:tenantId', async function(req, res) {
  try {
    const ctx = req.app.get('ctx');
    const connectionManager = ctx.multiTenant.connectionManager;
    const tenantModel = ctx.multiTenant.models.tenant;
    const tenantId = req.params.tenantId;

    const { userName, password, enable } = req.body;

    // Find tenant
    const tenant = await tenantModel.findById(tenantId);
    if (!tenant) {
      return res.status(404).json({ success: false, error: 'Tenant not found' });
    }

    // Get tenant DB and current settings
    const tenantDb = await connectionManager.getTenantDb(tenant);
    const settingsCollection = tenantDb.collection('settings');
    const settings = await settingsCollection.findOne({});

    if (!settings) {
      // Create settings document with bridge config
      await settingsCollection.insertOne({
        bridge: {
          userName: userName || '',
          password: sanitizePassword(password) || '',
          enable: enable !== undefined ? enable : false,
          interval: 156000,
          minutes: 1400,
          maxCount: 1,
          maxFailures: 3
        }
      });
    } else {
      // Build update
      const bridgeUpdate = {};
      if (userName !== undefined) {
        bridgeUpdate['bridge.userName'] = userName;
      }
      if (password !== undefined && password !== '') {
        bridgeUpdate['bridge.password'] = sanitizePassword(password);
      }
      if (enable !== undefined) {
        bridgeUpdate['bridge.enable'] = enable;
      }

      if (Object.keys(bridgeUpdate).length > 0) {
        await settingsCollection.updateOne(
          { _id: settings._id },
          { $set: bridgeUpdate }
        );
      }
    }

    // Restart or stop bridge based on enable flag
    let bridgeRunning = false;
    if (ctx.bridgeManager) {
      if (enable === false) {
        ctx.bridgeManager.stopTenant(tenantId);
        bridgeRunning = false;
      } else {
        bridgeRunning = await ctx.bridgeManager.restartTenant(tenantId);
      }
    }

    console.log(`Admin ${req.user.email} updated bridge for tenant ${tenant.subdomain}`);

    res.json({
      success: true,
      message: enable === false
        ? 'Bridge credentials updated and bridge stopped'
        : 'Bridge credentials updated and bridge restarted',
      bridgeRunning: bridgeRunning
    });
  } catch (error) {
    console.error('Admin bridge update error:', error);
    res.status(500).json({ success: false, error: 'Failed to update bridge', details: error.message });
  }
});

// POST /api/v1/admin/bridges/:tenantId/restart - Restart bridge
router.post('/:tenantId/restart', async function(req, res) {
  try {
    const ctx = req.app.get('ctx');
    const tenantId = req.params.tenantId;

    if (!ctx.bridgeManager) {
      return res.status(500).json({ success: false, error: 'Bridge manager not available' });
    }

    const started = await ctx.bridgeManager.restartTenant(tenantId);

    console.log(`Admin ${req.user.email} restarted bridge for tenant ${tenantId}: ${started}`);

    res.json({
      success: true,
      message: started ? 'Bridge restarted successfully' : 'Bridge failed to start',
      bridgeRunning: started
    });
  } catch (error) {
    console.error('Admin bridge restart error:', error);
    res.status(500).json({ success: false, error: 'Failed to restart bridge', details: error.message });
  }
});

// POST /api/v1/admin/bridges/:tenantId/stop - Stop bridge
router.post('/:tenantId/stop', async function(req, res) {
  try {
    const ctx = req.app.get('ctx');
    const tenantId = req.params.tenantId;

    if (!ctx.bridgeManager) {
      return res.status(500).json({ success: false, error: 'Bridge manager not available' });
    }

    const stopped = ctx.bridgeManager.stopTenant(tenantId);

    console.log(`Admin ${req.user.email} stopped bridge for tenant ${tenantId}: ${stopped}`);

    res.json({
      success: true,
      message: stopped ? 'Bridge stopped successfully' : 'Bridge was not running',
      bridgeRunning: false
    });
  } catch (error) {
    console.error('Admin bridge stop error:', error);
    res.status(500).json({ success: false, error: 'Failed to stop bridge', details: error.message });
  }
});

module.exports = router;

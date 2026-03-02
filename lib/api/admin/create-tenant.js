'use strict';

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

// Strip accidental backslash escaping from passwords (e.g. \! \$ \")
function sanitizePassword(pw) {
  if (!pw || typeof pw !== 'string') return pw;
  return pw.replace(/\\([!@#$%^&*()'"?])/g, '$1');
}

// POST /api/v1/admin/tenants/create-full - Full tenant setup
router.post('/', async function(req, res) {
  try {
    const ctx = req.app.get('ctx');
    const connectionManager = ctx.multiTenant.connectionManager;
    const tenantModel = ctx.multiTenant.models.tenant;
    const masterDb = connectionManager.getMasterDb();

    const {
      username,       // becomes subdomain
      displayName,    // tenant display name
      email,          // user login email
      password,       // user login password
      units,          // mg/dl or mmol
      dexcomUsername,  // Dexcom Share username
      dexcomPassword,  // Dexcom Share password
      enableBridge    // auto-start bridge
    } = req.body;

    // Validate required fields
    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Username, email, and password are required'
      });
    }

    // Sanitize subdomain
    const subdomain = username.toLowerCase().replace(/[^a-z0-9-]/g, '');
    if (subdomain.length < 3 || subdomain.length > 63) {
      return res.status(400).json({
        success: false,
        error: 'Username must be 3-63 characters (letters, numbers, hyphens)'
      });
    }

    // Check subdomain uniqueness
    const existing = await tenantModel.findBySubdomain(subdomain);
    if (existing) {
      return res.status(409).json({
        success: false,
        error: 'Username/subdomain already taken'
      });
    }

    // Generate tenant ID and API secret
    const tenantId = 'tenant-' + subdomain + '-' + uuidv4().slice(0, 8);
    const apiSecret = crypto.randomBytes(20).toString('hex');
    const apiSecretHash = crypto.createHash('sha1').update(apiSecret).digest('hex');
    const dbPrefix = process.env.TENANT_DB_PREFIX || 'nightscout_staging_tenant_';
    const databaseName = dbPrefix + subdomain;

    // Create tenant record in master DB
    const tenant = {
      tenantId: tenantId,
      tenantName: displayName || username,
      subdomain: subdomain,
      databaseName: databaseName,
      apiSecret: apiSecret,
      apiSecretHash: apiSecretHash,
      maxUsers: 10,
      features: ['careportal', 'iob', 'cob', 'boluscalc'],
      createdAt: new Date(),
      isActive: true
    };

    await masterDb.collection('tenants').insertOne(tenant);

    // Create user record in master DB
    const passwordHash = await bcrypt.hash(password, 10);
    const user = {
      userId: uuidv4(),
      tenantId: tenantId,
      email: email.toLowerCase(),
      password: passwordHash,
      role: 'admin',
      profile: {
        displayName: displayName || username,
        units: units || 'mg/dl'
      },
      isActive: true,
      createdAt: new Date()
    };

    await masterDb.collection('users').insertOne(user);

    // Create tenant database and collections
    const tenantDb = await connectionManager.createTenantDatabase(tenant);

    // Insert bridge settings
    const bridgeConfig = {
      bridge: {
        userName: dexcomUsername || '',
        password: sanitizePassword(dexcomPassword) || '',
        enable: !!(enableBridge && dexcomUsername && dexcomPassword),
        interval: 156000,
        minutes: 1400,
        maxCount: 1,
        maxFailures: 3
      },
      thresholds: {
        bgHigh: 260,
        bgTargetTop: 180,
        bgTargetBottom: 80,
        bgLow: 55
      }
    };

    await tenantDb.collection('settings').insertOne(bridgeConfig);

    // Create default profile
    await tenantDb.collection('profile').insertOne({
      defaultProfile: 'Default',
      store: {
        Default: {
          dia: 4,
          carbratio: [{ time: '00:00', value: 10 }],
          sens: [{ time: '00:00', value: 50 }],
          basal: [{ time: '00:00', value: 1 }],
          target_low: [{ time: '00:00', value: 80 }],
          target_high: [{ time: '00:00', value: 180 }],
          timezone: 'US/Central',
          units: units || 'mg/dl'
        }
      },
      startDate: new Date().toISOString(),
      created_at: new Date().toISOString()
    });

    // Start bridge if Dexcom credentials provided and bridge enabled
    let bridgeRunning = false;
    if (enableBridge && dexcomUsername && dexcomPassword && ctx.bridgeManager) {
      try {
        bridgeRunning = await ctx.bridgeManager.initializeTenant(tenant);
      } catch (err) {
        console.error('Bridge initialization failed for new tenant:', err.message);
      }
    }

    // Audit log
    await masterDb.collection('admin_audit').insertOne({
      action: 'tenant.create_full',
      user: req.user.id,
      userEmail: req.user.email,
      target: tenantId,
      details: {
        subdomain: subdomain,
        displayName: displayName || username,
        email: email,
        dexcomConfigured: !!(dexcomUsername && dexcomPassword),
        bridgeStarted: bridgeRunning
      },
      timestamp: new Date()
    });

    console.log(`Admin ${req.user.email} created full tenant: ${subdomain} (${tenantId})`);

    res.status(201).json({
      success: true,
      message: 'Tenant created successfully',
      data: {
        tenant: {
          tenantId: tenantId,
          tenantName: displayName || username,
          subdomain: subdomain,
          databaseName: databaseName,
          url: `http://${subdomain}.localhost:${process.env.PORT || 1337}`
        },
        user: {
          email: email,
          role: 'admin',
          displayName: displayName || username
        },
        bridge: {
          configured: !!(dexcomUsername && dexcomPassword),
          running: bridgeRunning,
          dexcomUsername: dexcomUsername || null
        }
      }
    });
  } catch (error) {
    console.error('Admin create-full tenant error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create tenant',
      details: error.message
    });
  }
});

module.exports = router;

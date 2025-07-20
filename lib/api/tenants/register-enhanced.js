'use strict';

const express = require('express');
const _ = require('lodash');
const validator = require('validator');

function configure(env, ctx) {
  const router = express.Router();
  const tenantModel = require('../../models/tenant')(env, ctx);
  const userModel = require('../../models/user')(env, ctx);
  const connectionManager = require('../../utils/connectionManager')(env);
  const auth = require('../../middleware/auth')(env, ctx);
  
  // Enhanced registration endpoint that includes Dexcom setup
  router.post('/', express.json(), async (req, res) => {
    try {
      const { 
        username,           // Will be used as subdomain
        email, 
        password,
        displayName,
        units,              // mg/dl or mmol
        dexcom,             // Optional Dexcom credentials
        carelink,           // Optional CareLink credentials
        profileData         // Optional Nightscout profile data
      } = req.body;
      
      // Validate required fields
      if (!username || !email || !password) {
        return res.status(400).json({
          status: 400,
          message: 'Missing required fields',
          required: ['username', 'email', 'password']
        });
      }
      
      // Validate email
      if (!validator.isEmail(email)) {
        return res.status(400).json({
          status: 400,
          message: 'Invalid email address'
        });
      }
      
      // Validate username/subdomain format
      const subdomain = username.toLowerCase().replace(/[^a-z0-9-]/g, '');
      if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(subdomain) || subdomain.length < 3 || subdomain.length > 63) {
        return res.status(400).json({
          status: 400,
          message: 'Invalid username. Use 3-63 characters with only letters, numbers, and hyphens'
        });
      }
      
      // Validate password strength
      if (password.length < 8) {
        return res.status(400).json({
          status: 400,
          message: 'Password must be at least 8 characters long'
        });
      }
      
      // Create tenant with username as subdomain
      const tenant = await tenantModel.create({
        tenantName: displayName || username + "'s Nightscout",
        subdomain: subdomain,
        contactEmail: email,
        features: ['core', 'careportal', 'reports'],
        settings: {
          units: units || 'mg/dl',
          timeFormat: 24,
          theme: 'colors'
        }
      });
      
      // Create tenant database
      const tenantDb = await connectionManager.createTenantDatabase(tenant);
      
      // Create admin user
      const adminUser = await userModel.create({
        tenantId: tenant.tenantId,
        email: email,
        password: password,
        role: userModel.ROLES.ADMIN,
        profile: {
          displayName: displayName || username,
          units: units || 'mg/dl'
        }
      });
      
      // Create tenant context for settings with required properties
      const tenantCtx = {
        tenant: tenant,
        tenantDb: tenantDb,
        store: {
          db: tenantDb,
          collection: function(name) {
            return tenantDb.collection(name);
          }
        },
        bus: ctx.bus || require('../../bus')(env.settings, {}),
        ddata: ctx.ddata || require('../../data/ddata')(),
        settings: env.settings
      };
      
      // Initialize tenant settings model
      const tenantSettings = require('../../models/tenant-settings')(env, tenantCtx);
      
      // Configure Dexcom if credentials provided
      if (dexcom && dexcom.username && dexcom.password) {
        await tenantSettings.updateBridge(tenant.tenantId, {
          enable: true,
          userName: dexcom.username,
          password: dexcom.password,
          interval: 150000,  // 2.5 minutes
          minutes: 1440,
          maxCount: 1,
          maxFailures: 3,
          firstFetchCount: 3
        });
        
        // Start bridge for this tenant
        const bridgeMultiTenant = require('../../plugins/bridge-multitenant')(env, ctx.bus);
        const entries = require('../../server/entries')(env, tenantCtx);
        const fullSettings = await tenantSettings.findByTenantId(tenant.tenantId);
        
        bridgeMultiTenant.startForTenant(
          tenant.tenantId,
          fullSettings,
          entries,
          tenantCtx
        );
      }
      
      // Configure MiniMed Connect if credentials provided
      if (carelink && carelink.username && carelink.password) {
        await tenantSettings.updateMMConnect(tenant.tenantId, {
          enable: true,
          userName: carelink.username,
          password: carelink.password,
          interval: 60000,  // 1 minute
          sgvLimit: 24,
          maxRetryDuration: 32,
          verbose: false,
          storeRawData: false
        });
        
        // TODO: Start MM Connect for this tenant
      }
      
      // Create default Nightscout profile
      const profile = {
        _id: 'defaultProfile',
        defaultProfile: 'Default',
        startDate: new Date().toISOString(),
        mills: Date.now(),
        units: units || 'mg/dl',
        store: {
          'Default': {
            dia: profileData?.dia || 4,
            timezone: profileData?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
            basal: profileData?.basal || [{ time: '00:00', value: 1.0 }],
            carbratio: profileData?.carbratio || [{ time: '00:00', value: 10 }],
            sens: profileData?.sens || [{ time: '00:00', value: 50 }],
            target_low: profileData?.target_low || [{ time: '00:00', value: 80 }],
            target_high: profileData?.target_high || [{ time: '00:00', value: 120 }],
            carbs_hr: profileData?.carbs_hr || 20,
            delay: profileData?.delay || 20,
            units: units || 'mg/dl'
          }
        }
      };
      
      // Save profile to tenant database
      await tenantDb.collection(env.profile_collection || 'profile').insertOne(profile);
      
      // Generate tokens for immediate login
      const tokens = auth.generateToken(adminUser, tenant);
      
      res.status(201).json({
        message: 'Account created successfully',
        tenant: {
          tenantId: tenant.tenantId,
          tenantName: tenant.tenantName,
          subdomain: tenant.subdomain,
          url: `https://${tenant.subdomain}.${env.BASE_DOMAIN || 'diabeetech.net'}`
        },
        user: {
          userId: adminUser.userId,
          email: adminUser.email,
          role: adminUser.role,
          displayName: adminUser.profile.displayName
        },
        auth: tokens,
        features: {
          dexcomConfigured: !!(dexcom && dexcom.username),
          carelinkConfigured: !!(carelink && carelink.username),
          profileCreated: true
        }
      });
    } catch (err) {
      console.error('Enhanced registration error:', err);
      
      if (err.message === 'Subdomain already exists') {
        return res.status(409).json({
          status: 409,
          message: 'Username already taken',
          error: 'Please choose a different username'
        });
      }
      
      res.status(500).json({
        status: 500,
        message: 'Failed to create account',
        error: err.message
      });
    }
  });
  
  // Check username availability
  router.get('/check-username/:username', async (req, res) => {
    try {
      const username = req.params.username.toLowerCase().replace(/[^a-z0-9-]/g, '');
      
      if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(username) || username.length < 3 || username.length > 63) {
        return res.json({
          available: false,
          reason: 'Invalid username format'
        });
      }
      
      const existing = await tenantModel.findOne({ subdomain: username });
      
      res.json({
        available: !existing,
        subdomain: username,
        url: `https://${username}.${env.BASE_DOMAIN || 'diabeetech.net'}`
      });
    } catch (err) {
      res.status(500).json({
        status: 500,
        message: 'Failed to check username',
        error: err.message
      });
    }
  });
  
  return router;
}

module.exports = configure;
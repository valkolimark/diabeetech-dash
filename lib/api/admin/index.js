'use strict';

const express = require('express');
const router = express.Router();

// Sub-routers
const tenants = require('./tenants');
const users = require('./users');
const analytics = require('./analytics');
const system = require('./system');
const audit = require('./audit');

// Middleware to check if user is superadmin
const requireSuperAdmin = function(req, res, next) {
  // Check feature flag first
  try {
    const features = require('../../../config/features');
    if (!features.adminDashboard || !features.adminDashboard.enabled) {
      return res.status(404).json({ error: 'Admin dashboard is not enabled' });
    }
  } catch (err) {
    // If features module doesn't exist, admin is not enabled
    return res.status(404).json({ error: 'Admin dashboard is not available' });
  }
  
  // Check if user exists and has superadmin role
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  if (req.user.role !== 'superadmin') {
    return res.status(403).json({ error: 'Superadmin access required' });
  }
  
  // Log admin access
  console.log(`Admin access: ${req.user.email} - ${req.method} ${req.originalUrl}`);
  
  next();
};

// Apply superadmin check to all admin routes
router.use(requireSuperAdmin);

// Mount sub-routers
router.use('/tenants', tenants);
router.use('/users', users);
router.use('/analytics', analytics);
router.use('/system', system);
router.use('/audit', audit);

// Admin dashboard overview
router.get('/overview', async function(req, res) {
  try {
    const ctx = req.app.get('ctx');
    const env = ctx.env;
    const store = env.storageSupport;
    
    // Get counts in parallel
    const [tenantsCount, usersCount, activeUsers] = await Promise.all([
      store.db.collection('tenants').countDocuments(),
      store.db.collection('users').countDocuments(),
      store.db.collection('users').countDocuments({
        lastLogin: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      })
    ]);
    
    // Get system info
    const systemInfo = {
      version: env.version,
      nodeVersion: process.version,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      environment: process.env.NODE_ENV || 'development'
    };
    
    res.json({
      success: true,
      data: {
        overview: {
          totalTenants: tenantsCount,
          totalUsers: usersCount,
          activeUsers30Days: activeUsers,
          systemUptime: systemInfo.uptime
        },
        system: systemInfo,
        features: require('../../../config/features').getEnabledFeatures()
      }
    });
    
  } catch (error) {
    console.error('Admin overview error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch admin overview' 
    });
  }
});

// Feature flags management
router.get('/features', function(req, res) {
  const features = require('../../../config/features');
  res.json({
    success: true,
    data: {
      enabled: features.getEnabledFeatures(),
      all: features.adminDashboard.features
    }
  });
});

// Health check for admin API
router.get('/health', function(req, res) {
  res.json({ 
    success: true,
    message: 'Admin API is healthy',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
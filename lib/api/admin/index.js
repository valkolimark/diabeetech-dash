'use strict';

const express = require('express');
const router = express.Router();

// Sub-routers
const tenants = require('./tenants');
const users = require('./users');
const analytics = require('./analytics');
const system = require('./system');
const audit = require('./audit');
const dashboard = require('./dashboard');

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
  
  // Check admin token for admin routes
  const token = req.cookies.admin_token || req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-jwt-secret');
    
    if (decoded.role !== 'superadmin') {
      return res.status(403).json({ error: 'Superadmin access required' });
    }
    
    // Attach user to request
    req.user = decoded;
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
  
  // Log admin access
  console.log(`Admin access: ${req.user.email} - ${req.method} ${req.originalUrl}`);
  
  next();
};

// Auth endpoints that don't require superadmin check
router.post('/auth/login', async function(req, res) {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    
    const ctx = req.app.get('ctx');
    const { MongoClient } = require('mongodb');
    const bcrypt = require('bcryptjs');
    const jwt = require('jsonwebtoken');
    
    // Connect to master database
    const mongoUri = process.env.MASTER_MONGODB_URI || process.env.MONGODB_URI || process.env.MONGO_CONNECTION || process.env.MONGOLAB_URI;
    
    if (!mongoUri) {
      return res.status(500).json({ error: 'Database connection not configured' });
    }
    
    const client = new MongoClient(mongoUri, { useUnifiedTopology: true });
    
    await client.connect();
    const db = client.db();
    const user = await db.collection('users').findOne({ email: email.toLowerCase() });
    
    if (!user || user.role !== 'superadmin') {
      await client.close();
      return res.status(403).json({ error: 'Superadmin access required' });
    }
    
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      await client.close();
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'default-jwt-secret',
      { expiresIn: '24h' }
    );
    
    // Set cookie
    res.cookie('admin_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });
    
    await client.close();
    
    res.json({
      success: true,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role
      },
      token
    });
    
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ error: 'Login failed', details: error.message });
  }
});

router.get('/auth/user', async function(req, res) {
  // Check admin token
  const token = req.cookies.admin_token || req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-jwt-secret');
    
    if (decoded.role !== 'superadmin') {
      return res.status(403).json({ error: 'Superadmin access required' });
    }
    
    res.json({
      user: {
        id: decoded.id,
        email: decoded.email,
        role: decoded.role
      }
    });
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

router.post('/auth/logout', function(req, res) {
  res.clearCookie('admin_token');
  res.json({ success: true });
});

// Apply superadmin check to all other admin routes
router.use(requireSuperAdmin);

// Mount sub-routers (these require superadmin check)
router.use('/tenants', tenants);
router.use('/users', users);
router.use('/analytics', analytics);
router.use('/system', system);
router.use('/audit', audit);
router.use('/dashboard', dashboard);
router.use('/memory', require('./memory'));
router.use('/bridges', require('./bridges'));
router.use('/glucose', require('./glucose'));
router.use('/tenants/create-full', require('./create-tenant'));

// Admin dashboard overview
router.get('/overview', async function(req, res) {
  const { MongoClient } = require('mongodb');
  let client;
  
  try {
    // Connect to master database
    const mongoUri = process.env.MASTER_MONGODB_URI || process.env.MONGODB_URI || process.env.MONGO_CONNECTION || process.env.MONGOLAB_URI;
    
    if (!mongoUri) {
      return res.status(500).json({ error: 'Database connection not configured' });
    }
    
    client = new MongoClient(mongoUri, { useUnifiedTopology: true });
    await client.connect();
    const db = client.db();
    
    // Get counts in parallel
    const [tenantsCount, usersCount, activeUsers] = await Promise.all([
      db.collection('tenants').countDocuments(),
      db.collection('users').countDocuments(),
      db.collection('users').countDocuments({
        lastLogin: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      })
    ]);
    
    // Get system info
    const systemInfo = {
      version: '15.0.2', // Hardcoded for now
      nodeVersion: process.version,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      environment: process.env.NODE_ENV || 'development'
    };
    
    // Get enabled features
    let enabledFeatures = [];
    try {
      const features = require('../../../config/features');
      if (features.getEnabledFeatures) {
        enabledFeatures = features.getEnabledFeatures();
      }
    } catch (err) {
      console.log('Could not load features:', err.message);
    }
    
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
        features: enabledFeatures
      }
    });
    
  } catch (error) {
    console.error('Admin overview error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch admin overview',
      details: error.message 
    });
  } finally {
    if (client) {
      await client.close();
    }
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
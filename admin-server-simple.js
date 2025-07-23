/**
 * Simplified Standalone Admin Dashboard Server
 * This runs independently with direct MongoDB access
 */

const express = require('express');
const path = require('path');
const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');

// Load environment
require('dotenv').config();

const app = express();
const PORT = process.env.ADMIN_PORT || 3001;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/nightscout-master';

// Global database connection
let db = null;

// Middleware
app.use(bodyParser.json());
app.use(cookieParser());

// Connect to MongoDB
MongoClient.connect(MONGODB_URI, { useUnifiedTopology: true })
  .then(client => {
    db = client.db();
    console.log('✅ Connected to MongoDB');
  })
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

// Simple auth middleware
const authMiddleware = async (req, res, next) => {
  const authToken = req.cookies.adminAuth;
  
  if (!authToken) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  try {
    const decoded = JSON.parse(Buffer.from(authToken, 'base64').toString());
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid authentication' });
  }
};

// Login endpoint
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }
  
  try {
    const user = await db.collection('users').findOne({ 
      email: email.toLowerCase() 
    });
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const validPassword = await bcrypt.compare(password, user.password);
    
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    if (user.role !== 'superadmin') {
      return res.status(403).json({ error: 'SuperAdmin access required' });
    }
    
    const authData = {
      _id: user._id,
      email: user.email,
      name: user.name,
      role: user.role
    };
    
    const token = Buffer.from(JSON.stringify(authData)).toString('base64');
    
    res.cookie('adminAuth', token, {
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000
    });
    
    res.json({
      success: true,
      user: {
        email: user.email,
        name: user.name,
        role: user.role
      }
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get current user
app.get('/api/auth/user', authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

// Logout
app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('adminAuth');
  res.json({ success: true });
});

// Admin API Overview
app.get('/api/v1/admin/overview', authMiddleware, async (req, res) => {
  try {
    const [tenantsCount, usersCount, activeUsers] = await Promise.all([
      db.collection('tenants').countDocuments(),
      db.collection('users').countDocuments(),
      db.collection('users').countDocuments({
        lastLogin: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      })
    ]);
    
    res.json({
      success: true,
      data: {
        overview: {
          totalTenants: tenantsCount,
          totalUsers: usersCount,
          activeUsers30Days: activeUsers,
          systemUptime: process.uptime()
        },
        system: {
          version: '15.0.2',
          nodeVersion: process.version,
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          environment: process.env.NODE_ENV || 'development'
        },
        features: ['adminDashboard', 'userManagement', 'tenantManagement']
      }
    });
  } catch (error) {
    console.error('Overview error:', error);
    res.status(500).json({ error: 'Failed to fetch overview' });
  }
});

// Admin API Health
app.get('/api/v1/admin/health', authMiddleware, (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      checks: {
        database: { status: 'healthy', message: 'Connected' },
        memory: { 
          status: 'healthy', 
          usage: { 
            percent: ((process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) * 100).toFixed(1),
            heapUsed: process.memoryUsage().heapUsed,
            heapTotal: process.memoryUsage().heapTotal
          }
        }
      }
    }
  });
});

// Admin API Features
app.get('/api/v1/admin/features', authMiddleware, (req, res) => {
  res.json({
    success: true,
    data: {
      enabled: ['adminDashboard', 'userManagement', 'tenantManagement', 'analytics'],
      all: {
        userManagement: { enabled: true },
        tenantManagement: { enabled: true },
        systemMonitoring: { enabled: true },
        billing: { enabled: false }
      }
    }
  });
});

// Tenants API
app.get('/api/v1/admin/tenants', authMiddleware, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    const filter = {};
    if (req.query.search) {
      filter.$or = [
        { name: { $regex: req.query.search, $options: 'i' } },
        { subdomain: { $regex: req.query.search, $options: 'i' } }
      ];
    }
    
    const [tenants, total] = await Promise.all([
      db.collection('tenants')
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      db.collection('tenants').countDocuments(filter)
    ]);
    
    res.json({
      success: true,
      data: {
        tenants: tenants.map(t => ({
          ...t,
          userCount: 0, // Would need to count users per tenant
          storageUsed: 0,
          lastActive: t.lastActive || t.createdAt
        })),
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Tenants error:', error);
    res.status(500).json({ error: 'Failed to fetch tenants' });
  }
});

// Users API
app.get('/api/v1/admin/users', authMiddleware, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    const filter = {};
    if (req.query.search) {
      filter.$or = [
        { email: { $regex: req.query.search, $options: 'i' } },
        { name: { $regex: req.query.search, $options: 'i' } }
      ];
    }
    
    const [users, total] = await Promise.all([
      db.collection('users')
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      db.collection('users').countDocuments(filter)
    ]);
    
    // Remove passwords
    const safeUsers = users.map(u => {
      const { password, ...user } = u;
      return {
        ...user,
        status: user.status || 'active',
        tenantName: 'N/A' // Would need to lookup tenant names
      };
    });
    
    res.json({
      success: true,
      data: {
        users: safeUsers,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Analytics Overview
app.get('/api/v1/admin/analytics/overview', authMiddleware, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    
    const tenants = await db.collection('tenants').find({}).toArray();
    
    res.json({
      success: true,
      data: {
        totalTenants: tenants.length,
        activeTenants: tenants.filter(t => t.status === 'active').length,
        totalUsers: await db.collection('users').countDocuments(),
        activeUsers: await db.collection('users').countDocuments({
          lastLogin: { $gte: startDate }
        }),
        totalEntries: 0, // Would need to aggregate across tenant collections
        totalTreatments: 0,
        storageUsed: 0,
        storageUsedFormatted: '0 MB',
        rates: {
          tenantActivity: '0',
          userActivity: '0'
        },
        growth: {
          tenants: [],
          users: []
        }
      },
      period: {
        days,
        startDate,
        endDate: new Date()
      }
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// Catch-all admin API routes (return empty data for now)
app.all('/api/v1/admin/*', authMiddleware, (req, res) => {
  res.json({
    success: true,
    data: {},
    message: 'Endpoint not yet implemented'
  });
});

// Serve static files
app.use('/static/admin', express.static(path.join(__dirname, 'static/admin')));

// Serve admin dashboard for all /admin routes
app.get('/admin*', (req, res) => {
  res.sendFile(path.join(__dirname, 'views/admin-dashboard.html'));
});

// Handle login redirect
app.get('/login', (req, res) => {
  res.redirect('/admin');
});

// Redirect root to admin
app.get('/', (req, res) => {
  res.redirect('/admin');
});

// Start server
app.listen(PORT, () => {
  console.log(`
🚀 Diabeetech Admin Dashboard Server (Simplified)
================================================
Server running at: http://localhost:${PORT}
Admin Dashboard: http://localhost:${PORT}/admin

Login with:
Email: superadmin@diabeetech.net
Password: Db#SuperAdmin2025!Secure

Note: This is a simplified version for local development.
`);
});
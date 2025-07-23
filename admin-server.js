/**
 * Standalone Admin Dashboard Server
 * This runs the admin dashboard independently from the main Nightscout app
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

// Middleware
app.use(bodyParser.json());
app.use(cookieParser());

// Simple auth middleware
const authMiddleware = async (req, res, next) => {
  // For testing, we'll use a simple session approach
  const authToken = req.cookies.adminAuth;
  
  if (!authToken) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  // Decode the token (in production, use proper JWT)
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
  
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    const db = client.db();
    
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
    
    // Create simple auth token
    const authData = {
      _id: user._id,
      email: user.email,
      name: user.name,
      role: user.role
    };
    
    const token = Buffer.from(JSON.stringify(authData)).toString('base64');
    
    res.cookie('adminAuth', token, {
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
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
  } finally {
    await client.close();
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

// Create a minimal context for the admin API
const ctx = {
  env: {
    storageSupport: null, // Will be set below
    version: '15.0.2',
    head: 'development',
    name: 'Diabeetech'
  }
};

// Initialize MongoDB connection for the API
let db = null;
MongoClient.connect(MONGODB_URI, { useUnifiedTopology: true }).then(client => {
  db = client.db();
  ctx.env.storageSupport = { db };
  console.log('✅ Connected to MongoDB for API');
}).catch(err => {
  console.error('❌ MongoDB connection error:', err);
});

// Set up app context
app.set('ctx', ctx);

// Override the features module for standalone mode
require.cache[require.resolve('./config/features')] = require.cache[require.resolve('./config/features-standalone')];

// Mount admin API routes
app.use('/api/v1/admin', authMiddleware, (req, res, next) => {
  // Ensure database is connected
  if (!db) {
    return res.status(503).json({ error: 'Database not ready' });
  }
  next();
}, require('./lib/api/admin'));

// Serve static files
app.use('/static/admin', express.static(path.join(__dirname, 'static/admin')));

// Serve admin dashboard for all /admin routes
app.get('/admin*', (req, res) => {
  res.sendFile(path.join(__dirname, 'views/admin-dashboard.html'));
});

// Handle login page request (redirect to admin, SPA will show login)
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
🚀 Diabeetech Admin Dashboard Server
====================================
Server running at: http://localhost:${PORT}
Admin Dashboard: http://localhost:${PORT}/admin

Login with:
Email: superadmin@diabeetech.net
Password: Db#SuperAdmin2025!Secure

Note: Make sure MongoDB is running!
`);
});
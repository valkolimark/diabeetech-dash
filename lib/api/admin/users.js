'use strict';

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { MongoClient, ObjectId } = require('mongodb');

// Helper function to get database connection
async function getDbConnection() {
  const mongoUri = process.env.MASTER_MONGODB_URI || process.env.MONGODB_URI || process.env.MONGO_CONNECTION || process.env.MONGOLAB_URI;
  
  if (!mongoUri) {
    throw new Error('Database connection not configured');
  }
  
  const client = new MongoClient(mongoUri, { useUnifiedTopology: true });
  await client.connect();
  return { client, db: client.db() };
}

// GET /api/v1/admin/users - List all users with pagination
router.get('/', async function(req, res) {
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
    
    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    // Build filter
    const filter = {};
    
    // Search filter
    if (req.query.search) {
      filter.$or = [
        { email: { $regex: req.query.search, $options: 'i' } },
        { name: { $regex: req.query.search, $options: 'i' } },
        { username: { $regex: req.query.search, $options: 'i' } }
      ];
    }
    
    // Tenant filter
    if (req.query.tenant) {
      filter.tenant = req.query.tenant;
    }
    
    // Role filter
    if (req.query.role) {
      filter.role = req.query.role;
    }
    
    // Status filter
    if (req.query.status) {
      filter.status = req.query.status;
    }
    
    // Get users with count
    const [users, total] = await Promise.all([
      db.collection('users')
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      db.collection('users').countDocuments(filter)
    ]);
    
    // Get tenant names
    const tenantIds = [...new Set(users.map(u => u.tenant).filter(Boolean))];
    const tenants = await db.collection('tenants')
      .find({ _id: { $in: tenantIds } })
      .toArray();
    
    const tenantMap = {};
    tenants.forEach(t => {
      tenantMap[t._id] = t.name;
    });
    
    // Enhance user data (remove sensitive info)
    const enhancedUsers = users.map(user => ({
      _id: user._id,
      email: user.email,
      name: user.name || user.username,
      role: user.role,
      tenant: user.tenant,
      tenantName: tenantMap[user.tenant] || 'N/A',
      status: user.status || 'active',
      lastLogin: user.lastLogin,
      createdAt: user.createdAt,
      twoFactorEnabled: !!user.twoFactorSecret
    }));
    
    res.json({
      success: true,
      data: {
        users: enhancedUsers,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
    
  } catch (error) {
    console.error('List users error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch users',
      details: error.message 
    });
  } finally {
    if (client) {
      await client.close();
    }
  }
});

// GET /api/v1/admin/users/:id - Get single user details
router.get('/:id', async function(req, res) {
  let client;
  
  try {
    const userId = req.params.id;
    const { client: dbClient, db } = await getDbConnection();
    client = dbClient;
    
    // Try to find user by ID - handle both string and ObjectId formats
    let user = await db.collection('users').findOne({ _id: userId });
    
    // If not found as string, try as ObjectId if it's a valid ObjectId format
    if (!user && ObjectId.isValid(userId) && userId.match(/^[0-9a-fA-F]{24}$/)) {
      user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
    }
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        error: 'User not found' 
      });
    }
    
    // Get tenant info
    let tenant = null;
    if (user.tenant) {
      tenant = await db.collection('tenants')
        .findOne({ _id: user.tenant });
    }
    
    // Get user activity stats
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const activityCount = await db.collection('admin_audit')
      .countDocuments({
        user: userId,
        timestamp: { $gte: thirtyDaysAgo }
      });
    
    // Remove sensitive data
    delete user.password;
    delete user.twoFactorSecret;
    
    res.json({
      success: true,
      data: {
        user: {
          ...user,
          tenantName: tenant?.name || 'N/A'
        },
        stats: {
          activityLast30Days: activityCount,
          lastPasswordChange: user.passwordChangedAt,
          accountAge: Math.floor((Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24))
        }
      }
    });
    
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch user details' 
    });
  } finally {
    if (client) {
      await client.close();
    }
  }
});

// POST /api/v1/admin/users - Create new user
router.post('/', async function(req, res) {
  let client;
  
  try {
    const { client: dbClient, db } = await getDbConnection();
    client = dbClient;
    
    const { email, password, name, role, tenant } = req.body;
    
    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        error: 'Email and password are required' 
      });
    }
    
    // Check email uniqueness
    const existing = await db.collection('users')
      .findOne({ email: email.toLowerCase() });
    
    if (existing) {
      return res.status(409).json({ 
        success: false, 
        error: 'Email already exists' 
      });
    }
    
    // Validate tenant exists
    if (tenant) {
      const tenantExists = await db.collection('tenants')
        .findOne({ _id: tenant });
      
      if (!tenantExists) {
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid tenant ID' 
        });
      }
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create user
    const user = {
      _id: uuidv4(),
      email: email.toLowerCase(),
      password: hashedPassword,
      name: name || email.split('@')[0],
      username: email.toLowerCase(),
      role: role || 'user',
      tenant: tenant || null,
      status: 'active',
      createdAt: new Date(),
      createdBy: req.user._id,
      emailVerified: true // Admin-created users are pre-verified
    };
    
    await db.collection('users').insertOne(user);
    
    // Log admin action
    await db.collection('admin_audit').insertOne({
      action: 'user.create',
      user: req.user._id,
      userEmail: req.user.email,
      target: user._id,
      details: { email: user.email, role: user.role },
      timestamp: new Date()
    });
    
    // Remove password from response
    delete user.password;
    
    res.status(201).json({
      success: true,
      data: user
    });
    
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to create user' 
    });
  } finally {
    if (client) {
      await client.close();
    }
  }
});

// PUT /api/v1/admin/users/:id - Update user
router.put('/:id', async function(req, res) {
  let client;
  
  try {
    const { client: dbClient, db } = await getDbConnection();
    client = dbClient;
    const userId = req.params.id;
    
    const { email, name, role, status, tenant } = req.body;
    
    // Build update object
    const update = {
      updatedAt: new Date(),
      updatedBy: req.user._id
    };
    
    if (email) {
      // Check email uniqueness
      const existing = await db.collection('users')
        .findOne({ email: email.toLowerCase(), _id: { $ne: userId } });
      
      if (existing) {
        return res.status(409).json({ 
          success: false, 
          error: 'Email already exists' 
        });
      }
      
      update.email = email.toLowerCase();
      update.username = email.toLowerCase();
    }
    
    if (name !== undefined) update.name = name;
    if (role) update.role = role;
    if (status) update.status = status;
    if (tenant !== undefined) {
      // Validate tenant
      if (tenant && !(await db.collection('tenants').findOne({ _id: tenant }))) {
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid tenant ID' 
        });
      }
      update.tenant = tenant;
    }
    
    const result = await db.collection('users')
      .updateOne(
        { _id: userId },
        { $set: update }
      );
    
    if (result.matchedCount === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'User not found' 
      });
    }
    
    // Log admin action
    await db.collection('admin_audit').insertOne({
      action: 'user.update',
      user: req.user._id,
      userEmail: req.user.email,
      target: userId,
      details: update,
      timestamp: new Date()
    });
    
    res.json({
      success: true,
      message: 'User updated successfully'
    });
    
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update user' 
    });
  } finally {
    if (client) {
      await client.close();
    }
  }
});

// DELETE /api/v1/admin/users/:id - Delete user
router.delete('/:id', async function(req, res) {
  const { MongoClient, ObjectId } = require('mongodb');
  let client;
  
  try {
    const userId = req.params.id;
    
    // Prevent self-deletion
    if (userId === req.user._id || userId === req.user.id) {
      return res.status(400).json({ 
        success: false, 
        error: 'Cannot delete your own account' 
      });
    }
    
    // Connect to master database
    const mongoUri = process.env.MASTER_MONGODB_URI || process.env.MONGODB_URI || process.env.MONGO_CONNECTION || process.env.MONGOLAB_URI;
    
    if (!mongoUri) {
      return res.status(500).json({ error: 'Database connection not configured' });
    }
    
    client = new MongoClient(mongoUri, { useUnifiedTopology: true });
    await client.connect();
    const db = client.db();
    
    // Try to find user by ID - handle both string and ObjectId formats
    let user = await db.collection('users').findOne({ _id: userId });
    
    // If not found as string, try as ObjectId if it's a valid ObjectId format
    if (!user && ObjectId.isValid(userId) && userId.match(/^[0-9a-fA-F]{24}$/)) {
      user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
    }
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        error: 'User not found' 
      });
    }
    
    // Delete user - use the actual _id from the found user
    await db.collection('users').deleteOne({ _id: user._id });
    
    // Log admin action
    await db.collection('admin_audit').insertOne({
      action: 'user.delete',
      user: req.user._id || req.user.id,
      userEmail: req.user.email,
      target: user._id,
      details: { email: user.email },
      timestamp: new Date()
    });
    
    res.json({
      success: true,
      message: 'User deleted successfully'
    });
    
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to delete user',
      details: error.message 
    });
  } finally {
    if (client) {
      await client.close();
    }
  }
});

// POST /api/v1/admin/users/:id/reset-password - Reset user password
router.post('/:id/reset-password', async function(req, res) {
  let client;
  
  try {
    const { client: dbClient, db } = await getDbConnection();
    client = dbClient;
    const userId = req.params.id;
    const { password } = req.body;
    
    if (!password || password.length < 8) {
      return res.status(400).json({ 
        success: false, 
        error: 'Password must be at least 8 characters' 
      });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const result = await db.collection('users')
      .updateOne(
        { _id: userId },
        { 
          $set: { 
            password: hashedPassword,
            passwordChangedAt: new Date(),
            passwordChangedBy: req.user._id
          } 
        }
      );
    
    if (result.matchedCount === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'User not found' 
      });
    }
    
    // Log admin action
    await db.collection('admin_audit').insertOne({
      action: 'user.password-reset',
      user: req.user._id,
      userEmail: req.user.email,
      target: userId,
      timestamp: new Date()
    });
    
    res.json({
      success: true,
      message: 'Password reset successfully'
    });
    
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to reset password' 
    });
  } finally {
    if (client) {
      await client.close();
    }
  }
});

// POST /api/v1/admin/users/:id/disable-2fa - Disable 2FA for user
router.post('/:id/disable-2fa', async function(req, res) {
  let client;
  
  try {
    const { client: dbClient, db } = await getDbConnection();
    client = dbClient;
    const userId = req.params.id;
    
    const result = await db.collection('users')
      .updateOne(
        { _id: userId },
        { 
          $unset: { 
            twoFactorSecret: '',
            twoFactorEnabled: ''
          } 
        }
      );
    
    if (result.matchedCount === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'User not found' 
      });
    }
    
    // Log admin action
    await db.collection('admin_audit').insertOne({
      action: 'user.2fa-disable',
      user: req.user._id,
      userEmail: req.user.email,
      target: userId,
      timestamp: new Date()
    });
    
    res.json({
      success: true,
      message: '2FA disabled successfully'
    });
    
  } catch (error) {
    console.error('Disable 2FA error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to disable 2FA' 
    });
  } finally {
    if (client) {
      await client.close();
    }
  }
});

// POST /api/v1/admin/users/bulk - Bulk operations
router.post('/bulk', async function(req, res) {
  let client;
  
  try {
    const { client: dbClient, db } = await getDbConnection();
    client = dbClient;
    const { action, userIds, data } = req.body;
    
    if (!action || !userIds || !Array.isArray(userIds)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Action and userIds array are required' 
      });
    }
    
    let result;
    
    switch (action) {
      case 'delete':
        // Prevent self-deletion
        const filteredIds = userIds.filter(id => id !== req.user._id);
        result = await db.collection('users')
          .deleteMany({ _id: { $in: filteredIds } });
        break;
        
      case 'suspend':
        result = await db.collection('users')
          .updateMany(
            { _id: { $in: userIds } },
            { $set: { status: 'suspended', suspendedAt: new Date() } }
          );
        break;
        
      case 'activate':
        result = await db.collection('users')
          .updateMany(
            { _id: { $in: userIds } },
            { $set: { status: 'active' }, $unset: { suspendedAt: '' } }
          );
        break;
        
      case 'change-role':
        if (!data?.role) {
          return res.status(400).json({ 
            success: false, 
            error: 'Role is required for change-role action' 
          });
        }
        result = await db.collection('users')
          .updateMany(
            { _id: { $in: userIds } },
            { $set: { role: data.role } }
          );
        break;
        
      case 'change-tenant':
        if (data?.tenant && !(await db.collection('tenants').findOne({ _id: data.tenant }))) {
          return res.status(400).json({ 
            success: false, 
            error: 'Invalid tenant ID' 
          });
        }
        result = await db.collection('users')
          .updateMany(
            { _id: { $in: userIds } },
            { $set: { tenant: data.tenant || null } }
          );
        break;
        
      default:
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid bulk action' 
        });
    }
    
    // Log admin action
    await db.collection('admin_audit').insertOne({
      action: `user.bulk-${action}`,
      user: req.user._id,
      userEmail: req.user.email,
      target: userIds,
      details: data,
      timestamp: new Date()
    });
    
    res.json({
      success: true,
      message: `Bulk ${action} completed`,
      affected: result.modifiedCount || result.deletedCount || 0
    });
    
  } catch (error) {
    console.error('Bulk operation error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to perform bulk operation' 
    });
  } finally {
    if (client) {
      await client.close();
    }
  }
});

module.exports = router;
'use strict';

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');

// GET /api/v1/admin/tenants - List all tenants with pagination
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
    
    // Search filter
    const search = req.query.search || '';
    const filter = {};
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { subdomain: { $regex: search, $options: 'i' } },
        { 'owner.email': { $regex: search, $options: 'i' } }
      ];
    }
    
    // Status filter
    if (req.query.status) {
      filter.status = req.query.status;
    }
    
    // Get tenants with count
    const [tenants, total] = await Promise.all([
      db.collection('tenants')
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      db.collection('tenants').countDocuments(filter)
    ]);
    
    // Get user counts for each tenant
    const tenantIds = tenants.map(t => t._id);
    const userCounts = await db.collection('users')
      .aggregate([
        { $match: { tenant: { $in: tenantIds } } },
        { $group: { _id: '$tenant', count: { $sum: 1 } } }
      ])
      .toArray();
    
    // Map user counts to tenants
    const userCountMap = {};
    userCounts.forEach(uc => {
      userCountMap[uc._id] = uc.count;
    });
    
    // Enhance tenant data
    const enhancedTenants = tenants.map(tenant => ({
      ...tenant,
      userCount: userCountMap[tenant._id] || 0,
      storageUsed: tenant.storageUsed || 0,
      lastActive: tenant.lastActive || tenant.createdAt
    }));
    
    res.json({
      success: true,
      data: {
        tenants: enhancedTenants,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
    
  } catch (error) {
    console.error('List tenants error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch tenants',
      details: error.message 
    });
  } finally {
    if (client) {
      await client.close();
    }
  }
});

// GET /api/v1/admin/tenants/:id - Get single tenant details
router.get('/:id', async function(req, res) {
  try {
    const ctx = req.app.get('ctx');
    const store = ctx.env.storageSupport;
    const tenantId = req.params.id;
    
    // Get tenant
    const tenant = await store.db.collection('tenants')
      .findOne({ _id: tenantId });
    
    if (!tenant) {
      return res.status(404).json({ 
        success: false, 
        error: 'Tenant not found' 
      });
    }
    
    // Get additional stats
    const [userCount, devicestatusCount, treatmentsCount, entriesCount] = await Promise.all([
      store.db.collection('users').countDocuments({ tenant: tenantId }),
      store.db.collection(`devicestatus_${tenantId}`).countDocuments(),
      store.db.collection(`treatments_${tenantId}`).countDocuments(),
      store.db.collection(`entries_${tenantId}`).countDocuments()
    ]);
    
    // Get recent activity
    const recentUsers = await store.db.collection('users')
      .find({ tenant: tenantId })
      .sort({ lastLogin: -1 })
      .limit(5)
      .toArray();
    
    res.json({
      success: true,
      data: {
        tenant,
        stats: {
          users: userCount,
          deviceStatus: devicestatusCount,
          treatments: treatmentsCount,
          entries: entriesCount
        },
        recentUsers
      }
    });
    
  } catch (error) {
    console.error('Get tenant error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch tenant details' 
    });
  }
});

// POST /api/v1/admin/tenants - Create new tenant
router.post('/', async function(req, res) {
  try {
    const ctx = req.app.get('ctx');
    const store = ctx.env.storageSupport;
    
    const { name, subdomain, owner, settings } = req.body;
    
    // Validate required fields
    if (!name || !subdomain || !owner?.email) {
      return res.status(400).json({ 
        success: false, 
        error: 'Name, subdomain, and owner email are required' 
      });
    }
    
    // Check subdomain uniqueness
    const existing = await store.db.collection('tenants')
      .findOne({ subdomain: subdomain.toLowerCase() });
    
    if (existing) {
      return res.status(409).json({ 
        success: false, 
        error: 'Subdomain already exists' 
      });
    }
    
    // Create tenant
    const tenant = {
      _id: uuidv4(),
      name,
      subdomain: subdomain.toLowerCase(),
      owner: {
        name: owner.name || '',
        email: owner.email.toLowerCase(),
        phone: owner.phone || ''
      },
      settings: {
        ...settings,
        features: settings?.features || ['cgm', 'careportal', 'reports'],
        limits: {
          users: settings?.limits?.users || 10,
          storage: settings?.limits?.storage || 1024 * 1024 * 100 // 100MB
        }
      },
      status: 'active',
      createdAt: new Date(),
      createdBy: req.user._id,
      lastActive: new Date()
    };
    
    await store.db.collection('tenants').insertOne(tenant);
    
    // Create tenant-specific collections
    const collections = ['entries', 'treatments', 'devicestatus', 'profile', 'food'];
    for (const collection of collections) {
      await store.db.createCollection(`${collection}_${tenant._id}`);
      // Create indexes
      if (collection === 'entries' || collection === 'treatments') {
        await store.db.collection(`${collection}_${tenant._id}`)
          .createIndex({ date: -1 });
      }
    }
    
    // Log admin action
    await store.db.collection('admin_audit').insertOne({
      action: 'tenant.create',
      user: req.user._id,
      userEmail: req.user.email,
      target: tenant._id,
      details: { name: tenant.name, subdomain: tenant.subdomain },
      timestamp: new Date()
    });
    
    res.status(201).json({
      success: true,
      data: tenant
    });
    
  } catch (error) {
    console.error('Create tenant error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to create tenant' 
    });
  }
});

// PUT /api/v1/admin/tenants/:id - Update tenant
router.put('/:id', async function(req, res) {
  try {
    const ctx = req.app.get('ctx');
    const store = ctx.env.storageSupport;
    const tenantId = req.params.id;
    
    const { name, settings, status, owner } = req.body;
    
    // Build update object
    const update = {
      updatedAt: new Date(),
      updatedBy: req.user._id
    };
    
    if (name) update.name = name;
    if (status) update.status = status;
    if (owner) {
      update['owner.name'] = owner.name || '';
      update['owner.email'] = owner.email?.toLowerCase();
      update['owner.phone'] = owner.phone || '';
    }
    if (settings) {
      if (settings.features) update['settings.features'] = settings.features;
      if (settings.limits) {
        update['settings.limits.users'] = settings.limits.users;
        update['settings.limits.storage'] = settings.limits.storage;
      }
    }
    
    const result = await store.db.collection('tenants')
      .updateOne(
        { _id: tenantId },
        { $set: update }
      );
    
    if (result.matchedCount === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Tenant not found' 
      });
    }
    
    // Log admin action
    await store.db.collection('admin_audit').insertOne({
      action: 'tenant.update',
      user: req.user._id,
      userEmail: req.user.email,
      target: tenantId,
      details: update,
      timestamp: new Date()
    });
    
    res.json({
      success: true,
      message: 'Tenant updated successfully'
    });
    
  } catch (error) {
    console.error('Update tenant error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update tenant' 
    });
  }
});

// DELETE /api/v1/admin/tenants/:id - Delete tenant
router.delete('/:id', async function(req, res) {
  try {
    const ctx = req.app.get('ctx');
    const store = ctx.env.storageSupport;
    const tenantId = req.params.id;
    
    // Check if tenant exists
    const tenant = await store.db.collection('tenants')
      .findOne({ _id: tenantId });
    
    if (!tenant) {
      return res.status(404).json({ 
        success: false, 
        error: 'Tenant not found' 
      });
    }
    
    // Confirm deletion with query param
    if (req.query.confirm !== 'true') {
      return res.status(400).json({ 
        success: false, 
        error: 'Deletion must be confirmed with ?confirm=true' 
      });
    }
    
    // Delete all tenant data
    const collections = ['entries', 'treatments', 'devicestatus', 'profile', 'food'];
    for (const collection of collections) {
      try {
        await store.db.collection(`${collection}_${tenantId}`).drop();
      } catch (e) {
        // Collection might not exist
      }
    }
    
    // Delete tenant users
    await store.db.collection('users').deleteMany({ tenant: tenantId });
    
    // Delete tenant
    await store.db.collection('tenants').deleteOne({ _id: tenantId });
    
    // Log admin action
    await store.db.collection('admin_audit').insertOne({
      action: 'tenant.delete',
      user: req.user._id,
      userEmail: req.user.email,
      target: tenantId,
      details: { name: tenant.name, subdomain: tenant.subdomain },
      timestamp: new Date()
    });
    
    res.json({
      success: true,
      message: 'Tenant deleted successfully'
    });
    
  } catch (error) {
    console.error('Delete tenant error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to delete tenant' 
    });
  }
});

// POST /api/v1/admin/tenants/:id/suspend - Suspend tenant
router.post('/:id/suspend', async function(req, res) {
  try {
    const ctx = req.app.get('ctx');
    const store = ctx.env.storageSupport;
    const tenantId = req.params.id;
    
    const result = await store.db.collection('tenants')
      .updateOne(
        { _id: tenantId },
        { 
          $set: { 
            status: 'suspended',
            suspendedAt: new Date(),
            suspendedBy: req.user._id,
            suspendReason: req.body.reason || 'Administrative action'
          } 
        }
      );
    
    if (result.matchedCount === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Tenant not found' 
      });
    }
    
    // Log admin action
    await store.db.collection('admin_audit').insertOne({
      action: 'tenant.suspend',
      user: req.user._id,
      userEmail: req.user.email,
      target: tenantId,
      details: { reason: req.body.reason },
      timestamp: new Date()
    });
    
    res.json({
      success: true,
      message: 'Tenant suspended successfully'
    });
    
  } catch (error) {
    console.error('Suspend tenant error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to suspend tenant' 
    });
  }
});

// POST /api/v1/admin/tenants/:id/activate - Activate tenant
router.post('/:id/activate', async function(req, res) {
  try {
    const ctx = req.app.get('ctx');
    const store = ctx.env.storageSupport;
    const tenantId = req.params.id;
    
    const result = await store.db.collection('tenants')
      .updateOne(
        { _id: tenantId },
        { 
          $set: { 
            status: 'active',
            activatedAt: new Date(),
            activatedBy: req.user._id
          },
          $unset: {
            suspendedAt: '',
            suspendedBy: '',
            suspendReason: ''
          }
        }
      );
    
    if (result.matchedCount === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Tenant not found' 
      });
    }
    
    // Log admin action
    await store.db.collection('admin_audit').insertOne({
      action: 'tenant.activate',
      user: req.user._id,
      userEmail: req.user.email,
      target: tenantId,
      timestamp: new Date()
    });
    
    res.json({
      success: true,
      message: 'Tenant activated successfully'
    });
    
  } catch (error) {
    console.error('Activate tenant error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to activate tenant' 
    });
  }
});

// GET /api/v1/admin/tenants/:id/users - Get tenant's users
router.get('/:id/users', async function(req, res) {
  const { MongoClient } = require('mongodb');
  let client;
  
  try {
    const mongoUri = process.env.MASTER_MONGODB_URI || process.env.MONGODB_URI || process.env.MONGO_CONNECTION || process.env.MONGOLAB_URI;
    
    if (!mongoUri) {
      return res.status(500).json({ error: 'Database connection not configured' });
    }
    
    client = new MongoClient(mongoUri, { useUnifiedTopology: true });
    await client.connect();
    const db = client.db();
    
    const tenantId = req.params.id;
    
    // Verify tenant exists
    const tenant = await db.collection('tenants').findOne({ _id: tenantId });
    if (!tenant) {
      return res.status(404).json({ 
        success: false, 
        error: 'Tenant not found' 
      });
    }
    
    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    // Get users
    const [users, total] = await Promise.all([
      db.collection('users')
        .find({ tenant: tenantId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      db.collection('users').countDocuments({ tenant: tenantId })
    ]);
    
    // Remove sensitive data
    const sanitizedUsers = users.map(user => ({
      _id: user._id,
      email: user.email,
      name: user.name || user.username,
      role: user.role,
      status: user.status || 'active',
      lastLogin: user.lastLogin,
      createdAt: user.createdAt,
      twoFactorEnabled: !!user.twoFactorSecret
    }));
    
    res.json({
      success: true,
      data: {
        tenant: {
          _id: tenant._id,
          name: tenant.name,
          subdomain: tenant.subdomain
        },
        users: sanitizedUsers,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
    
  } catch (error) {
    console.error('Get tenant users error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch tenant users',
      details: error.message 
    });
  } finally {
    if (client) {
      await client.close();
    }
  }
});

// GET /api/v1/admin/tenants/:id/stats - Get detailed tenant statistics
router.get('/:id/stats', async function(req, res) {
  const { MongoClient } = require('mongodb');
  let client;
  
  try {
    const mongoUri = process.env.MASTER_MONGODB_URI || process.env.MONGODB_URI || process.env.MONGO_CONNECTION || process.env.MONGOLAB_URI;
    
    if (!mongoUri) {
      return res.status(500).json({ error: 'Database connection not configured' });
    }
    
    client = new MongoClient(mongoUri, { useUnifiedTopology: true });
    await client.connect();
    const db = client.db();
    
    const tenantId = req.params.id;
    const days = parseInt(req.query.days) || 30;
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    
    // Get tenant
    const tenant = await db.collection('tenants').findOne({ _id: tenantId });
    if (!tenant) {
      return res.status(404).json({ 
        success: false, 
        error: 'Tenant not found' 
      });
    }
    
    // Get various statistics
    const [
      userCount,
      activeUsers,
      devicestatusCount,
      treatmentsCount,
      entriesCount,
      profileCount,
      foodCount,
      storageUsage,
      recentActivity
    ] = await Promise.all([
      // Total users
      db.collection('users').countDocuments({ tenant: tenantId }),
      
      // Active users (30 days)
      db.collection('users').countDocuments({ 
        tenant: tenantId,
        lastLogin: { $gte: startDate }
      }),
      
      // Collection counts
      db.collection(`devicestatus_${tenantId}`).estimatedDocumentCount().catch(() => 0),
      db.collection(`treatments_${tenantId}`).estimatedDocumentCount().catch(() => 0),
      db.collection(`entries_${tenantId}`).estimatedDocumentCount().catch(() => 0),
      db.collection(`profile_${tenantId}`).estimatedDocumentCount().catch(() => 0),
      db.collection(`food_${tenantId}`).estimatedDocumentCount().catch(() => 0),
      
      // Calculate storage usage (approximate)
      Promise.all([
        db.collection(`entries_${tenantId}`).stats().catch(() => ({ size: 0 })),
        db.collection(`treatments_${tenantId}`).stats().catch(() => ({ size: 0 })),
        db.collection(`devicestatus_${tenantId}`).stats().catch(() => ({ size: 0 }))
      ]).then(stats => {
        const totalBytes = stats.reduce((sum, stat) => sum + (stat.size || 0), 0);
        return {
          bytes: totalBytes,
          formatted: formatBytes(totalBytes)
        };
      }),
      
      // Recent activity count
      db.collection('admin_audit').countDocuments({
        target: tenantId,
        timestamp: { $gte: startDate }
      })
    ]);
    
    // Get growth data
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const newUsers = await db.collection('users').countDocuments({
      tenant: tenantId,
      createdAt: { $gte: oneWeekAgo }
    });
    
    // Get last data entry times
    const lastEntry = await db.collection(`entries_${tenantId}`)
      .findOne({}, { sort: { date: -1 } })
      .catch(() => null);
    
    const lastTreatment = await db.collection(`treatments_${tenantId}`)
      .findOne({}, { sort: { created_at: -1 } })
      .catch(() => null);
    
    res.json({
      success: true,
      data: {
        users: {
          total: userCount,
          active: activeUsers,
          inactive: userCount - activeUsers,
          newThisWeek: newUsers,
          limit: tenant.settings?.limits?.users || 10,
          percentUsed: Math.round((userCount / (tenant.settings?.limits?.users || 10)) * 100)
        },
        data: {
          entries: entriesCount,
          treatments: treatmentsCount,
          devicestatus: devicestatusCount,
          profiles: profileCount,
          foods: foodCount,
          total: entriesCount + treatmentsCount + devicestatusCount + profileCount + foodCount
        },
        storage: {
          used: storageUsage.bytes,
          formatted: storageUsage.formatted,
          limit: tenant.settings?.limits?.storage || 104857600, // 100MB default
          percentUsed: Math.round((storageUsage.bytes / (tenant.settings?.limits?.storage || 104857600)) * 100)
        },
        activity: {
          recentActions: recentActivity,
          lastDataEntry: lastEntry?.date || null,
          lastTreatment: lastTreatment?.created_at || null,
          daysActive: tenant.createdAt ? Math.floor((Date.now() - new Date(tenant.createdAt).getTime()) / (1000 * 60 * 60 * 24)) : 0
        },
        features: tenant.settings?.features || [],
        status: tenant.status
      }
    });
    
  } catch (error) {
    console.error('Get tenant stats error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch tenant statistics',
      details: error.message 
    });
  } finally {
    if (client) {
      await client.close();
    }
  }
});

// GET /api/v1/admin/tenants/:id/activity - Get tenant activity log
router.get('/:id/activity', async function(req, res) {
  const { MongoClient } = require('mongodb');
  let client;
  
  try {
    const mongoUri = process.env.MASTER_MONGODB_URI || process.env.MONGODB_URI || process.env.MONGO_CONNECTION || process.env.MONGOLAB_URI;
    
    if (!mongoUri) {
      return res.status(500).json({ error: 'Database connection not configured' });
    }
    
    client = new MongoClient(mongoUri, { useUnifiedTopology: true });
    await client.connect();
    const db = client.db();
    
    const tenantId = req.params.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;
    
    // Build filter
    const filter = { 
      $or: [
        { target: tenantId },
        { 'details.tenant': tenantId },
        { 'details.tenantId': tenantId }
      ]
    };
    
    if (req.query.action) {
      filter.action = { $regex: req.query.action, $options: 'i' };
    }
    
    if (req.query.startDate || req.query.endDate) {
      filter.timestamp = {};
      if (req.query.startDate) {
        filter.timestamp.$gte = new Date(req.query.startDate);
      }
      if (req.query.endDate) {
        filter.timestamp.$lte = new Date(req.query.endDate);
      }
    }
    
    // Get activities
    const [activities, total] = await Promise.all([
      db.collection('admin_audit')
        .find(filter)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      db.collection('admin_audit').countDocuments(filter)
    ]);
    
    res.json({
      success: true,
      data: {
        activities,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
    
  } catch (error) {
    console.error('Get tenant activity error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch tenant activity',
      details: error.message 
    });
  } finally {
    if (client) {
      await client.close();
    }
  }
});

// POST /api/v1/admin/tenants/check-subdomain - Check subdomain availability
router.post('/check-subdomain', async function(req, res) {
  const { MongoClient } = require('mongodb');
  let client;
  
  try {
    const mongoUri = process.env.MASTER_MONGODB_URI || process.env.MONGODB_URI || process.env.MONGO_CONNECTION || process.env.MONGOLAB_URI;
    
    if (!mongoUri) {
      return res.status(500).json({ error: 'Database connection not configured' });
    }
    
    client = new MongoClient(mongoUri, { useUnifiedTopology: true });
    await client.connect();
    const db = client.db();
    
    const { subdomain } = req.body;
    
    if (!subdomain) {
      return res.status(400).json({ 
        success: false, 
        error: 'Subdomain is required' 
      });
    }
    
    // Validate subdomain format
    const subdomainRegex = /^[a-z0-9][a-z0-9-]{2,30}[a-z0-9]$/;
    if (!subdomainRegex.test(subdomain.toLowerCase())) {
      return res.json({
        success: true,
        available: false,
        reason: 'Invalid format. Use 4-32 lowercase letters, numbers, and hyphens (not at start/end).'
      });
    }
    
    // Check if subdomain exists
    const existing = await db.collection('tenants').findOne({ 
      subdomain: subdomain.toLowerCase() 
    });
    
    res.json({
      success: true,
      available: !existing,
      reason: existing ? 'Subdomain already taken' : null
    });
    
  } catch (error) {
    console.error('Check subdomain error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to check subdomain availability',
      details: error.message 
    });
  } finally {
    if (client) {
      await client.close();
    }
  }
});

// POST /api/v1/admin/tenants/bulk - Bulk operations
router.post('/bulk', async function(req, res) {
  const { MongoClient } = require('mongodb');
  let client;
  
  try {
    const mongoUri = process.env.MASTER_MONGODB_URI || process.env.MONGODB_URI || process.env.MONGO_CONNECTION || process.env.MONGOLAB_URI;
    
    if (!mongoUri) {
      return res.status(500).json({ error: 'Database connection not configured' });
    }
    
    client = new MongoClient(mongoUri, { useUnifiedTopology: true });
    await client.connect();
    const db = client.db();
    
    const { action, tenantIds, data } = req.body;
    
    if (!action || !tenantIds || !Array.isArray(tenantIds)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Action and tenantIds array are required' 
      });
    }
    
    let result;
    const timestamp = new Date();
    
    switch (action) {
      case 'delete':
        // Delete tenants and their data
        for (const tenantId of tenantIds) {
          const collections = ['entries', 'treatments', 'devicestatus', 'profile', 'food'];
          for (const collection of collections) {
            try {
              await db.collection(`${collection}_${tenantId}`).drop();
            } catch (e) {
              // Collection might not exist
            }
          }
          
          // Delete tenant users
          await db.collection('users').deleteMany({ tenant: tenantId });
        }
        
        // Delete tenants
        result = await db.collection('tenants').deleteMany({ _id: { $in: tenantIds } });
        break;
        
      case 'suspend':
        result = await db.collection('tenants').updateMany(
          { _id: { $in: tenantIds } },
          { 
            $set: { 
              status: 'suspended',
              suspendedAt: timestamp,
              suspendedBy: req.user._id,
              suspendReason: data?.reason || 'Bulk suspension by admin'
            } 
          }
        );
        break;
        
      case 'activate':
        result = await db.collection('tenants').updateMany(
          { _id: { $in: tenantIds } },
          { 
            $set: { 
              status: 'active',
              activatedAt: timestamp,
              activatedBy: req.user._id
            },
            $unset: {
              suspendedAt: '',
              suspendedBy: '',
              suspendReason: ''
            }
          }
        );
        break;
        
      case 'update-limits':
        if (!data?.limits) {
          return res.status(400).json({ 
            success: false, 
            error: 'Limits data is required for update-limits action' 
          });
        }
        
        const limitUpdate = {};
        if (data.limits.users !== undefined) {
          limitUpdate['settings.limits.users'] = data.limits.users;
        }
        if (data.limits.storage !== undefined) {
          limitUpdate['settings.limits.storage'] = data.limits.storage;
        }
        
        result = await db.collection('tenants').updateMany(
          { _id: { $in: tenantIds } },
          { $set: limitUpdate }
        );
        break;
        
      case 'export':
        // Get tenant data for export
        const tenants = await db.collection('tenants').find({ 
          _id: { $in: tenantIds } 
        }).toArray();
        
        const exportData = [];
        for (const tenant of tenants) {
          const userCount = await db.collection('users').countDocuments({ tenant: tenant._id });
          exportData.push({
            ...tenant,
            userCount
          });
        }
        
        return res.json({
          success: true,
          data: exportData,
          count: exportData.length
        });
        
      default:
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid bulk action' 
        });
    }
    
    // Log admin action
    await db.collection('admin_audit').insertOne({
      action: `tenant.bulk-${action}`,
      user: req.user._id,
      userEmail: req.user.email,
      target: tenantIds,
      details: data,
      timestamp
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
      error: 'Failed to perform bulk operation',
      details: error.message 
    });
  } finally {
    if (client) {
      await client.close();
    }
  }
});

// GET /api/v1/admin/tenants/export - Export tenant data
router.get('/export', async function(req, res) {
  const { MongoClient } = require('mongodb');
  let client;
  
  try {
    const mongoUri = process.env.MASTER_MONGODB_URI || process.env.MONGODB_URI || process.env.MONGO_CONNECTION || process.env.MONGOLAB_URI;
    
    if (!mongoUri) {
      return res.status(500).json({ error: 'Database connection not configured' });
    }
    
    client = new MongoClient(mongoUri, { useUnifiedTopology: true });
    await client.connect();
    const db = client.db();
    
    const format = req.query.format || 'json';
    const includeUsers = req.query.includeUsers === 'true';
    
    // Get all tenants
    const tenants = await db.collection('tenants').find({}).toArray();
    
    // Enhance with additional data
    const exportData = [];
    for (const tenant of tenants) {
      const tenantData = {
        ...tenant,
        userCount: await db.collection('users').countDocuments({ tenant: tenant._id })
      };
      
      if (includeUsers) {
        tenantData.users = await db.collection('users')
          .find({ tenant: tenant._id })
          .project({ password: 0, twoFactorSecret: 0 })
          .toArray();
      }
      
      exportData.push(tenantData);
    }
    
    if (format === 'csv') {
      // Convert to CSV
      const fields = ['_id', 'name', 'subdomain', 'status', 'userCount', 'createdAt'];
      const csv = [
        fields.join(','),
        ...exportData.map(t => fields.map(f => `"${t[f] || ''}"`).join(','))
      ].join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=tenants.csv');
      res.send(csv);
    } else {
      res.json({
        success: true,
        data: exportData,
        count: exportData.length,
        exportedAt: new Date()
      });
    }
    
  } catch (error) {
    console.error('Export tenants error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to export tenant data',
      details: error.message 
    });
  } finally {
    if (client) {
      await client.close();
    }
  }
});

// Helper function to format bytes
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

module.exports = router;
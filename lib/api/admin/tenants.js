'use strict';

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');

// GET /api/v1/admin/tenants - List all tenants with pagination
router.get('/', async function(req, res) {
  try {
    const ctx = req.app.get('ctx');
    const store = ctx.env.storageSupport;
    
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
      store.db.collection('tenants')
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      store.db.collection('tenants').countDocuments(filter)
    ]);
    
    // Get user counts for each tenant
    const tenantIds = tenants.map(t => t._id);
    const userCounts = await store.db.collection('users')
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
      error: 'Failed to fetch tenants' 
    });
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

module.exports = router;
'use strict';

const express = require('express');
const router = express.Router();

// GET /api/v1/admin/analytics/overview - System-wide analytics
router.get('/overview', async function(req, res) {
  try {
    const ctx = req.app.get('ctx');
    const store = ctx.env.storageSupport;
    
    // Time range
    const days = parseInt(req.query.days) || 30;
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    
    // Get all tenants
    const tenants = await store.db.collection('tenants').find({}).toArray();
    
    // Aggregate data across all tenants
    const metrics = {
      totalTenants: tenants.length,
      activeTenants: 0,
      totalUsers: 0,
      activeUsers: 0,
      totalEntries: 0,
      totalTreatments: 0,
      storageUsed: 0,
      growth: {
        tenants: [],
        users: []
      }
    };
    
    // Count active tenants and collect stats
    for (const tenant of tenants) {
      const tenantId = tenant._id;
      
      // Check if tenant has recent data
      const recentEntry = await store.db.collection(`entries_${tenantId}`)
        .findOne({ date: { $gte: startDate } });
      
      if (recentEntry) {
        metrics.activeTenants++;
      }
      
      // Count entries and treatments
      const [entriesCount, treatmentsCount] = await Promise.all([
        store.db.collection(`entries_${tenantId}`).countDocuments(),
        store.db.collection(`treatments_${tenantId}`).countDocuments()
      ]);
      
      metrics.totalEntries += entriesCount;
      metrics.totalTreatments += treatmentsCount;
      
      // Estimate storage (rough calculation)
      metrics.storageUsed += (entriesCount * 200 + treatmentsCount * 500); // bytes
    }
    
    // User metrics
    const [totalUsers, activeUsers] = await Promise.all([
      store.db.collection('users').countDocuments(),
      store.db.collection('users').countDocuments({
        lastLogin: { $gte: startDate }
      })
    ]);
    
    metrics.totalUsers = totalUsers;
    metrics.activeUsers = activeUsers;
    
    // Growth metrics - daily aggregation for the period
    const growthData = await store.db.collection('tenants')
      .aggregate([
        {
          $match: { createdAt: { $gte: startDate } }
        },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
            },
            count: { $sum: 1 }
          }
        },
        {
          $sort: { _id: 1 }
        }
      ])
      .toArray();
    
    metrics.growth.tenants = growthData;
    
    // User growth
    const userGrowth = await store.db.collection('users')
      .aggregate([
        {
          $match: { createdAt: { $gte: startDate } }
        },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
            },
            count: { $sum: 1 }
          }
        },
        {
          $sort: { _id: 1 }
        }
      ])
      .toArray();
    
    metrics.growth.users = userGrowth;
    
    // Calculate rates
    metrics.rates = {
      tenantActivity: metrics.totalTenants > 0 
        ? (metrics.activeTenants / metrics.totalTenants * 100).toFixed(1) 
        : 0,
      userActivity: metrics.totalUsers > 0 
        ? (metrics.activeUsers / metrics.totalUsers * 100).toFixed(1) 
        : 0
    };
    
    // Format storage
    metrics.storageUsedFormatted = formatBytes(metrics.storageUsed);
    
    res.json({
      success: true,
      data: metrics,
      period: {
        days,
        startDate,
        endDate: new Date()
      }
    });
    
  } catch (error) {
    console.error('Analytics overview error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch analytics' 
    });
  }
});

// GET /api/v1/admin/analytics/tenants/:id - Tenant-specific analytics
router.get('/tenants/:id', async function(req, res) {
  try {
    const ctx = req.app.get('ctx');
    const store = ctx.env.storageSupport;
    const tenantId = req.params.id;
    
    // Verify tenant exists
    const tenant = await store.db.collection('tenants')
      .findOne({ _id: tenantId });
    
    if (!tenant) {
      return res.status(404).json({ 
        success: false, 
        error: 'Tenant not found' 
      });
    }
    
    // Time range
    const days = parseInt(req.query.days) || 30;
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    
    // Get tenant metrics
    const [users, entries, treatments, devicestatus] = await Promise.all([
      store.db.collection('users').countDocuments({ tenant: tenantId }),
      store.db.collection(`entries_${tenantId}`).countDocuments(),
      store.db.collection(`treatments_${tenantId}`).countDocuments(),
      store.db.collection(`devicestatus_${tenantId}`).countDocuments()
    ]);
    
    // Active users
    const activeUsers = await store.db.collection('users')
      .countDocuments({
        tenant: tenantId,
        lastLogin: { $gte: startDate }
      });
    
    // Data upload frequency
    const recentEntries = await store.db.collection(`entries_${tenantId}`)
      .aggregate([
        {
          $match: { date: { $gte: startDate } }
        },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$date' }
            },
            count: { $sum: 1 }
          }
        },
        {
          $sort: { _id: -1 }
        },
        {
          $limit: days
        }
      ])
      .toArray();
    
    // Treatment patterns
    const treatmentTypes = await store.db.collection(`treatments_${tenantId}`)
      .aggregate([
        {
          $match: { created_at: { $gte: startDate } }
        },
        {
          $group: {
            _id: '$eventType',
            count: { $sum: 1 }
          }
        },
        {
          $sort: { count: -1 }
        }
      ])
      .toArray();
    
    // User activity
    const userActivity = await store.db.collection('users')
      .find({ 
        tenant: tenantId,
        lastLogin: { $exists: true }
      })
      .sort({ lastLogin: -1 })
      .limit(10)
      .toArray();
    
    // Storage estimate
    const storageUsed = (entries * 200 + treatments * 500 + devicestatus * 300);
    
    const analytics = {
      tenant: {
        id: tenant._id,
        name: tenant.name,
        subdomain: tenant.subdomain,
        createdAt: tenant.createdAt,
        status: tenant.status
      },
      metrics: {
        users: {
          total: users,
          active: activeUsers,
          activityRate: users > 0 ? (activeUsers / users * 100).toFixed(1) : 0
        },
        data: {
          entries,
          treatments,
          devicestatus,
          total: entries + treatments + devicestatus
        },
        storage: {
          used: storageUsed,
          formatted: formatBytes(storageUsed),
          limit: tenant.settings?.limits?.storage || 104857600,
          percentage: tenant.settings?.limits?.storage 
            ? (storageUsed / tenant.settings.limits.storage * 100).toFixed(1)
            : 0
        }
      },
      activity: {
        dailyEntries: recentEntries,
        treatmentTypes,
        recentUsers: userActivity.map(u => ({
          email: u.email,
          name: u.name,
          lastLogin: u.lastLogin
        }))
      }
    };
    
    res.json({
      success: true,
      data: analytics,
      period: {
        days,
        startDate,
        endDate: new Date()
      }
    });
    
  } catch (error) {
    console.error('Tenant analytics error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch tenant analytics' 
    });
  }
});

// GET /api/v1/admin/analytics/usage - System usage statistics
router.get('/usage', async function(req, res) {
  try {
    const ctx = req.app.get('ctx');
    const store = ctx.env.storageSupport;
    
    // Time range
    const hours = parseInt(req.query.hours) || 24;
    const startDate = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    // API usage by endpoint (from audit logs)
    const apiUsage = await store.db.collection('admin_audit')
      .aggregate([
        {
          $match: {
            timestamp: { $gte: startDate },
            action: { $regex: '^api\\.' }
          }
        },
        {
          $group: {
            _id: '$action',
            count: { $sum: 1 }
          }
        },
        {
          $sort: { count: -1 }
        },
        {
          $limit: 20
        }
      ])
      .toArray();
    
    // User activity by hour
    const hourlyActivity = await store.db.collection('users')
      .aggregate([
        {
          $match: {
            lastLogin: { $gte: startDate }
          }
        },
        {
          $group: {
            _id: {
              $hour: '$lastLogin'
            },
            count: { $sum: 1 }
          }
        },
        {
          $sort: { _id: 1 }
        }
      ])
      .toArray();
    
    // System resources
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    res.json({
      success: true,
      data: {
        apiUsage,
        hourlyActivity,
        system: {
          memory: {
            rss: formatBytes(memoryUsage.rss),
            heapTotal: formatBytes(memoryUsage.heapTotal),
            heapUsed: formatBytes(memoryUsage.heapUsed),
            external: formatBytes(memoryUsage.external)
          },
          cpu: {
            user: cpuUsage.user,
            system: cpuUsage.system
          },
          uptime: process.uptime()
        }
      },
      period: {
        hours,
        startDate,
        endDate: new Date()
      }
    });
    
  } catch (error) {
    console.error('Usage analytics error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch usage analytics' 
    });
  }
});

// GET /api/v1/admin/analytics/trends - Growth trends
router.get('/trends', async function(req, res) {
  try {
    const ctx = req.app.get('ctx');
    const store = ctx.env.storageSupport;
    
    // Time range
    const months = parseInt(req.query.months) || 6;
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);
    
    // Monthly tenant growth
    const tenantGrowth = await store.db.collection('tenants')
      .aggregate([
        {
          $match: { createdAt: { $gte: startDate } }
        },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' }
            },
            count: { $sum: 1 }
          }
        },
        {
          $sort: { '_id.year': 1, '_id.month': 1 }
        }
      ])
      .toArray();
    
    // Monthly user growth
    const userGrowth = await store.db.collection('users')
      .aggregate([
        {
          $match: { createdAt: { $gte: startDate } }
        },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' }
            },
            count: { $sum: 1 }
          }
        },
        {
          $sort: { '_id.year': 1, '_id.month': 1 }
        }
      ])
      .toArray();
    
    // Format data for charts
    const formatGrowthData = (data) => {
      return data.map(item => ({
        month: `${item._id.year}-${String(item._id.month).padStart(2, '0')}`,
        count: item.count
      }));
    };
    
    res.json({
      success: true,
      data: {
        tenants: formatGrowthData(tenantGrowth),
        users: formatGrowthData(userGrowth)
      },
      period: {
        months,
        startDate,
        endDate: new Date()
      }
    });
    
  } catch (error) {
    console.error('Trends analytics error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch trends' 
    });
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
'use strict';

const express = require('express');
const router = express.Router();
const { MongoClient } = require('mongodb');

// Helper function to get database connection
async function getDbConnection() {
  const mongoUri = process.env.MASTER_MONGODB_URI || process.env.MONGODB_URI || process.env.MONGO_CONNECTION || process.env.MONGOLAB_URI;
  
  if (!mongoUri) {
    throw new Error('Database connection not configured');
  }
  
  const client = new MongoClient(mongoUri, { useUnifiedTopology: true });
  await client.connect();
  return client;
}

// GET /api/v1/admin/dashboard/stats - Enhanced statistics
router.get('/stats', async function(req, res) {
  let client;
  
  try {
    client = await getDbConnection();
    const db = client.db();
    
    // Current date calculations
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // Get current counts
    const [
      totalTenants,
      totalUsers,
      activeUsers,
      activeTenants,
      totalDataPoints,
      apiCallsToday,
      lastMonthTenants,
      lastMonthUsers
    ] = await Promise.all([
      // Total tenants
      db.collection('tenants').countDocuments(),
      
      // Total users
      db.collection('users').countDocuments(),
      
      // Active users (30-day)
      db.collection('users').countDocuments({
        lastLogin: { $gte: thirtyDaysAgo }
      }),
      
      // Active tenants (30-day)
      db.collection('tenants').countDocuments({
        lastActive: { $gte: thirtyDaysAgo }
      }),
      
      // Total data points (approximate)
      Promise.all([
        db.collection('tenants').find({}).toArray()
      ]).then(async ([tenants]) => {
        let total = 0;
        for (const tenant of tenants.slice(0, 10)) { // Sample first 10 tenants
          const collections = ['entries', 'treatments', 'devicestatus'];
          for (const coll of collections) {
            try {
              const count = await db.collection(`${coll}_${tenant._id}`).estimatedDocumentCount();
              total += count;
            } catch (e) {
              // Collection might not exist
            }
          }
        }
        // Extrapolate to all tenants
        return tenants.length > 0 ? Math.round(total * tenants.length / Math.min(10, tenants.length)) : 0;
      }),
      
      // API calls today (from audit log)
      db.collection('admin_audit').countDocuments({
        timestamp: { $gte: todayStart },
        action: { $regex: '^api\\.' }
      }),
      
      // Last month's tenants (for growth calculation)
      db.collection('tenants').countDocuments({
        createdAt: { $gte: lastMonthStart, $lte: lastMonthEnd }
      }),
      
      // Last month's users (for growth calculation)
      db.collection('users').countDocuments({
        createdAt: { $gte: lastMonthStart, $lte: lastMonthEnd }
      })
    ]);
    
    // Calculate growth percentages
    const tenantGrowth = lastMonthTenants > 0 
      ? ((totalTenants - lastMonthTenants) / lastMonthTenants * 100).toFixed(1)
      : 0;
    
    const userGrowth = lastMonthUsers > 0
      ? ((totalUsers - lastMonthUsers) / lastMonthUsers * 100).toFixed(1)
      : 0;
    
    // System metrics
    const uptime = process.uptime();
    const memoryUsage = process.memoryUsage();
    
    // Response time (mock for now - would need actual monitoring)
    const avgResponseTime = Math.floor(Math.random() * 50) + 100; // 100-150ms
    const errorRate = (Math.random() * 2).toFixed(2); // 0-2%
    
    res.json({
      success: true,
      data: {
        tenants: {
          total: totalTenants,
          active: activeTenants,
          growth: parseFloat(tenantGrowth),
          growthLabel: tenantGrowth >= 0 ? `+${tenantGrowth}%` : `${tenantGrowth}%`
        },
        users: {
          total: totalUsers,
          active: activeUsers,
          growth: parseFloat(userGrowth),
          growthLabel: userGrowth >= 0 ? `+${userGrowth}%` : `${userGrowth}%`
        },
        system: {
          uptime: uptime,
          uptimeFormatted: formatUptime(uptime),
          memoryUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
          memoryTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
          cpuUsage: process.cpuUsage()
        },
        data: {
          totalPoints: totalDataPoints,
          formattedPoints: formatDataPoints(totalDataPoints),
          storageUsed: Math.round(totalDataPoints * 0.001), // Rough estimate: 1KB per data point
        },
        api: {
          callsToday: apiCallsToday,
          avgResponseTime: avgResponseTime,
          errorRate: parseFloat(errorRate)
        }
      }
    });
    
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch dashboard statistics',
      details: error.message 
    });
  } finally {
    if (client) {
      await client.close();
    }
  }
});

// GET /api/v1/admin/dashboard/activity - Recent activity feed
router.get('/activity', async function(req, res) {
  let client;
  
  try {
    client = await getDbConnection();
    const db = client.db();
    
    const limit = parseInt(req.query.limit) || 20;
    
    // Get recent activities from audit log
    const activities = await db.collection('admin_audit')
      .find({})
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray();
    
    // Get recent tenant registrations
    const recentTenants = await db.collection('tenants')
      .find({})
      .sort({ createdAt: -1 })
      .limit(5)
      .toArray();
    
    // Get recent user registrations
    const recentUsers = await db.collection('users')
      .find({})
      .sort({ createdAt: -1 })
      .limit(5)
      .toArray();
    
    // Get login anomalies (multiple failed attempts)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const loginFailures = await db.collection('admin_audit')
      .aggregate([
        {
          $match: {
            action: 'login.failed',
            timestamp: { $gte: oneHourAgo }
          }
        },
        {
          $group: {
            _id: '$details.email',
            count: { $sum: 1 },
            lastAttempt: { $max: '$timestamp' }
          }
        },
        {
          $match: { count: { $gte: 3 } }
        }
      ])
      .toArray();
    
    // Format activities
    const formattedActivities = activities.map(activity => ({
      id: activity._id,
      type: getActivityType(activity.action),
      action: activity.action,
      user: activity.userEmail,
      target: activity.target,
      details: activity.details,
      timestamp: activity.timestamp,
      icon: getActivityIcon(activity.action),
      color: getActivityColor(activity.action)
    }));
    
    // Create mixed activity feed
    const feed = [
      ...formattedActivities,
      ...recentTenants.map(t => ({
        id: t._id,
        type: 'registration',
        action: 'tenant.registered',
        target: t.name,
        details: { subdomain: t.subdomain },
        timestamp: t.createdAt,
        icon: 'Business',
        color: 'success'
      })),
      ...recentUsers.map(u => ({
        id: u._id,
        type: 'registration',
        action: 'user.registered',
        target: u.email,
        details: { role: u.role },
        timestamp: u.createdAt,
        icon: 'PersonAdd',
        color: 'info'
      })),
      ...loginFailures.map(f => ({
        id: f._id,
        type: 'anomaly',
        action: 'login.anomaly',
        target: f._id,
        details: { attempts: f.count },
        timestamp: f.lastAttempt,
        icon: 'Warning',
        color: 'error'
      }))
    ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, limit);
    
    res.json({
      success: true,
      data: {
        activities: feed,
        summary: {
          totalActivities: feed.length,
          newTenants: recentTenants.length,
          newUsers: recentUsers.length,
          anomalies: loginFailures.length
        }
      }
    });
    
  } catch (error) {
    console.error('Dashboard activity error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch activity feed',
      details: error.message 
    });
  } finally {
    if (client) {
      await client.close();
    }
  }
});

// GET /api/v1/admin/dashboard/charts - Chart data endpoints
router.get('/charts', async function(req, res) {
  let client;
  
  try {
    client = await getDbConnection();
    const db = client.db();
    
    const days = parseInt(req.query.days) || 30;
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);
    
    // Generate date range
    const dateRange = [];
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      dateRange.push(new Date(d));
    }
    
    // Get tenant growth data
    const tenantGrowth = await db.collection('tenants')
      .aggregate([
        {
          $match: {
            createdAt: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
            },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ])
      .toArray();
    
    // Get user growth data
    const userGrowth = await db.collection('users')
      .aggregate([
        {
          $match: {
            createdAt: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
            },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ])
      .toArray();
    
    // Get user activity heatmap data
    const activityHeatmap = await db.collection('users')
      .aggregate([
        {
          $match: {
            lastLogin: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: {
              date: { $dateToString: { format: '%Y-%m-%d', date: '$lastLogin' } },
              hour: { $hour: '$lastLogin' }
            },
            count: { $sum: 1 }
          }
        }
      ])
      .toArray();
    
    // Format data for charts
    const growthMap = {};
    tenantGrowth.forEach(t => { growthMap[t._id] = { tenants: t.count }; });
    userGrowth.forEach(u => {
      if (!growthMap[u._id]) growthMap[u._id] = {};
      growthMap[u._id].users = u.count;
    });
    
    const growthData = dateRange.map(date => {
      const dateStr = date.toISOString().split('T')[0];
      return {
        date: dateStr,
        tenants: growthMap[dateStr]?.tenants || 0,
        users: growthMap[dateStr]?.users || 0
      };
    });
    
    // Calculate cumulative totals
    let tenantTotal = await db.collection('tenants').countDocuments({ createdAt: { $lt: startDate } });
    let userTotal = await db.collection('users').countDocuments({ createdAt: { $lt: startDate } });
    
    const cumulativeGrowth = growthData.map(day => {
      tenantTotal += day.tenants;
      userTotal += day.users;
      return {
        date: day.date,
        tenants: tenantTotal,
        users: userTotal
      };
    });
    
    // System metrics (mock data for demo)
    const systemMetrics = dateRange.map(date => ({
      date: date.toISOString().split('T')[0],
      cpu: Math.random() * 30 + 20, // 20-50%
      memory: Math.random() * 20 + 60, // 60-80%
      responseTime: Math.random() * 50 + 100 // 100-150ms
    }));
    
    res.json({
      success: true,
      data: {
        growth: {
          daily: growthData,
          cumulative: cumulativeGrowth
        },
        activity: {
          heatmap: activityHeatmap
        },
        system: {
          metrics: systemMetrics
        }
      }
    });
    
  } catch (error) {
    console.error('Dashboard charts error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch chart data',
      details: error.message 
    });
  } finally {
    if (client) {
      await client.close();
    }
  }
});

// GET /api/v1/admin/dashboard/alerts - System alerts
router.get('/alerts', async function(req, res) {
  let client;
  
  try {
    client = await getDbConnection();
    const db = client.db();
    
    const alerts = [];
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    // Check for suspended tenants
    const suspendedTenants = await db.collection('tenants').countDocuments({ status: 'suspended' });
    if (suspendedTenants > 0) {
      alerts.push({
        id: 'suspended-tenants',
        severity: 'warning',
        title: 'Suspended Tenants',
        message: `${suspendedTenants} tenant(s) are currently suspended`,
        timestamp: now,
        action: '/tenants?status=suspended'
      });
    }
    
    // Check for users without activity
    const inactiveUsers = await db.collection('users').countDocuments({
      lastLogin: { $lt: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000) }
    });
    if (inactiveUsers > 10) {
      alerts.push({
        id: 'inactive-users',
        severity: 'info',
        title: 'Inactive Users',
        message: `${inactiveUsers} users haven't logged in for 90+ days`,
        timestamp: now,
        action: '/users?inactive=true'
      });
    }
    
    // Check for failed login attempts
    const failedLogins = await db.collection('admin_audit').countDocuments({
      action: 'login.failed',
      timestamp: { $gte: oneHourAgo }
    });
    if (failedLogins > 5) {
      alerts.push({
        id: 'failed-logins',
        severity: 'error',
        title: 'Multiple Failed Login Attempts',
        message: `${failedLogins} failed login attempts in the last hour`,
        timestamp: now,
        action: '/audit?action=login.failed'
      });
    }
    
    // Check system resources
    const memoryUsage = process.memoryUsage();
    const memoryPercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
    if (memoryPercent > 80) {
      alerts.push({
        id: 'high-memory',
        severity: 'warning',
        title: 'High Memory Usage',
        message: `Memory usage is at ${memoryPercent.toFixed(1)}%`,
        timestamp: now,
        action: '/system'
      });
    }
    
    // Check for tenants near user limit
    const tenantsNearLimit = await db.collection('tenants').find({}).toArray();
    for (const tenant of tenantsNearLimit) {
      const userCount = await db.collection('users').countDocuments({ tenant: tenant._id });
      const userLimit = tenant.settings?.limits?.users || 10;
      if (userCount >= userLimit * 0.9) {
        alerts.push({
          id: `tenant-limit-${tenant._id}`,
          severity: 'warning',
          title: 'Tenant Near User Limit',
          message: `${tenant.name} has ${userCount}/${userLimit} users`,
          timestamp: now,
          action: `/tenants/${tenant._id}`
        });
      }
    }
    
    res.json({
      success: true,
      data: {
        alerts: alerts.sort((a, b) => {
          const severityOrder = { error: 0, warning: 1, info: 2 };
          return severityOrder[a.severity] - severityOrder[b.severity];
        }),
        summary: {
          total: alerts.length,
          error: alerts.filter(a => a.severity === 'error').length,
          warning: alerts.filter(a => a.severity === 'warning').length,
          info: alerts.filter(a => a.severity === 'info').length
        }
      }
    });
    
  } catch (error) {
    console.error('Dashboard alerts error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch alerts',
      details: error.message 
    });
  } finally {
    if (client) {
      await client.close();
    }
  }
});

// Helper functions
function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
}

function formatDataPoints(count) {
  if (count >= 1000000) {
    return (count / 1000000).toFixed(1) + 'M';
  } else if (count >= 1000) {
    return (count / 1000).toFixed(1) + 'K';
  }
  return count.toString();
}

function getActivityType(action) {
  if (action.startsWith('tenant.')) return 'tenant';
  if (action.startsWith('user.')) return 'user';
  if (action.startsWith('login.')) return 'auth';
  if (action.startsWith('api.')) return 'api';
  return 'system';
}

function getActivityIcon(action) {
  const iconMap = {
    'tenant.create': 'Add',
    'tenant.update': 'Edit',
    'tenant.delete': 'Delete',
    'tenant.suspend': 'Block',
    'tenant.activate': 'CheckCircle',
    'user.create': 'PersonAdd',
    'user.update': 'Edit',
    'user.delete': 'PersonRemove',
    'user.password-reset': 'VpnKey',
    'login.success': 'Login',
    'login.failed': 'Warning'
  };
  return iconMap[action] || 'Info';
}

function getActivityColor(action) {
  if (action.includes('delete') || action.includes('suspend')) return 'error';
  if (action.includes('create') || action.includes('activate')) return 'success';
  if (action.includes('update') || action.includes('reset')) return 'info';
  if (action.includes('failed')) return 'error';
  return 'default';
}

module.exports = router;
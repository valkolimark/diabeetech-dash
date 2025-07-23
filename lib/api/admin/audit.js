'use strict';

const express = require('express');
const router = express.Router();

// GET /api/v1/admin/audit - Get audit logs
router.get('/', async function(req, res) {
  try {
    const ctx = req.app.get('ctx');
    const store = ctx.env.storageSupport;
    
    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;
    
    // Build filter
    const filter = {};
    
    // Filter by action
    if (req.query.action) {
      filter.action = { $regex: req.query.action, $options: 'i' };
    }
    
    // Filter by user
    if (req.query.user) {
      filter.user = req.query.user;
    }
    
    // Filter by target
    if (req.query.target) {
      filter.target = req.query.target;
    }
    
    // Date range filter
    if (req.query.startDate || req.query.endDate) {
      filter.timestamp = {};
      if (req.query.startDate) {
        filter.timestamp.$gte = new Date(req.query.startDate);
      }
      if (req.query.endDate) {
        filter.timestamp.$lte = new Date(req.query.endDate);
      }
    }
    
    // Get audit logs with count
    const [logs, total] = await Promise.all([
      store.db.collection('admin_audit')
        .find(filter)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      store.db.collection('admin_audit').countDocuments(filter)
    ]);
    
    // Enhance logs with user info
    const userIds = [...new Set(logs.map(log => log.user).filter(Boolean))];
    const users = await store.db.collection('users')
      .find({ _id: { $in: userIds } })
      .toArray();
    
    const userMap = {};
    users.forEach(u => {
      userMap[u._id] = {
        email: u.email,
        name: u.name || u.username
      };
    });
    
    // Enhance logs
    const enhancedLogs = logs.map(log => ({
      ...log,
      userInfo: userMap[log.user] || { email: 'Unknown', name: 'Unknown' }
    }));
    
    res.json({
      success: true,
      data: {
        logs: enhancedLogs,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
    
  } catch (error) {
    console.error('Audit logs error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch audit logs' 
    });
  }
});

// GET /api/v1/admin/audit/stats - Audit statistics
router.get('/stats', async function(req, res) {
  try {
    const ctx = req.app.get('ctx');
    const store = ctx.env.storageSupport;
    
    // Time range
    const days = parseInt(req.query.days) || 7;
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    
    // Action types breakdown
    const actionStats = await store.db.collection('admin_audit')
      .aggregate([
        {
          $match: { timestamp: { $gte: startDate } }
        },
        {
          $group: {
            _id: {
              $substr: ['$action', 0, { $indexOfBytes: ['$action', '.'] }]
            },
            count: { $sum: 1 }
          }
        },
        {
          $sort: { count: -1 }
        }
      ])
      .toArray();
    
    // Most active users
    const activeUsers = await store.db.collection('admin_audit')
      .aggregate([
        {
          $match: { timestamp: { $gte: startDate } }
        },
        {
          $group: {
            _id: '$user',
            email: { $first: '$userEmail' },
            count: { $sum: 1 }
          }
        },
        {
          $sort: { count: -1 }
        },
        {
          $limit: 10
        }
      ])
      .toArray();
    
    // Activity by day
    const dailyActivity = await store.db.collection('admin_audit')
      .aggregate([
        {
          $match: { timestamp: { $gte: startDate } }
        },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$timestamp' }
            },
            count: { $sum: 1 }
          }
        },
        {
          $sort: { _id: 1 }
        }
      ])
      .toArray();
    
    // Critical actions (delete, suspend, etc.)
    const criticalActions = await store.db.collection('admin_audit')
      .find({
        timestamp: { $gte: startDate },
        $or: [
          { action: { $regex: 'delete' } },
          { action: { $regex: 'suspend' } },
          { action: { $regex: 'password' } },
          { action: { $regex: '2fa' } }
        ]
      })
      .sort({ timestamp: -1 })
      .limit(20)
      .toArray();
    
    res.json({
      success: true,
      data: {
        summary: {
          totalActions: actionStats.reduce((sum, stat) => sum + stat.count, 0),
          actionTypes: actionStats,
          period: `${days} days`
        },
        activeUsers,
        dailyActivity,
        criticalActions: criticalActions.map(action => ({
          action: action.action,
          user: action.userEmail,
          target: action.target,
          timestamp: action.timestamp,
          details: action.details
        }))
      }
    });
    
  } catch (error) {
    console.error('Audit stats error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch audit statistics' 
    });
  }
});

// POST /api/v1/admin/audit/export - Export audit logs
router.post('/export', async function(req, res) {
  try {
    const ctx = req.app.get('ctx');
    const store = ctx.env.storageSupport;
    
    const { format = 'json', startDate, endDate } = req.body;
    
    // Build filter
    const filter = {};
    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) filter.timestamp.$gte = new Date(startDate);
      if (endDate) filter.timestamp.$lte = new Date(endDate);
    }
    
    // Get all matching logs
    const logs = await store.db.collection('admin_audit')
      .find(filter)
      .sort({ timestamp: -1 })
      .toArray();
    
    // Log the export action
    await store.db.collection('admin_audit').insertOne({
      action: 'audit.export',
      user: req.user._id,
      userEmail: req.user.email,
      details: {
        format,
        count: logs.length,
        startDate,
        endDate
      },
      timestamp: new Date()
    });
    
    if (format === 'csv') {
      // Convert to CSV
      const csv = [
        'Timestamp,Action,User,Target,Details',
        ...logs.map(log => {
          const details = JSON.stringify(log.details || {}).replace(/"/g, '""');
          return `"${log.timestamp}","${log.action}","${log.userEmail || ''}","${log.target || ''}","${details}"`;
        })
      ].join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=audit-logs.csv');
      res.send(csv);
    } else {
      // Default to JSON
      res.json({
        success: true,
        data: {
          logs,
          exported: new Date(),
          count: logs.length
        }
      });
    }
    
  } catch (error) {
    console.error('Export audit logs error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to export audit logs' 
    });
  }
});

// DELETE /api/v1/admin/audit/cleanup - Clean up old audit logs
router.delete('/cleanup', async function(req, res) {
  try {
    const ctx = req.app.get('ctx');
    const store = ctx.env.storageSupport;
    
    // Default to 90 days retention
    const retentionDays = parseInt(req.body.retentionDays) || 90;
    const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    
    // Count before deletion
    const countBefore = await store.db.collection('admin_audit')
      .countDocuments({ timestamp: { $lt: cutoffDate } });
    
    // Delete old logs
    const result = await store.db.collection('admin_audit')
      .deleteMany({ timestamp: { $lt: cutoffDate } });
    
    // Log the cleanup action
    await store.db.collection('admin_audit').insertOne({
      action: 'audit.cleanup',
      user: req.user._id,
      userEmail: req.user.email,
      details: {
        retentionDays,
        cutoffDate,
        deletedCount: result.deletedCount
      },
      timestamp: new Date()
    });
    
    res.json({
      success: true,
      data: {
        message: 'Audit logs cleaned up',
        retentionDays,
        cutoffDate,
        deletedCount: result.deletedCount,
        countBefore
      }
    });
    
  } catch (error) {
    console.error('Cleanup audit logs error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to cleanup audit logs' 
    });
  }
});

module.exports = router;
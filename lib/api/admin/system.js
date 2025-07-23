'use strict';

const express = require('express');
const router = express.Router();
const os = require('os');

// GET /api/v1/admin/system/info - System information
router.get('/info', async function(req, res) {
  try {
    const ctx = req.app.get('ctx');
    const env = ctx.env;
    
    // System info
    const systemInfo = {
      nightscout: {
        version: env.version,
        head: env.head,
        name: env.name,
        environment: process.env.NODE_ENV || 'development'
      },
      node: {
        version: process.version,
        modules: process.versions
      },
      server: {
        hostname: os.hostname(),
        platform: os.platform(),
        arch: os.arch(),
        cpus: os.cpus().length,
        totalMemory: formatBytes(os.totalmem()),
        freeMemory: formatBytes(os.freemem()),
        uptime: os.uptime()
      },
      process: {
        pid: process.pid,
        uptime: process.uptime(),
        memory: {
          rss: formatBytes(process.memoryUsage().rss),
          heapTotal: formatBytes(process.memoryUsage().heapTotal),
          heapUsed: formatBytes(process.memoryUsage().heapUsed),
          external: formatBytes(process.memoryUsage().external)
        }
      }
    };
    
    res.json({
      success: true,
      data: systemInfo
    });
    
  } catch (error) {
    console.error('System info error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch system info' 
    });
  }
});

// GET /api/v1/admin/system/health - Health check with detailed status
router.get('/health', async function(req, res) {
  try {
    const ctx = req.app.get('ctx');
    const store = ctx.env.storageSupport;
    
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      checks: {}
    };
    
    // Database check
    try {
      await store.db.admin().ping();
      health.checks.database = {
        status: 'healthy',
        message: 'Database connection successful'
      };
    } catch (dbError) {
      health.status = 'unhealthy';
      health.checks.database = {
        status: 'unhealthy',
        message: 'Database connection failed',
        error: dbError.message
      };
    }
    
    // Memory check
    const memUsage = process.memoryUsage();
    const memPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
    
    health.checks.memory = {
      status: memPercent > 90 ? 'warning' : 'healthy',
      usage: {
        percent: memPercent.toFixed(1),
        heapUsed: formatBytes(memUsage.heapUsed),
        heapTotal: formatBytes(memUsage.heapTotal)
      }
    };
    
    if (memPercent > 90) {
      health.status = 'warning';
    }
    
    // CPU check
    const loadAvg = os.loadavg();
    const cpuCount = os.cpus().length;
    const loadPercent = (loadAvg[0] / cpuCount) * 100;
    
    health.checks.cpu = {
      status: loadPercent > 80 ? 'warning' : 'healthy',
      loadAverage: {
        '1min': loadAvg[0].toFixed(2),
        '5min': loadAvg[1].toFixed(2),
        '15min': loadAvg[2].toFixed(2)
      },
      cores: cpuCount,
      loadPercent: loadPercent.toFixed(1)
    };
    
    if (loadPercent > 80) {
      health.status = 'warning';
    }
    
    // Disk space check (if available)
    try {
      const diskStats = await getDiskStats();
      if (diskStats) {
        health.checks.disk = diskStats;
        if (diskStats.status !== 'healthy') {
          health.status = 'warning';
        }
      }
    } catch (e) {
      // Disk stats not available
    }
    
    res.json({
      success: true,
      data: health
    });
    
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Health check failed',
      data: {
        status: 'error',
        message: error.message
      }
    });
  }
});

// GET /api/v1/admin/system/config - Configuration (sanitized)
router.get('/config', function(req, res) {
  try {
    const ctx = req.app.get('ctx');
    const env = ctx.env;
    
    // Sanitize sensitive config
    const config = {
      features: require('../../../config/features').getEnabledFeatures(),
      settings: {
        authDefaultRoles: env.settings.authDefaultRoles,
        timeFormat: env.settings.timeFormat,
        units: env.settings.units,
        language: env.settings.language,
        scaleY: env.settings.scaleY,
        showPlugins: env.settings.showPlugins,
        alarmTypes: env.settings.alarmTypes,
        enable: env.settings.enable
      },
      api: {
        enabled: env.api_secret ? true : false,
        version: 'v1'
      },
      multiTenant: {
        enabled: true,
        mode: env.multiTenantMode || 'subdomain'
      }
    };
    
    res.json({
      success: true,
      data: config
    });
    
  } catch (error) {
    console.error('Config error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch configuration' 
    });
  }
});

// GET /api/v1/admin/system/logs - Recent logs
router.get('/logs', async function(req, res) {
  try {
    const ctx = req.app.get('ctx');
    const store = ctx.env.storageSupport;
    
    const limit = parseInt(req.query.limit) || 100;
    const level = req.query.level; // error, warn, info
    const search = req.query.search;
    
    // Build filter
    const filter = {};
    if (level) {
      filter.level = level;
    }
    if (search) {
      filter.$or = [
        { message: { $regex: search, $options: 'i' } },
        { error: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Get recent logs (if logging to database)
    // This assumes you have a logs collection - adjust as needed
    let logs = [];
    try {
      logs = await store.db.collection('logs')
        .find(filter)
        .sort({ timestamp: -1 })
        .limit(limit)
        .toArray();
    } catch (e) {
      // Logs collection might not exist
      logs = [{
        level: 'info',
        message: 'Database logging not configured',
        timestamp: new Date()
      }];
    }
    
    res.json({
      success: true,
      data: {
        logs,
        count: logs.length,
        filter
      }
    });
    
  } catch (error) {
    console.error('Logs error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch logs' 
    });
  }
});

// POST /api/v1/admin/system/maintenance - Maintenance tasks
router.post('/maintenance', async function(req, res) {
  try {
    const ctx = req.app.get('ctx');
    const store = ctx.env.storageSupport;
    const { task } = req.body;
    
    let result = {};
    
    switch (task) {
      case 'clear-old-data':
        // Clear data older than specified days
        const days = parseInt(req.body.days) || 90;
        const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        
        // Get all tenants
        const tenants = await store.db.collection('tenants').find({}).toArray();
        let totalDeleted = 0;
        
        for (const tenant of tenants) {
          const tenantId = tenant._id;
          
          // Delete old entries
          const entriesResult = await store.db.collection(`entries_${tenantId}`)
            .deleteMany({ date: { $lt: cutoffDate } });
          
          // Delete old treatments
          const treatmentsResult = await store.db.collection(`treatments_${tenantId}`)
            .deleteMany({ created_at: { $lt: cutoffDate } });
          
          totalDeleted += entriesResult.deletedCount + treatmentsResult.deletedCount;
        }
        
        result = {
          message: 'Old data cleared',
          deletedCount: totalDeleted,
          cutoffDate
        };
        break;
        
      case 'compact-database':
        // Run database compaction
        await store.db.admin().command({ compact: 'tenants' });
        await store.db.admin().command({ compact: 'users' });
        
        result = {
          message: 'Database compaction initiated'
        };
        break;
        
      case 'clear-cache':
        // Clear any application caches
        if (global.gc) {
          global.gc();
          result = {
            message: 'Garbage collection triggered'
          };
        } else {
          result = {
            message: 'Garbage collection not available'
          };
        }
        break;
        
      case 'rebuild-indexes':
        // Rebuild database indexes
        const collections = await store.db.listCollections().toArray();
        let indexCount = 0;
        
        for (const coll of collections) {
          await store.db.collection(coll.name).reIndex();
          indexCount++;
        }
        
        result = {
          message: 'Indexes rebuilt',
          collectionsProcessed: indexCount
        };
        break;
        
      default:
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid maintenance task' 
        });
    }
    
    // Log maintenance action
    await store.db.collection('admin_audit').insertOne({
      action: `system.maintenance.${task}`,
      user: req.user._id,
      userEmail: req.user.email,
      details: result,
      timestamp: new Date()
    });
    
    res.json({
      success: true,
      data: result
    });
    
  } catch (error) {
    console.error('Maintenance error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Maintenance task failed' 
    });
  }
});

// Helper function to get disk stats
async function getDiskStats() {
  // This is platform-specific and may need adjustment
  try {
    const { exec } = require('child_process');
    const util = require('util');
    const execPromise = util.promisify(exec);
    
    if (os.platform() === 'darwin' || os.platform() === 'linux') {
      const { stdout } = await execPromise('df -k /');
      const lines = stdout.trim().split('\n');
      const parts = lines[1].split(/\s+/);
      
      const total = parseInt(parts[1]) * 1024;
      const used = parseInt(parts[2]) * 1024;
      const available = parseInt(parts[3]) * 1024;
      const usePercent = parseInt(parts[4]);
      
      return {
        status: usePercent > 90 ? 'warning' : 'healthy',
        total: formatBytes(total),
        used: formatBytes(used),
        available: formatBytes(available),
        usePercent: usePercent + '%'
      };
    }
  } catch (e) {
    return null;
  }
}

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
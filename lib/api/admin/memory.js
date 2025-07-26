'use strict';

const express = require('express');
const router = express.Router();
const os = require('os');

// GET /api/v1/admin/memory - Get memory usage statistics
router.get('/', function(req, res) {
  const memUsage = process.memoryUsage();
  const osMemory = {
    total: os.totalmem(),
    free: os.freemem(),
    used: os.totalmem() - os.freemem()
  };
  
  // Convert to MB
  const toMB = (bytes) => (bytes / 1024 / 1024).toFixed(2);
  
  // Calculate percentages
  const heapPercentage = ((memUsage.heapUsed / memUsage.heapTotal) * 100).toFixed(2);
  const osPercentage = ((osMemory.used / osMemory.total) * 100).toFixed(2);
  
  // Get uptime
  const uptime = process.uptime();
  const uptimeHours = Math.floor(uptime / 3600);
  const uptimeMinutes = Math.floor((uptime % 3600) / 60);
  
  res.json({
    success: true,
    data: {
      process: {
        rss: toMB(memUsage.rss) + ' MB',           // Resident Set Size
        heapTotal: toMB(memUsage.heapTotal) + ' MB',
        heapUsed: toMB(memUsage.heapUsed) + ' MB',
        heapPercentage: heapPercentage + '%',
        external: toMB(memUsage.external) + ' MB',
        arrayBuffers: toMB(memUsage.arrayBuffers) + ' MB'
      },
      system: {
        total: toMB(osMemory.total) + ' MB',
        free: toMB(osMemory.free) + ' MB',
        used: toMB(osMemory.used) + ' MB',
        usedPercentage: osPercentage + '%'
      },
      uptime: `${uptimeHours}h ${uptimeMinutes}m`,
      nodeVersion: process.version,
      platform: process.platform,
      warnings: getMemoryWarnings(memUsage, osMemory)
    }
  });
});

// GET /api/v1/admin/memory/gc - Force garbage collection (if enabled)
router.post('/gc', function(req, res) {
  if (global.gc) {
    const before = process.memoryUsage();
    global.gc();
    const after = process.memoryUsage();
    
    const freed = {
      rss: (before.rss - after.rss) / 1024 / 1024,
      heapTotal: (before.heapTotal - after.heapTotal) / 1024 / 1024,
      heapUsed: (before.heapUsed - after.heapUsed) / 1024 / 1024
    };
    
    res.json({
      success: true,
      message: 'Garbage collection completed',
      freed: {
        rss: freed.rss.toFixed(2) + ' MB',
        heapTotal: freed.heapTotal.toFixed(2) + ' MB',
        heapUsed: freed.heapUsed.toFixed(2) + ' MB'
      }
    });
  } else {
    res.status(501).json({
      success: false,
      error: 'Garbage collection not enabled. Start with --expose-gc flag'
    });
  }
});

// GET /api/v1/admin/memory/recommendations - Get optimization recommendations
router.get('/recommendations', function(req, res) {
  const memUsage = process.memoryUsage();
  const heapPercentage = (memUsage.heapUsed / memUsage.heapTotal) * 100;
  
  const recommendations = [];
  
  // High heap usage
  if (heapPercentage > 80) {
    recommendations.push({
      severity: 'high',
      issue: 'High heap usage',
      solution: 'Increase --max-old-space-size or optimize memory usage'
    });
  }
  
  // Large RSS
  if (memUsage.rss > 400 * 1024 * 1024) { // 400MB
    recommendations.push({
      severity: 'medium',
      issue: 'High memory usage approaching dyno limit',
      solution: 'Implement data cleanup, reduce cache sizes, or upgrade dyno'
    });
  }
  
  // Node.js settings
  recommendations.push({
    severity: 'info',
    issue: 'Memory limit configuration',
    solution: 'Set NODE_OPTIONS="--max-old-space-size=400 --optimize-for-size"'
  });
  
  // Database optimization
  recommendations.push({
    severity: 'info',
    issue: 'Database connection pooling',
    solution: 'Reduce maxPoolSize to 10 or less for 512MB dynos'
  });
  
  // Data retention
  recommendations.push({
    severity: 'info',
    issue: 'Data retention',
    solution: 'Implement automatic cleanup of data older than 90 days'
  });
  
  res.json({
    success: true,
    data: {
      currentUsage: {
        heap: heapPercentage.toFixed(2) + '%',
        rss: (memUsage.rss / 1024 / 1024).toFixed(2) + ' MB'
      },
      recommendations: recommendations
    }
  });
});

function getMemoryWarnings(processMemory, systemMemory) {
  const warnings = [];
  
  // Process warnings
  const heapPercentage = (processMemory.heapUsed / processMemory.heapTotal) * 100;
  if (heapPercentage > 90) {
    warnings.push('CRITICAL: Heap usage above 90%');
  } else if (heapPercentage > 80) {
    warnings.push('WARNING: Heap usage above 80%');
  }
  
  // Dyno limit warning (512MB for Standard-1X)
  const rssMB = processMemory.rss / 1024 / 1024;
  if (rssMB > 450) {
    warnings.push('CRITICAL: Approaching 512MB dyno memory limit');
  } else if (rssMB > 400) {
    warnings.push('WARNING: High memory usage (>400MB)');
  }
  
  // System memory
  const sysPercentage = (systemMemory.used / systemMemory.total) * 100;
  if (sysPercentage > 90) {
    warnings.push('System memory usage above 90%');
  }
  
  return warnings;
}

module.exports = router;
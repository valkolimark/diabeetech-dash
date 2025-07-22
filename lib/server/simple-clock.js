'use strict';

const express = require('express');
const path = require('path');

function simpleClock() {
  const app = new express();

  // Simple clock endpoint that doesn't require complex authentication
  app.get('/:face?', async (req, res) => {
    const face = req.params.face || 'bgclock';
    const tenant = req.query.tenant || req.get('X-Tenant-Subdomain') || '';
    
    // Get tenant context from request
    const ctx = req.ctx;
    if (!ctx || !ctx.store || !ctx.store.db) {
      return res.status(400).json({
        status: 400,
        message: 'Tenant context not found'
      });
    }

    try {
      // Get latest glucose entries from tenant's database
      const entries = await ctx.store.db.collection('entries')
        .find({})
        .sort({ date: -1 })
        .limit(10)
        .toArray();
        
      const latestEntry = entries[0] || {};
      const sgv = latestEntry.sgv || '---';
      const direction = latestEntry.direction || '';
      const date = latestEntry.date ? new Date(latestEntry.date) : new Date();
      const minutesAgo = Math.floor((Date.now() - date) / 60000);
      
      // Get settings for units
      const settings = await ctx.store.db.collection('settings').findOne({});
      const units = (settings && settings.units) || 'mg/dl';
      
      // Generate clock HTML based on face type
      let clockHtml = '';
      
      if (face === 'simple') {
        clockHtml = generateSimpleClock(sgv, direction, minutesAgo, units);
      } else {
        clockHtml = generateBgClock(sgv, direction, minutesAgo, units, entries);
      }
      
      res.send(clockHtml);
    } catch (err) {
      console.error('Error in simple clock:', err);
      res.status(500).send('Error loading clock data');
    }
  });

  function generateBgClock(sgv, direction, minutesAgo, units, entries) {
    const directionSymbol = getDirectionSymbol(direction);
    const delta = entries.length > 1 ? sgv - entries[1].sgv : 0;
    const deltaSign = delta >= 0 ? '+' : '';
    
    return `
<!DOCTYPE html>
<html>
<head>
  <title>Nightscout Clock</title>
  <meta http-equiv="refresh" content="60">
  <style>
    body {
      background-color: black;
      color: #4cff4c;
      font-family: Arial, sans-serif;
      margin: 0;
      padding: 20px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100vh;
    }
    .glucose-value {
      font-size: 120px;
      font-weight: bold;
      margin: 0;
    }
    .direction {
      font-size: 80px;
      display: inline-block;
      margin-left: 20px;
    }
    .delta {
      font-size: 40px;
      margin-top: 10px;
    }
    .time-ago {
      font-size: 30px;
      margin-top: 20px;
      color: #888;
    }
    .units {
      font-size: 30px;
      margin-top: 10px;
    }
  </style>
</head>
<body>
  <div>
    <span class="glucose-value">${sgv}</span>
    <span class="direction">${directionSymbol}</span>
  </div>
  <div class="delta">${deltaSign}${delta} ${units}</div>
  <div class="time-ago">${minutesAgo} min ago</div>
</body>
</html>
    `;
  }

  function generateSimpleClock(sgv, direction, minutesAgo, units) {
    const directionSymbol = getDirectionSymbol(direction);
    
    return `
<!DOCTYPE html>
<html>
<head>
  <title>Nightscout Simple Clock</title>
  <meta http-equiv="refresh" content="60">
  <style>
    body {
      background-color: black;
      color: white;
      font-family: Arial, sans-serif;
      margin: 0;
      padding: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      font-size: 200px;
      font-weight: bold;
    }
  </style>
</head>
<body>
  ${sgv} ${directionSymbol}
</body>
</html>
    `;
  }

  function getDirectionSymbol(direction) {
    const directionMap = {
      'DoubleUp': '⇈',
      'SingleUp': '↑',
      'FortyFiveUp': '↗',
      'Flat': '→',
      'FortyFiveDown': '↘',
      'SingleDown': '↓',
      'DoubleDown': '⇊',
      'NONE': '⇼',
      'NOT COMPUTABLE': '-',
      'RATE OUT OF RANGE': '⇕'
    };
    return directionMap[direction] || '';
  }

  return app;
}

module.exports = simpleClock;
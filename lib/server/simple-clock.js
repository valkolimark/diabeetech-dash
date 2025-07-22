'use strict';

const express = require('express');
const path = require('path');

function simpleClock() {
  const app = new express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Configuration endpoint
  app.get('/config', async (req, res) => {
    const ctx = req.ctx;
    if (!ctx || !ctx.store || !ctx.store.db) {
      return res.status(400).json({
        status: 400,
        message: 'Tenant context not found'
      });
    }

    try {
      // Load existing config or use defaults
      const config = await ctx.store.db.collection('clockconfig').findOne({}) || getDefaultConfig();
      
      res.send(generateConfigPage(config));
    } catch (err) {
      console.error('Error loading clock config:', err);
      res.status(500).send('Error loading configuration');
    }
  });

  // Save configuration endpoint
  app.post('/config', async (req, res) => {
    const ctx = req.ctx;
    if (!ctx || !ctx.store || !ctx.store.db) {
      return res.status(400).json({
        status: 400,
        message: 'Tenant context not found'
      });
    }

    try {
      const config = {
        lowColor: req.body.lowColor || '#ff0000',
        lowValue: parseInt(req.body.lowValue) || 70,
        slightlyLowColor: req.body.slightlyLowColor || '#ff8c00',
        slightlyLowValue: parseInt(req.body.slightlyLowValue) || 80,
        inRangeColor: req.body.inRangeColor || '#00ff00',
        highValue: parseInt(req.body.highValue) || 180,
        highColor: req.body.highColor || '#ffff00',
        veryHighValue: parseInt(req.body.veryHighValue) || 250,
        veryHighColor: req.body.veryHighColor || '#ff0000',
        refreshInterval: parseInt(req.body.refreshInterval) || 60,
        clockFontSize: parseInt(req.body.clockFontSize) || 120,
        simpleFontSize: parseInt(req.body.simpleFontSize) || 200,
        colorFontSize: parseInt(req.body.colorFontSize) || 150,
        showDelta: req.body.showDelta === 'true',
        showMinutesAgo: req.body.showMinutesAgo === 'true',
        _id: 'clockconfig'
      };

      await ctx.store.db.collection('clockconfig').replaceOne(
        { _id: 'clockconfig' },
        config,
        { upsert: true }
      );

      res.send(generateConfigPage(config, 'Configuration saved successfully!'));
    } catch (err) {
      console.error('Error saving clock config:', err);
      res.status(500).send('Error saving configuration');
    }
  });

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
      
      // Get clock configuration
      const config = await ctx.store.db.collection('clockconfig').findOne({}) || getDefaultConfig();
      
      // Generate clock HTML based on face type
      let clockHtml = '';
      
      if (face === 'simple') {
        clockHtml = generateSimpleClock(sgv, direction, minutesAgo, units, config);
      } else if (face === 'color') {
        clockHtml = generateColorClock(sgv, direction, minutesAgo, units, entries, config);
      } else {
        clockHtml = generateBgClock(sgv, direction, minutesAgo, units, entries, config);
      }
      
      res.send(clockHtml);
    } catch (err) {
      console.error('Error in simple clock:', err);
      res.status(500).send('Error loading clock data');
    }
  });

  function generateBgClock(sgv, direction, minutesAgo, units, entries, config) {
    const directionSymbol = getDirectionSymbol(direction);
    const delta = entries.length > 1 ? sgv - entries[1].sgv : 0;
    const deltaSign = delta >= 0 ? '+' : '';
    
    return `
<!DOCTYPE html>
<html>
<head>
  <title>Nightscout Clock</title>
  <meta http-equiv="refresh" content="${config.refreshInterval}">
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
      font-size: ${config.clockFontSize}px;
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
  ${config.showDelta ? `<div class="delta">${deltaSign}${delta} ${units}</div>` : ''}
  ${config.showMinutesAgo ? `<div class="time-ago">${minutesAgo} min ago</div>` : ''}
</body>
</html>
    `;
  }

  function generateSimpleClock(sgv, direction, minutesAgo, units, config) {
    const directionSymbol = getDirectionSymbol(direction);
    
    return `
<!DOCTYPE html>
<html>
<head>
  <title>Nightscout Simple Clock</title>
  <meta http-equiv="refresh" content="${config.refreshInterval}">
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
      font-size: ${config.simpleFontSize}px;
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

  function generateColorClock(sgv, direction, minutesAgo, units, entries, config) {
    const directionSymbol = getDirectionSymbol(direction);
    const delta = entries.length > 1 ? sgv - entries[1].sgv : 0;
    const deltaSign = delta >= 0 ? '+' : '';
    
    // Determine color based on glucose value
    let bgColor = '#000000'; // black
    let textColor = '#ffffff'; // white
    
    if (sgv !== '---') {
      const value = parseInt(sgv);
      if (value < config.lowValue) {
        bgColor = config.lowColor;
        textColor = '#ffffff';
      } else if (value < config.slightlyLowValue) {
        bgColor = config.slightlyLowColor;
        textColor = '#ffffff';
      } else if (value < config.highValue) {
        bgColor = config.inRangeColor;
        textColor = '#000000';
      } else if (value < config.veryHighValue) {
        bgColor = config.highColor;
        textColor = '#000000';
      } else {
        bgColor = config.veryHighColor;
        textColor = '#ffffff';
      }
    }
    
    return `
<!DOCTYPE html>
<html>
<head>
  <title>Nightscout Color Clock</title>
  <meta http-equiv="refresh" content="${config.refreshInterval}">
  <style>
    body {
      background-color: ${bgColor};
      color: ${textColor};
      font-family: Arial, sans-serif;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100vh;
      transition: background-color 0.5s ease;
    }
    .main-display {
      font-size: ${config.colorFontSize}px;
      font-weight: bold;
      line-height: 1;
    }
    .direction {
      font-size: 100px;
      display: inline-block;
      margin-left: 20px;
    }
    .delta {
      font-size: 50px;
      margin-top: 20px;
    }
    .time-ago {
      font-size: 40px;
      margin-top: 20px;
      opacity: 0.8;
    }
  </style>
</head>
<body>
  <div class="main-display">
    ${sgv}<span class="direction">${directionSymbol}</span>
  </div>
  ${config.showDelta ? `<div class="delta">${deltaSign}${delta} ${units}</div>` : ''}
  ${config.showMinutesAgo ? `<div class="time-ago">${minutesAgo} min ago</div>` : ''}
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

  function getDefaultConfig() {
    return {
      lowColor: '#ff0000',
      lowValue: 70,
      slightlyLowColor: '#ff8c00',
      slightlyLowValue: 80,
      inRangeColor: '#00ff00',
      highValue: 180,
      highColor: '#ffff00',
      veryHighValue: 250,
      veryHighColor: '#ff0000',
      refreshInterval: 60,
      clockFontSize: 120,
      simpleFontSize: 200,
      colorFontSize: 150,
      showDelta: true,
      showMinutesAgo: true
    };
  }

  function generateConfigPage(config, message) {
    return `
<!DOCTYPE html>
<html>
<head>
  <title>Clock Configuration</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    h1 {
      color: #333;
    }
    .form-group {
      margin-bottom: 15px;
    }
    label {
      display: inline-block;
      width: 200px;
      font-weight: bold;
    }
    input[type="color"], input[type="number"], select {
      width: 200px;
      padding: 5px;
    }
    .color-preview {
      display: inline-block;
      width: 20px;
      height: 20px;
      margin-left: 10px;
      border: 1px solid #ccc;
      vertical-align: middle;
    }
    button {
      background-color: #4CAF50;
      color: white;
      padding: 10px 20px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 16px;
    }
    button:hover {
      background-color: #45a049;
    }
    .message {
      background-color: #d4edda;
      border: 1px solid #c3e6cb;
      color: #155724;
      padding: 10px;
      margin-bottom: 20px;
      border-radius: 4px;
    }
    fieldset {
      border: 1px solid #ddd;
      padding: 15px;
      margin-bottom: 20px;
      border-radius: 4px;
    }
    legend {
      font-weight: bold;
      color: #333;
    }
  </style>
</head>
<body>
  <h1>Clock Configuration</h1>
  ${message ? `<div class="message">${message}</div>` : ''}
  
  <form method="POST" action="/sclock/config">
    <fieldset>
      <legend>Color Thresholds</legend>
      
      <div class="form-group">
        <label for="lowColor">Low Color:</label>
        <input type="color" id="lowColor" name="lowColor" value="${config.lowColor}">
        <span class="color-preview" style="background-color: ${config.lowColor}"></span>
        <label for="lowValue" style="width: 100px; margin-left: 20px;">Below:</label>
        <input type="number" id="lowValue" name="lowValue" value="${config.lowValue}" style="width: 80px;"> mg/dl
      </div>
      
      <div class="form-group">
        <label for="slightlyLowColor">Slightly Low Color:</label>
        <input type="color" id="slightlyLowColor" name="slightlyLowColor" value="${config.slightlyLowColor}">
        <span class="color-preview" style="background-color: ${config.slightlyLowColor}"></span>
        <label for="slightlyLowValue" style="width: 100px; margin-left: 20px;">Below:</label>
        <input type="number" id="slightlyLowValue" name="slightlyLowValue" value="${config.slightlyLowValue}" style="width: 80px;"> mg/dl
      </div>
      
      <div class="form-group">
        <label for="inRangeColor">In Range Color:</label>
        <input type="color" id="inRangeColor" name="inRangeColor" value="${config.inRangeColor}">
        <span class="color-preview" style="background-color: ${config.inRangeColor}"></span>
        <label for="highValue" style="width: 100px; margin-left: 20px;">Below:</label>
        <input type="number" id="highValue" name="highValue" value="${config.highValue}" style="width: 80px;"> mg/dl
      </div>
      
      <div class="form-group">
        <label for="highColor">High Color:</label>
        <input type="color" id="highColor" name="highColor" value="${config.highColor}">
        <span class="color-preview" style="background-color: ${config.highColor}"></span>
        <label for="veryHighValue" style="width: 100px; margin-left: 20px;">Below:</label>
        <input type="number" id="veryHighValue" name="veryHighValue" value="${config.veryHighValue}" style="width: 80px;"> mg/dl
      </div>
      
      <div class="form-group">
        <label for="veryHighColor">Very High Color:</label>
        <input type="color" id="veryHighColor" name="veryHighColor" value="${config.veryHighColor}">
        <span class="color-preview" style="background-color: ${config.veryHighColor}"></span>
        <span style="margin-left: 120px;">Above ${config.veryHighValue} mg/dl</span>
      </div>
    </fieldset>
    
    <fieldset>
      <legend>Display Options</legend>
      
      <div class="form-group">
        <label for="refreshInterval">Refresh Interval:</label>
        <input type="number" id="refreshInterval" name="refreshInterval" value="${config.refreshInterval}" min="10" max="300"> seconds
      </div>
      
      <div class="form-group">
        <label for="clockFontSize">Clock Font Size:</label>
        <input type="number" id="clockFontSize" name="clockFontSize" value="${config.clockFontSize}" min="50" max="300"> px
      </div>
      
      <div class="form-group">
        <label for="simpleFontSize">Simple Clock Font Size:</label>
        <input type="number" id="simpleFontSize" name="simpleFontSize" value="${config.simpleFontSize}" min="50" max="400"> px
      </div>
      
      <div class="form-group">
        <label for="colorFontSize">Color Clock Font Size:</label>
        <input type="number" id="colorFontSize" name="colorFontSize" value="${config.colorFontSize}" min="50" max="300"> px
      </div>
      
      <div class="form-group">
        <label for="showDelta">Show Delta:</label>
        <select id="showDelta" name="showDelta">
          <option value="true" ${config.showDelta ? 'selected' : ''}>Yes</option>
          <option value="false" ${!config.showDelta ? 'selected' : ''}>No</option>
        </select>
      </div>
      
      <div class="form-group">
        <label for="showMinutesAgo">Show Minutes Ago:</label>
        <select id="showMinutesAgo" name="showMinutesAgo">
          <option value="true" ${config.showMinutesAgo ? 'selected' : ''}>Yes</option>
          <option value="false" ${!config.showMinutesAgo ? 'selected' : ''}>No</option>
        </select>
      </div>
    </fieldset>
    
    <button type="submit">Save Configuration</button>
  </form>
  
  <script>
    // Update color previews when color inputs change
    document.querySelectorAll('input[type="color"]').forEach(input => {
      input.addEventListener('change', (e) => {
        const preview = e.target.nextElementSibling;
        if (preview && preview.classList.contains('color-preview')) {
          preview.style.backgroundColor = e.target.value;
        }
      });
    });
  </script>
</body>
</html>
    `;
  }

  return app;
}

module.exports = simpleClock;
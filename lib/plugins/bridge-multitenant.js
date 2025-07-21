'use strict';

var engine = require('share2nightscout-bridge');
var _ = require('lodash');

// Track the most recently seen record per tenant
var mostRecentRecords = {};
var bridgeInstances = {};

function init(env, bus) {
  console.log('Initializing multi-tenant bridge plugin');
  return {
    startForTenant: startForTenant,
    stopForTenant: stopForTenant,
    stopAll: stopAll
  };
}

function startForTenant(tenantId, tenantSettings, entries, tenantCtx) {
  console.log('Starting bridge for tenant:', tenantId);
  
  // Stop existing instance if any
  stopForTenant(tenantId);
  
  if (!tenantSettings || !tenantSettings.bridge || !tenantSettings.bridge.userName || !tenantSettings.bridge.password) {
    console.log('Bridge not configured for tenant:', tenantId);
    return false;
  }
  
  if (!tenantSettings.bridge.enable) {
    console.log('Bridge disabled for tenant:', tenantId);
    return false;
  }
  
  const bridgeSettings = tenantSettings.bridge;
  const opts = {
    login: {
      accountName: bridgeSettings.userName,
      password: bridgeSettings.password
    },
    interval: tenantSettings.bridge_interval || bridgeSettings.interval || 60000 * 2.6, // Default: 2.6 minutes
    fetch: {
      maxCount: bridgeSettings.maxCount || 1,
      minutes: bridgeSettings.minutes || 1440
    },
    nightscout: {
      // Dummy values to prevent posting errors
      endpoint: 'http://localhost',
      secret: 'dummy-secret-not-used'
    },
    maxFailures: bridgeSettings.maxFailures || 3,
    firstFetchCount: bridgeSettings.firstFetchCount || 3
  };
  
  // Validate interval
  if (opts.interval < 1000 || opts.interval > 300000) {
    console.error("Invalid interval for tenant " + tenantId + ": [" + opts.interval + "ms]. Using default.");
    opts.interval = 60000 * 2.6;
  }
  
  // Initialize most recent record tracking for this tenant
  if (!mostRecentRecords[tenantId]) {
    mostRecentRecords[tenantId] = new Date().getTime() - opts.fetch.minutes * 60000;
  }
  
  // Create bridge callback for this tenant
  opts.callback = createBridgeCallback(tenantId, entries, tenantCtx);
  
  let last_run = new Date(0).getTime();
  let last_ondemand = new Date(0).getTime();
  
  function should_run() {
    const msRUN_AFTER = (300 + 20) * 1000;
    const msNow = new Date().getTime();
    const mostRecentRecord = mostRecentRecords[tenantId];
    const next_entry_expected = mostRecentRecord + msRUN_AFTER;
    
    if (next_entry_expected > msNow) {
      const ms_since_last_run = msNow - last_run;
      if (ms_since_last_run < opts.interval) {
        return false;
      }
      
      last_run = msNow;
      last_ondemand = new Date(0).getTime();
      console.log("DEXCOM: Running poll for tenant " + tenantId);
      return true;
    }
    
    const ms_since_last_run = msNow - last_ondemand;
    
    if (ms_since_last_run < opts.interval) {
      return false;
    }
    last_run = msNow;
    last_ondemand = msNow;
    console.log("DEXCOM: Data due for tenant " + tenantId + ", running extra poll");
    return true;
  }
  
  // Create timer for this tenant
  const timer = setInterval(function () {
    if (!should_run()) return;
    
    const mostRecentRecord = mostRecentRecords[tenantId];
    opts.fetch.minutes = parseInt((new Date() - mostRecentRecord) / 60000);
    opts.fetch.maxCount = parseInt((opts.fetch.minutes / 5) + 1);
    opts.firstFetchCount = opts.fetch.maxCount;
    console.log("Fetching Share Data for tenant " + tenantId + ": ", 'minutes', opts.fetch.minutes, 'maxCount', opts.fetch.maxCount);
    
    try {
      engine(opts);
    } catch (err) {
      console.error('Bridge error for tenant ' + tenantId + ':', err);
    }
  }, 1000);
  
  // Store instance info
  bridgeInstances[tenantId] = {
    timer: timer,
    settings: bridgeSettings,
    started: new Date()
  };
  
  console.log('Bridge started successfully for tenant:', tenantId);
  return true;
}

function createBridgeCallback(tenantId, entries, tenantCtx) {
  return function bridgeCallback(err, glucose) {
    if (err) {
      console.error('Bridge error for tenant ' + tenantId + ':', err);
      
      // Emit error notification
      if (tenantCtx && tenantCtx.bus) {
        tenantCtx.bus.emit('notification', {
          tenantId: tenantId,
          clear: false,
          title: 'Dexcom Bridge Error',
          message: 'Failed to fetch data: ' + err.message,
          level: 2,
          group: 'Bridge'
        });
      }
    } else {
      if (glucose && glucose.length > 0) {
        console.log('Bridge received ' + glucose.length + ' entries for tenant ' + tenantId);
        
        // Update most recent record for this tenant
        for (var i = 0; i < glucose.length; i++) {
          if (glucose[i].date > mostRecentRecords[tenantId]) {
            mostRecentRecords[tenantId] = glucose[i].date;
          }
        }
        
        // Store entries
        entries.create(glucose, function stored(err, created) {
          if (err) {
            console.error('Bridge storage error for tenant ' + tenantId + ':', err);
          } else {
            console.log('Stored ' + (created ? created.length : 0) + ' entries for tenant ' + tenantId);
            
            // Emit data update event
            if (tenantCtx && tenantCtx.bus) {
              // Emit event to reload data and update WebSocket clients
              console.log('Bridge emitting data-received event for tenant ' + tenantId);
              // Use the shared bus instance that WebSocket is listening to
              tenantCtx.bus.emit('data-received', {
                tenantId: tenantId,
                source: 'bridge',
                count: created ? created.length : 0
              });
            }
          }
        });
      }
    }
  };
}

function stopForTenant(tenantId) {
  if (bridgeInstances[tenantId]) {
    console.log('Stopping bridge for tenant:', tenantId);
    clearInterval(bridgeInstances[tenantId].timer);
    delete bridgeInstances[tenantId];
    return true;
  }
  return false;
}

function stopAll() {
  console.log('Stopping all bridge instances');
  const tenantIds = Object.keys(bridgeInstances);
  tenantIds.forEach(function(tenantId) {
    stopForTenant(tenantId);
  });
}

// Export functions
init.startForTenant = startForTenant;
init.stopForTenant = stopForTenant;
init.stopAll = stopAll;

module.exports = init;
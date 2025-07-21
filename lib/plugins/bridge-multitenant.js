'use strict';

var engine = require('share2nightscout-bridge');

// Monkey patch to prevent posting errors
var originalEngine = engine;
engine = function(opts) {
  // Wrap the callback to prevent errors from propagating
  if (opts.callback) {
    var originalCallback = opts.callback;
    opts.callback = function(err, glucose) {
      // Call our callback
      originalCallback(err, glucose);
      // Prevent further processing by the bridge
      if (!err && glucose) {
        // Return early to prevent posting
        return;
      }
    };
  }
  
  // Disable posting by setting invalid endpoint
  if (opts.nightscout) {
    opts.nightscout.endpoint = null;
    opts.nightscout.entries = null;
  }
  
  return originalEngine(opts);
};
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

function startForTenant(tenantId, tenantSettings, entries, tenantCtx, entriesFactory) {
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
      // Use valid dummy values to prevent hashing errors
      endpoint: 'http://localhost:1337/api/v1/entries',
      secret: 'dummy-secret-12345',
      api_secret: 'dummy-secret-12345',
      // Disable direct posting to Nightscout
      direct: false
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
  opts.callback = createBridgeCallback(tenantId, entries, tenantCtx, entriesFactory);
  
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
    started: new Date(),
    entriesFactory: entriesFactory
  };
  
  console.log('Bridge started successfully for tenant:', tenantId);
  return true;
}

function createBridgeCallback(tenantId, entries, tenantCtx, entriesFactory) {
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
        
        // Function to store entries with fresh connection
        const storeEntries = function(entriesToStore) {
          if (entriesFactory) {
            // Use fresh connection if factory is available
            entriesFactory().then(function(freshEntries) {
              freshEntries.create(entriesToStore, handleStored);
            }).catch(function(factoryErr) {
              console.error('Bridge entries factory error for tenant ' + tenantId + ':', factoryErr);
              // Fallback to original entries
              entries.create(entriesToStore, handleStored);
            });
          } else {
            // Use original entries if no factory
            entries.create(entriesToStore, handleStored);
          }
        };
        
        // Handler for stored entries
        const handleStored = function(err, created) {
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
        };
        
        // Store the entries
        storeEntries(glucose);
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
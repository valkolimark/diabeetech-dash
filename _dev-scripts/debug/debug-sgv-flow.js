// Debug script to trace SGV data flow from WebSocket to client.entries
// Add this to the browser console to monitor data flow

(function debugSGVFlow() {
  console.log('=== STARTING SGV DATA FLOW DEBUG ===');
  
  // Check current state
  if (window.Nightscout && window.Nightscout.client) {
    const client = window.Nightscout.client;
    
    console.log('Current client.entries:', client.entries);
    console.log('Current client.entries length:', client.entries ? client.entries.length : 'undefined');
    
    console.log('Current ddata.sgvs:', client.ddata.sgvs);
    console.log('Current ddata.sgvs length:', client.ddata.sgvs ? client.ddata.sgvs.length : 'undefined');
    
    // Override dataUpdate to add logging
    const originalDataUpdate = client.dataUpdate;
    client.dataUpdate = function(received, headless) {
      console.log('=== dataUpdate called ===');
      console.log('Received data:', received);
      console.log('Received SGVs count:', received && received.sgvs ? received.sgvs.length : 0);
      
      // Log ddata before update
      console.log('ddata.sgvs BEFORE receiveDData:', client.ddata.sgvs ? client.ddata.sgvs.length : 0);
      
      // Call original function
      const result = originalDataUpdate.call(this, received, headless);
      
      // Log ddata after update
      console.log('ddata.sgvs AFTER receiveDData:', client.ddata.sgvs ? client.ddata.sgvs.length : 0);
      console.log('client.entries AFTER prepareEntries:', client.entries ? client.entries.length : 0);
      
      if (client.ddata.sgvs && client.ddata.sgvs.length > 0) {
        console.log('First SGV in ddata:', client.ddata.sgvs[0]);
      }
      
      if (client.entries && client.entries.length > 0) {
        console.log('First entry in client.entries:', client.entries[0]);
      }
      
      return result;
    };
    
    // Override prepareEntries to add logging
    const prepareEntriesCode = `
      function prepareEntries () {
        console.log('=== prepareEntries called ===');
        console.log('ddata.sgvs at start:', client.ddata.sgvs ? client.ddata.sgvs.length : 0);
        
        // Post processing after data is in
        var temp1 = [];
        var sbx = client.sbx.withExtendedSettings(client.rawbg);

        if (client.ddata.cal && client.rawbg.isEnabled(sbx)) {
          temp1 = client.ddata.sgvs.map(function(entry) {
            var rawbgValue = client.rawbg.showRawBGs(entry.mgdl, entry.noise, client.ddata.cal, sbx) ? client.rawbg.calc(entry, client.ddata.cal, sbx) : 0;
            if (rawbgValue > 0) {
              return { mills: entry.mills - 2000, mgdl: rawbgValue, color: 'white', type: 'rawbg' };
            } else {
              return null;
            }
          }).filter(function(entry) {
            return entry !== null;
          });
        }
        console.log('temp1 (rawbg entries):', temp1.length);
        
        var temp2 = client.ddata.sgvs.map(function(obj) {
          const entry = { mills: obj.mills, mgdl: obj.mgdl, direction: obj.direction, color: sgvToColor(obj.mgdl), type: 'sgv', noise: obj.noise, filtered: obj.filtered, unfiltered: obj.unfiltered };
          console.log('Mapping SGV:', obj, 'to entry:', entry);
          return entry;
        });
        console.log('temp2 (sgv entries):', temp2.length);
        
        client.entries = [];
        client.entries = client.entries.concat(temp1, temp2);
        console.log('After concat temp1 + temp2:', client.entries.length);

        client.entries = client.entries.concat(client.ddata.mbgs.map(function(obj) {
          return { mills: obj.mills, mgdl: obj.mgdl, color: 'red', type: 'mbg', device: obj.device };
        }));
        console.log('After adding mbgs:', client.entries.length);

        var tooOld = client.now - times.hours(48).msecs;
        console.log('Filtering entries older than:', new Date(tooOld));
        
        var beforeFilter = client.entries.length;
        client.entries = _.filter(client.entries, function notTooOld (entry) {
          const keep = entry.mills > tooOld;
          if (!keep) {
            console.log('Filtering out old entry:', entry);
          }
          return keep;
        });
        console.log('After filtering old entries: ' + beforeFilter + ' -> ' + client.entries.length);

        client.entries.forEach(function(point) {
          if (point.mgdl < 39) {
            point.color = 'transparent';
          }
        });

        client.entries.sort(function sorter (a, b) {
          return a.mills - b.mills;
        });
        
        console.log('Final client.entries count:', client.entries.length);
        if (client.entries.length > 0) {
          console.log('First entry:', client.entries[0]);
          console.log('Last entry:', client.entries[client.entries.length - 1]);
        }
      }
    `;
    
    console.log('Debug hooks installed. Wait for next data update...');
    
    // Also check socket status
    if (client.socket) {
      console.log('Socket connected:', client.socket.connected);
      console.log('Socket ID:', client.socket.id);
    }
    
  } else {
    console.error('Nightscout client not found!');
  }
})();
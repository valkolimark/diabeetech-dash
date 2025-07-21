// Check if live data is coming in
(function() {
  console.log('=== LIVE DATA CHECK ===');
  
  // Check WebSocket connection
  if (window.socket && window.socket.connected) {
    console.log('✅ WebSocket connected');
  } else {
    console.log('❌ WebSocket not connected');
  }
  
  // Check latest data
  if (window.Nightscout && window.Nightscout.client) {
    const client = window.Nightscout.client;
    
    // Check entries
    if (client.entries && client.entries.length > 0) {
      const latest = client.entries[client.entries.length - 1];
      const time = new Date(latest.mills);
      const now = new Date();
      const ageMinutes = Math.round((now - time) / 60000);
      
      console.log('\n📊 Latest SGV Reading:');
      console.log('- Value:', latest.mgdl, 'mg/dL');
      console.log('- Time:', time.toLocaleTimeString());
      console.log('- Age:', ageMinutes, 'minutes ago');
      
      if (ageMinutes < 6) {
        console.log('✅ Data is LIVE!');
      } else if (ageMinutes < 15) {
        console.log('⚠️ Data is recent but not live');
      } else {
        console.log('❌ Data is stale - bridge may not be working');
      }
      
      // Show last 5 readings
      console.log('\n📈 Recent readings:');
      client.entries.slice(-5).reverse().forEach((entry, i) => {
        const entryTime = new Date(entry.mills);
        const age = Math.round((now - entryTime) / 60000);
        console.log(`${i+1}. ${entryTime.toLocaleTimeString()} (${age}m ago) - ${entry.mgdl} mg/dL`);
      });
    } else {
      console.log('❌ No SGV data found');
    }
    
    // Listen for new data
    console.log('\n👂 Listening for new data updates...');
    let updateCount = 0;
    const originalUpdate = client.dataUpdate;
    client.dataUpdate = function(data) {
      updateCount++;
      console.log(`\n🔄 Data update #${updateCount} received at`, new Date().toLocaleTimeString());
      if (data && data.sgvs && data.sgvs.length > 0) {
        console.log('- New SGV count:', data.sgvs.length);
        const latest = data.sgvs[data.sgvs.length - 1];
        console.log('- Latest value:', latest.mgdl || latest.sgv, 'mg/dL');
      }
      // Call original update function
      if (originalUpdate) {
        originalUpdate.call(this, data);
      }
    };
  }
})();
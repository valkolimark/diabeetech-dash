// Check data freshness in the browser console
(function() {
  if (window.Nightscout && window.Nightscout.client && window.Nightscout.client.entries) {
    const entries = window.Nightscout.client.entries;
    if (entries.length > 0) {
      const lastEntry = entries[entries.length - 1];
      const lastTime = new Date(lastEntry.mills);
      const now = new Date();
      const ageMinutes = Math.round((now - lastTime) / 60000);
      
      console.log('=== DATA FRESHNESS CHECK ===');
      console.log('Last SGV:', lastEntry.mgdl, 'mg/dL');
      console.log('Last SGV time:', lastTime.toLocaleString());
      console.log('Current time:', now.toLocaleString());
      console.log('Data age:', ageMinutes, 'minutes');
      
      if (ageMinutes > 5) {
        console.warn('⚠️ Data is stale! Last reading was', ageMinutes, 'minutes ago');
        console.log('You need to set up a data source (like Dexcom bridge) for live readings');
      } else {
        console.log('✅ Data is fresh');
      }
      
      // Show all entries with timestamps
      console.log('\nAll SGV entries:');
      entries.slice(-10).forEach((entry, i) => {
        const time = new Date(entry.mills);
        console.log(`${i+1}. ${time.toLocaleTimeString()} - ${entry.mgdl} mg/dL`);
      });
    }
  } else {
    console.log('No data available yet');
  }
})();
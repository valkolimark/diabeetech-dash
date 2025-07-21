// Quick opacity debug - paste this in console
(function() {
  if (!window.Nightscout || !window.Nightscout.client) {
    console.error('Nightscout client not ready');
    return;
  }
  
  const client = window.Nightscout.client;
  console.log('=== Opacity Debug ===');
  
  // Check latest SGV
  console.log('Latest SGV:', client.latestSGV);
  console.log('Latest SGV time:', client.latestSGV ? new Date(client.latestSGV.mills).toLocaleString() : 'none');
  console.log('Current time:', new Date().toLocaleString());
  
  if (client.latestSGV) {
    const now = Date.now();
    const latestTime = client.latestSGV.mills;
    const diff = latestTime - now;
    console.log('Time difference (latest - now):', diff / 1000 / 60, 'minutes');
    console.log('Is latest in future?', diff > 0);
  }
  
  // Check a few recent entries
  if (client.entries && client.entries.length > 0) {
    console.log('\nChecking last 5 entries:');
    const recent = client.entries.slice(-5);
    recent.forEach((entry, i) => {
      const entryTime = new Date(entry.mills);
      const diff = entry.mills - client.latestSGV.mills;
      console.log(`Entry ${i}: ${entryTime.toLocaleTimeString()} - diff from latest: ${diff/1000/60} min`);
    });
  }
})();
// Chart Data Debug Script - Add to index.html to debug chart data issues
(function() {
  console.log('=== Chart Data Debug ===');
  
  // Check if client object exists
  if (typeof window.Nightscout === 'undefined' || !window.Nightscout.client) {
    console.error('Nightscout client not initialized');
    return;
  }
  
  const client = window.Nightscout.client;
  
  // Log client data state
  console.log('Client entries:', client.entries ? client.entries.length : 'undefined');
  console.log('First 3 entries:', client.entries ? client.entries.slice(0, 3) : 'no entries');
  
  console.log('Client SGVs:', client.sbx && client.sbx.data ? client.sbx.data.sgvs.length : 'undefined');
  console.log('First 3 SGVs:', client.sbx && client.sbx.data ? client.sbx.data.sgvs.slice(0, 3) : 'no sgvs');
  
  console.log('Latest SGV:', client.latestSGV);
  console.log('Current time:', new Date());
  console.log('Now (client.now):', client.now, new Date(client.now));
  
  // Check chart object
  if (client.chart) {
    console.log('Chart exists:', !!client.chart());
    console.log('Chart focus element:', client.chart().focus ? 'exists' : 'missing');
    console.log('Chart scales:', {
      xScale: client.chart().xScale ? 'exists' : 'missing',
      yScale: client.chart().yScale ? 'exists' : 'missing'
    });
  }
  
  // Check for focus circles
  if (client.chart && client.chart().focus) {
    const focusCircles = client.chart().focus.selectAll('circle.entry-dot');
    console.log('Focus circles count:', focusCircles.size());
    console.log('Focus circles data:', focusCircles.data());
  }
  
  // Monitor data updates
  console.log('Setting up data update monitor...');
  let updateCount = 0;
  const originalUpdate = client.dataUpdate;
  client.dataUpdate = function(delta) {
    updateCount++;
    console.log(`Data update #${updateCount}:`, {
      delta: delta,
      entriesCount: client.entries ? client.entries.length : 0,
      latestSGV: client.latestSGV,
      timestamp: new Date()
    });
    if (originalUpdate) {
      originalUpdate.call(client, delta);
    }
  };
  
  // Check retro status
  console.log('Retro data:', client.retro);
  
  // Check opacity calculation for recent data
  if (client.latestSGV && client.chart && client.chart().futureOpacity) {
    const now = Date.now();
    const latestTime = client.latestSGV.mills;
    const timeDiff = now - latestTime;
    console.log('Time difference from latest SGV:', timeDiff / 1000 / 60, 'minutes');
    console.log('Latest SGV time:', new Date(latestTime).toLocaleString());
    console.log('Current time:', new Date(now).toLocaleString());
    console.log('Opacity for current time:', client.chart().futureOpacity(0));
    console.log('Opacity for 5 min old:', client.chart().futureOpacity(5 * 60 * 1000));
    console.log('Opacity for 30 min old:', client.chart().futureOpacity(30 * 60 * 1000));
    
    // Check if entries are being marked as retro
    if (client.entries && client.entries.length > 0) {
      const recentEntries = client.entries.slice(-5);
      console.log('Recent entries opacity check:');
      recentEntries.forEach(entry => {
        const entryAge = entry.mills - latestTime;
        const opacity = client.chart().futureOpacity(entryAge);
        console.log(`- Entry at ${new Date(entry.mills).toLocaleTimeString()}: age=${entryAge/1000/60}min, opacity=${opacity}`);
      });
    }
  }
})();
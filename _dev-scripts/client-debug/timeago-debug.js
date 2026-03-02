// Debug timeago issue - paste in console
(function() {
  const client = window.Nightscout.client;
  if (!client || !client.sbx) {
    console.error('Client or sandbox not ready');
    return;
  }
  
  console.log('=== TimeAgo Debug ===');
  const sbx = client.sbx;
  
  // Check what lastSGVEntry returns
  const lastSGV = sbx.lastSGVEntry();
  console.log('lastSGVEntry:', lastSGV);
  console.log('lastSGVEntry time:', lastSGV ? new Date(lastSGV.mills).toLocaleString() : 'none');
  
  // Check the actual SGV data
  console.log('Total SGVs in sbx:', sbx.data.sgvs ? sbx.data.sgvs.length : 0);
  if (sbx.data.sgvs && sbx.data.sgvs.length > 0) {
    console.log('First 3 SGVs:', sbx.data.sgvs.slice(0, 3).map(e => ({
      time: new Date(e.mills).toLocaleString(),
      mgdl: e.mgdl
    })));
    console.log('Last 3 SGVs:', sbx.data.sgvs.slice(-3).map(e => ({
      time: new Date(e.mills).toLocaleString(),
      mgdl: e.mgdl
    })));
  }
  
  // Check client.latestSGV
  console.log('\nclient.latestSGV:', client.latestSGV);
  console.log('client.latestSGV time:', client.latestSGV ? new Date(client.latestSGV.mills).toLocaleString() : 'none');
  
  // Check time calculations
  const status = client.timeago.checkStatus(sbx);
  console.log('\nTimeago status:', status);
  
  if (lastSGV) {
    const timeDiff = sbx.time - lastSGV.mills;
    console.log('Time difference:', timeDiff / 1000 / 60, 'minutes');
    console.log('Time difference:', timeDiff / 1000 / 60 / 60 / 24, 'days');
  }
})();
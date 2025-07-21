// Debug delta pill - paste in console
(function() {
  const client = window.Nightscout.client;
  if (!client || !client.sbx) {
    console.error('Client or sandbox not ready');
    return;
  }
  
  console.log('=== Delta Debug ===');
  const sbx = client.sbx;
  
  // Check if delta property exists
  console.log('Delta property:', sbx.properties.delta);
  
  // Check recent buckets
  console.log('Buckets:', sbx.properties.buckets);
  
  // Check if bgnow plugin is enabled
  console.log('BGNow plugin:', client.plugins('bgnow'));
  
  // Check SGV data
  if (sbx.data.sgvs && sbx.data.sgvs.length > 1) {
    const recent = sbx.data.sgvs[sbx.data.sgvs.length - 1];
    const previous = sbx.data.sgvs[sbx.data.sgvs.length - 2];
    console.log('Recent SGV:', recent);
    console.log('Previous SGV:', previous);
    if (recent && previous) {
      const manualDelta = recent.mgdl - previous.mgdl;
      console.log('Manual delta calc:', manualDelta);
    }
  }
  
  // Check enabled plugins
  console.log('Enabled plugins:', sbx.settings.enable);
  
  // Check pills
  const pills = d3.selectAll('.pill');
  console.log('Total pills found:', pills.size());
  pills.each(function(d) {
    const pillText = d3.select(this).text();
    console.log('Pill:', pillText);
  });
})();
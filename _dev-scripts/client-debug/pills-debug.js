// Debug missing pills and forecast - paste in console
(function() {
  const client = window.Nightscout.client;
  if (!client || !client.sbx) {
    console.error('Client or sandbox not ready');
    return;
  }
  
  console.log('=== Pills & Forecast Debug ===');
  const sbx = client.sbx;
  
  // Check enabled plugins
  console.log('\nEnabled plugins:', sbx.settings.enable);
  console.log('Show plugins:', sbx.settings.showPlugins);
  
  // Check alarm types
  console.log('\nAlarm types:', sbx.settings.alarmTypes);
  console.log('Predict enabled?', sbx.settings.alarmTypes && sbx.settings.alarmTypes.indexOf('predict') > -1);
  
  // Check specific plugin status
  console.log('\n=== Plugin Status ===');
  console.log('Delta enabled?', sbx.settings.enable.indexOf('delta') > -1);
  console.log('DBSize enabled?', sbx.settings.enable.indexOf('dbsize') > -1);
  console.log('AR2 enabled?', sbx.settings.enable.indexOf('ar2') > -1);
  console.log('Show forecast setting:', sbx.settings.showForecast);
  
  // Check delta calculation
  console.log('\n=== Delta Data ===');
  console.log('Delta property:', sbx.properties.delta);
  console.log('Buckets:', sbx.properties.buckets);
  
  // Check AR2 forecast
  console.log('\n=== AR2 Forecast ===');
  console.log('AR2 property:', sbx.properties.ar2);
  
  // Check visible pills
  console.log('\n=== Visible Pills ===');
  const pillMajor = d3.selectAll('.pill-major');
  console.log('Major pills count:', pillMajor.size());
  pillMajor.each(function() {
    const elem = d3.select(this);
    console.log('Major pill:', elem.text(), 'id:', elem.attr('id'));
  });
  
  const pillMinor = d3.selectAll('.pill-minor');
  console.log('\nMinor pills count:', pillMinor.size());
  pillMinor.each(function() {
    const elem = d3.select(this);
    console.log('Minor pill:', elem.text(), 'id:', elem.attr('id'));
  });
  
  // Check forecast dots
  console.log('\n=== Forecast Dots ===');
  const forecastDots = d3.selectAll('circle.forecast-dot');
  console.log('Forecast dots count:', forecastDots.size());
  
  // Check SGV data for delta
  if (sbx.data.sgvs && sbx.data.sgvs.length > 1) {
    console.log('\n=== SGV Data for Delta ===');
    const last3 = sbx.data.sgvs.slice(-3);
    last3.forEach((sgv, i) => {
      console.log(`SGV ${i}:`, new Date(sgv.mills).toLocaleTimeString(), sgv.mgdl, 'mg/dL');
    });
  }
})();
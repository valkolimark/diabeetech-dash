// DBSize pill debug - shows why pill might not be visible
(function() {
  const client = window.Nightscout.client;
  if (!client || !client.sbx) {
    console.error('Client or sandbox not ready');
    return;
  }
  
  console.log('=== DBSize Pill Debug ===');
  const sbx = client.sbx;
  
  // Check configuration
  console.log('\n1. Configuration:');
  console.log('   DBSize enabled?', sbx.settings.enable.indexOf('dbsize') > -1);
  console.log('   DBSize in showPlugins?', sbx.settings.showPlugins.indexOf('dbsize') > -1);
  console.log('   Show plugins setting:', sbx.settings.showPlugins);
  
  // Check data
  console.log('\n2. Data:');
  console.log('   DB Stats:', sbx.data.dbstats);
  console.log('   DBSize property:', sbx.properties.dbsize);
  
  // Check pill visibility logic
  if (sbx.properties.dbsize) {
    const prop = sbx.properties.dbsize;
    console.log('\n3. Visibility Logic:');
    console.log('   totalDataSize:', prop.totalDataSize);
    console.log('   totalDataSize >= 0?', prop.totalDataSize >= 0);
    console.log('   Should hide?', !(prop && prop.totalDataSize && prop.totalDataSize >= 0));
  }
  
  // Check DOM
  console.log('\n4. DOM Elements:');
  const allPills = d3.selectAll('.pill');
  console.log('   Total pills:', allPills.size());
  
  const dbsizePill = d3.select('.pill.dbsize');
  if (!dbsizePill.empty()) {
    console.log('   DBSize pill found!');
    console.log('   Classes:', dbsizePill.attr('class'));
    console.log('   Text:', dbsizePill.text());
    console.log('   Hidden?', dbsizePill.classed('hidden'));
    console.log('   Display style:', dbsizePill.style('display'));
  } else {
    console.log('   DBSize pill NOT found in DOM');
  }
  
  // Check plugin
  console.log('\n5. Plugin Status:');
  const plugin = client.plugins('dbsize');
  console.log('   Plugin loaded?', !!plugin);
  console.log('   Has updateVisualisation?', !!(plugin && plugin.updateVisualisation));
  
  // Check for errors
  console.log('\n6. Possible Issues:');
  if (!sbx.data.dbstats || Object.keys(sbx.data.dbstats).length === 0) {
    console.log('   ❌ No database stats received from server');
  }
  if (sbx.properties.dbsize && sbx.properties.dbsize.totalDataSize === 0) {
    console.log('   ❌ Database size is 0 (pill might be hidden)');
  }
  if (sbx.settings.showPlugins.indexOf('dbsize') === -1) {
    console.log('   ❌ DBSize not in showPlugins setting');
  }
})();
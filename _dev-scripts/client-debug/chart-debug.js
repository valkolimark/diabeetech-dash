// Debug chart rendering issues
(function() {
  console.log('[CHART-DEBUG] Setting up chart debugging...');
  
  // Wait for chart to be available
  var checkInterval = setInterval(function() {
    if (window.Nightscout && window.Nightscout.client && window.Nightscout.client.chart) {
      clearInterval(checkInterval);
      console.log('[CHART-DEBUG] Chart object found');
      
      // Check if chart container exists
      var container = document.getElementById('chartContainer');
      if (container) {
        console.log('[CHART-DEBUG] Chart container found:', container);
        console.log('[CHART-DEBUG] Container dimensions:', container.offsetWidth, 'x', container.offsetHeight);
      } else {
        console.log('[CHART-DEBUG] ERROR: Chart container not found!');
      }
      
      // Check SGV data
      if (window.Nightscout.client.entries) {
        console.log('[CHART-DEBUG] SGV entries:', window.Nightscout.client.entries.length);
        if (window.Nightscout.client.entries.length > 0) {
          console.log('[CHART-DEBUG] First SGV:', window.Nightscout.client.entries[0]);
          console.log('[CHART-DEBUG] Last SGV:', window.Nightscout.client.entries[window.Nightscout.client.entries.length - 1]);
        }
      }
      
      // Check profile data
      if (window.Nightscout.client.profilefunctions) {
        console.log('[CHART-DEBUG] Profile functions available');
        try {
          var profile = window.Nightscout.client.profilefunctions.getCurrentProfile();
          console.log('[CHART-DEBUG] Current profile:', profile);
        } catch (e) {
          console.log('[CHART-DEBUG] Error getting current profile:', e.message);
        }
      }
    }
  }, 500);
})();
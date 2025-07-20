// Fix profile authentication issue
(function() {
  'use strict';
  
  // Ensure auth-check.js is loaded first
  if (!window.authCheckLoaded) {
    console.log('Waiting for auth-check.js to load...');
    setTimeout(arguments.callee, 100);
    return;
  }
  
  // Override jQuery ajax to ensure JWT token is included
  var originalAjax = $.ajax;
  $.ajax = function(options) {
    // Add JWT token to API requests
    if (options.url && options.url.startsWith('/api/')) {
      var authToken = localStorage.getItem('authToken');
      if (authToken) {
        options.headers = options.headers || {};
        if (!options.headers['Authorization']) {
          options.headers['Authorization'] = 'Bearer ' + authToken;
          console.log('Added JWT token to request:', options.url);
        }
      }
    }
    return originalAjax.call(this, options);
  };
  
  // Also fix client.headers() if needed
  if (window.Nightscout && window.Nightscout.client) {
    var originalHeaders = window.Nightscout.client.headers;
    window.Nightscout.client.headers = function() {
      var authToken = localStorage.getItem('authToken');
      if (authToken) {
        return {
          'Authorization': 'Bearer ' + authToken
        };
      }
      return originalHeaders ? originalHeaders.call(this) : {};
    };
  }
  
  console.log('Profile authentication fix applied');
})();
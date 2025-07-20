// Profile Editor Authentication Fix
(function() {
  'use strict';
  
  console.log('Profile auth fix loading...');
  
  // Override the status.js loading to handle authentication
  var originalInit = window.Nightscout && window.Nightscout.client && window.Nightscout.client.init;
  
  if (window.Nightscout && window.Nightscout.client) {
    window.Nightscout.client.init = function(callback) {
      console.log('Intercepting client init for profile editor');
      
      // Set up headers function to use JWT token
      window.Nightscout.client.headers = function() {
        var authToken = localStorage.getItem('authToken');
        if (authToken) {
          return {
            'Authorization': 'Bearer ' + authToken
          };
        }
        return {};
      };
      
      // For profile editor, we can bypass the status check and use defaults
      if (window.location.pathname.includes('profile')) {
        console.log('Profile editor detected, using default settings');
        
        // Call the callback with minimal settings
        if (callback && typeof callback === 'function') {
          setTimeout(function() {
            callback();
          }, 100);
        }
        return;
      }
      
      // For other pages, call original init
      if (originalInit) {
        originalInit.call(this, callback);
      }
    };
  }
  
  // Fix jQuery AJAX to always include JWT token
  $(document).ajaxSend(function(event, xhr, settings) {
    if (settings.url && settings.url.includes('/api/')) {
      var authToken = localStorage.getItem('authToken');
      if (authToken && !settings.headers) {
        settings.headers = {};
      }
      if (authToken && settings.headers && !settings.headers['Authorization']) {
        settings.headers['Authorization'] = 'Bearer ' + authToken;
        console.log('Added JWT token to request:', settings.url);
      }
    }
  });
  
  // Also patch $.ajax directly
  var originalAjax = $.ajax;
  $.ajax = function(options) {
    if (typeof options === 'string') {
      options = { url: options };
    }
    
    if (options.url && options.url.includes('/api/')) {
      var authToken = localStorage.getItem('authToken');
      if (authToken) {
        options.headers = options.headers || {};
        if (!options.headers['Authorization']) {
          options.headers['Authorization'] = 'Bearer ' + authToken;
        }
      }
    }
    
    return originalAjax.call(this, options);
  };
  
  console.log('Profile auth fix applied');
})();
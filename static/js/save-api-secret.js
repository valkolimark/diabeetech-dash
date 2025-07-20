// Save API secret hash to localStorage for use by Nightscout
(function() {
  'use strict';
  
  // The hashed API secret
  var hashedSecret = '51a26cb40dcca4fd97601d00f8253129091c06ca';
  
  // Save to localStorage
  localStorage.setItem('apisecrethash', hashedSecret);
  
  console.log('API secret hash saved to localStorage');
  console.log('You can now use the profile editor or other features that require API authentication');
  
  // Also update the client headers if Nightscout is loaded
  if (window.Nightscout && window.Nightscout.client) {
    var originalHeaders = window.Nightscout.client.headers;
    window.Nightscout.client.headers = function() {
      // First try JWT token
      var authToken = localStorage.getItem('authToken');
      if (authToken) {
        return {
          'Authorization': 'Bearer ' + authToken
        };
      }
      
      // Fallback to API secret
      return {
        'api-secret': hashedSecret
      };
    };
    
    // Also set the hashauth if available
    if (window.Nightscout.client.hashauth) {
      window.Nightscout.client.hashauth.hash = function() {
        return hashedSecret;
      };
      window.Nightscout.client.hashauth.apisecrethash = hashedSecret;
    }
  }
})();
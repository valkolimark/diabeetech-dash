// Debug profile data reception
(function() {
  console.log('[PROFILE-DEBUG] Setting up WebSocket interceptor...');
  
  // Wait for socket to be available
  var checkInterval = setInterval(function() {
    if (window.socket && window.socket.on) {
      clearInterval(checkInterval);
      
      // Intercept dataUpdate to log profile data
      var originalOn = window.socket.on;
      window.socket.on = function(event, callback) {
        if (event === 'dataUpdate') {
          var wrappedCallback = function(data) {
            console.log('[PROFILE-DEBUG] dataUpdate received:', data);
            if (data) {
              console.log('[PROFILE-DEBUG] Data keys:', Object.keys(data));
              if (data.profiles) {
                console.log('[PROFILE-DEBUG] Profiles found! Count:', data.profiles.length);
                console.log('[PROFILE-DEBUG] First profile:', data.profiles[0]);
              } else {
                console.log('[PROFILE-DEBUG] NO PROFILES in dataUpdate!');
                console.log('[PROFILE-DEBUG] Full data object:', JSON.stringify(data, null, 2));
              }
            }
            // Call original callback
            return callback.apply(this, arguments);
          };
          return originalOn.call(this, event, wrappedCallback);
        }
        return originalOn.apply(this, arguments);
      };
      
      console.log('[PROFILE-DEBUG] WebSocket interceptor installed');
    }
  }, 100);
})();
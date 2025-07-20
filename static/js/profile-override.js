// Profile Override - Temporary fix to bypass profile redirect
(function() {
  'use strict';
  
  console.log('Profile override loading...');
  
  // Intercept the profile check
  if (window.Nightscout && window.Nightscout.client) {
    var originalLoad = window.Nightscout.client.load;
    
    window.Nightscout.client.load = function(serverSettings, callback) {
      console.log('Intercepting client load');
      
      // Call original load
      if (originalLoad) {
        originalLoad.call(this, serverSettings, function() {
          // After load, inject a default profile if none exists
          if (window.Nightscout.client.ddata && 
              (!window.Nightscout.client.ddata.profiles || 
               window.Nightscout.client.ddata.profiles.length === 0)) {
            
            console.log('No profiles found, injecting default profile');
            
            window.Nightscout.client.ddata.profiles = [{
              "_id": "default",
              "defaultProfile": "Default",
              "store": {
                "Default": {
                  "dia": 4,
                  "timezone": "America/Chicago",
                  "carbratio": [{"time": "00:00", "value": 10}],
                  "sens": [{"time": "00:00", "value": 50}],
                  "basal": [{"time": "00:00", "value": 1.0}],
                  "target_low": [{"time": "00:00", "value": 80}],
                  "target_high": [{"time": "00:00", "value": 120}],
                  "units": "mg/dl"
                }
              },
              "startDate": new Date().toISOString(),
              "mills": Date.now(),
              "units": "mg/dl"
            }];
            
            // Also set on profilefunctions if available
            if (window.Nightscout.client.profilefunctions) {
              window.Nightscout.client.profilefunctions.data = window.Nightscout.client.ddata.profiles;
            }
          }
          
          if (callback) callback();
        });
      }
    };
  }
  
  // Also override the dataUpdate handler
  document.addEventListener('DOMContentLoaded', function() {
    setTimeout(function() {
      if (window.socket) {
        var originalOn = window.socket.on;
        window.socket.on = function(event, handler) {
          if (event === 'dataUpdate') {
            var wrappedHandler = function(data) {
              console.log('Intercepting dataUpdate');
              if (data && (!data.profiles || data.profiles.length === 0)) {
                console.log('Injecting profile into dataUpdate');
                data.profiles = [{
                  "_id": "default",
                  "defaultProfile": "Default",
                  "store": {
                    "Default": {
                      "dia": 4,
                      "timezone": "America/Chicago",
                      "carbratio": [{"time": "00:00", "value": 10}],
                      "sens": [{"time": "00:00", "value": 50}],
                      "basal": [{"time": "00:00", "value": 1.0}],
                      "target_low": [{"time": "00:00", "value": 80}],
                      "target_high": [{"time": "00:00", "value": 120}],
                      "units": "mg/dl"
                    }
                  },
                  "startDate": new Date().toISOString(),
                  "mills": Date.now()
                }];
              }
              handler(data);
            };
            originalOn.call(this, event, wrappedHandler);
          } else {
            originalOn.call(this, event, handler);
          }
        };
      }
    }, 1000);
  });
  
  console.log('Profile override applied');
})();
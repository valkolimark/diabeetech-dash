// Force no redirect to profile page
(function() {
  'use strict';
  
  console.log('Forcing no profile redirect...');
  
  // Override window.location
  var originalLocation = window.location;
  Object.defineProperty(window, 'location', {
    get: function() {
      return originalLocation;
    },
    set: function(value) {
      if (typeof value === 'string' && value.includes('/profile')) {
        console.log('Blocked redirect to profile page');
        return;
      }
      originalLocation = value;
    }
  });
  
  // Override location.href
  var originalHref = Object.getOwnPropertyDescriptor(Location.prototype, 'href');
  Object.defineProperty(Location.prototype, 'href', {
    get: function() {
      return originalHref.get.call(this);
    },
    set: function(value) {
      if (value && value.includes('/profile')) {
        console.log('Blocked href redirect to profile page');
        
        // Instead, inject a fake profile
        if (window.Nightscout && window.Nightscout.client) {
          window.Nightscout.client.ddata = window.Nightscout.client.ddata || {};
          window.Nightscout.client.ddata.profiles = [{
            "_id": "fake",
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
            }
          }];
        }
        return;
      }
      originalHref.set.call(this, value);
    }
  });
  
  // Override replace method
  var originalReplace = window.location.replace;
  window.location.replace = function(url) {
    if (url && url.includes('/profile')) {
      console.log('Blocked replace redirect to profile page');
      return;
    }
    originalReplace.call(window.location, url);
  };
  
  // Override assign method
  var originalAssign = window.location.assign;
  window.location.assign = function(url) {
    if (url && url.includes('/profile')) {
      console.log('Blocked assign redirect to profile page');
      return;
    }
    originalAssign.call(window.location, url);
  };
  
  console.log('Profile redirect blocking active');
})();
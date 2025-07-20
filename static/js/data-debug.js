// Debug script to check data loading
(function() {
  'use strict';
  
  console.log('[DATA-DEBUG] Script loaded');
  
  // Intercept WebSocket data
  if (window.socket) {
    const originalOn = window.socket.on;
    window.socket.on = function(event, handler) {
      if (event === 'dataUpdate') {
        const wrappedHandler = function(data) {
          console.log('[DATA-DEBUG] dataUpdate received:', data);
          if (data.sgvs) {
            console.log('[DATA-DEBUG] SGV count:', data.sgvs.length);
            if (data.sgvs.length > 0) {
              console.log('[DATA-DEBUG] First SGV date:', new Date(data.sgvs[0].date));
              console.log('[DATA-DEBUG] Last SGV date:', new Date(data.sgvs[data.sgvs.length - 1].date));
            }
          }
          if (data.profiles) {
            console.log('[DATA-DEBUG] Profiles received:', data.profiles);
            data.profiles.forEach((p, i) => {
              console.log(`[DATA-DEBUG] Profile ${i}:`, p);
              console.log(`[DATA-DEBUG] Profile ${i} has store:`, !!p.store);
              console.log(`[DATA-DEBUG] Profile ${i} store keys:`, p.store ? Object.keys(p.store) : 'none');
            });
          }
          handler(data);
        };
        originalOn.call(this, event, wrappedHandler);
      } else {
        originalOn.call(this, event, handler);
      }
    };
  }
  
  // Check if we can force a data reload
  window.forceDataReload = function() {
    console.log('[DATA-DEBUG] Forcing data reload...');
    if (window.socket && window.socket.emit) {
      window.socket.emit('subscribe', {
        history: 48,
        tenant: true
      }, function(response) {
        console.log('[DATA-DEBUG] Subscribe response:', response);
      });
    }
  };
  
})();
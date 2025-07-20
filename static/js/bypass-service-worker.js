// Bypass service worker for bundle files
(function() {
  console.log('[SW-BYPASS] Checking for service worker...');
  
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    console.log('[SW-BYPASS] Service worker detected, unregistering to force fresh load...');
    
    navigator.serviceWorker.getRegistrations().then(function(registrations) {
      registrations.forEach(function(registration) {
        registration.unregister().then(function(success) {
          if (success) {
            console.log('[SW-BYPASS] Service worker unregistered successfully');
          }
        });
      });
    });
  }
  
  // Also clear all caches
  if ('caches' in window) {
    caches.keys().then(function(names) {
      names.forEach(function(name) {
        caches.delete(name).then(function() {
          console.log('[SW-BYPASS] Deleted cache:', name);
        });
      });
    });
  }
})();
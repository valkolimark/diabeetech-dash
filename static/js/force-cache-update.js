// Force immediate cache update and reload
(function() {
  console.log('[CACHE-UPDATE] Starting forced cache update process');
  
  // Check if this is the first visit after deployment
  const DEPLOYMENT_VERSION = 'v2-profile-fix-2024-01-20';  // Fixed version, not dynamic
  const LAST_VERSION_KEY = 'nightscout-deployment-version';
  const lastVersion = localStorage.getItem(LAST_VERSION_KEY);
  
  if (lastVersion !== DEPLOYMENT_VERSION) {
    console.log('[CACHE-UPDATE] New deployment detected, clearing all caches');
    
    // Clear all caches
    if ('caches' in window) {
      caches.keys().then(function(names) {
        return Promise.all(
          names.map(function(name) {
            console.log('[CACHE-UPDATE] Deleting cache:', name);
            return caches.delete(name);
          })
        );
      }).then(function() {
        console.log('[CACHE-UPDATE] All caches cleared');
        
        // Unregister all service workers
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.getRegistrations().then(function(registrations) {
            return Promise.all(
              registrations.map(function(registration) {
                console.log('[CACHE-UPDATE] Unregistering service worker:', registration.scope);
                return registration.unregister();
              })
            );
          }).then(function() {
            console.log('[CACHE-UPDATE] All service workers unregistered');
            
            // Update version in localStorage
            localStorage.setItem(LAST_VERSION_KEY, DEPLOYMENT_VERSION);
            
            // Clear other storage
            localStorage.removeItem('ns-profiles');
            sessionStorage.clear();
            
            // Force reload with cache bypass
            console.log('[CACHE-UPDATE] Reloading page in 1 second...');
            setTimeout(function() {
              window.location.reload(true);
            }, 1000);
          });
        }
      });
    }
  } else {
    console.log('[CACHE-UPDATE] Already on latest version');
  }
})();
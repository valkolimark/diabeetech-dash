// Force service worker update on page load
(function() {
  if ('serviceWorker' in navigator) {
    // Check for updates on page load
    navigator.serviceWorker.ready.then(registration => {
      registration.update();
    });
    
    // Listen for new service worker being installed
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      // New service worker has taken control, reload the page
      console.log('New service worker activated, reloading page...');
      window.location.reload();
    });
    
    // Force update check every 30 seconds for the next 2 minutes
    // This ensures users get the update quickly
    let updateCount = 0;
    const maxUpdates = 4; // 4 times * 30 seconds = 2 minutes
    
    const updateInterval = setInterval(() => {
      navigator.serviceWorker.getRegistration().then(registration => {
        if (registration) {
          registration.update();
          updateCount++;
          
          if (updateCount >= maxUpdates) {
            clearInterval(updateInterval);
          }
        }
      });
    }, 30000); // 30 seconds
  }
})();
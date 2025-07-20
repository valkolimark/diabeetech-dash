// Script to clear service worker cache and force reload
// Run this in the browser console

(async function clearCacheAndReload() {
  console.log('=== CLEARING ALL CACHES ===');
  
  // 1. Clear service worker caches
  if ('caches' in window) {
    const cacheNames = await caches.keys();
    console.log('Found caches:', cacheNames);
    
    await Promise.all(
      cacheNames.map(cacheName => {
        console.log('Deleting cache:', cacheName);
        return caches.delete(cacheName);
      })
    );
    console.log('All caches cleared');
  }
  
  // 2. Unregister service workers
  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    console.log('Found service workers:', registrations.length);
    
    await Promise.all(
      registrations.map(registration => {
        console.log('Unregistering service worker:', registration.scope);
        return registration.unregister();
      })
    );
    console.log('All service workers unregistered');
  }
  
  // 3. Clear localStorage
  localStorage.clear();
  console.log('localStorage cleared');
  
  // 4. Clear sessionStorage
  sessionStorage.clear();
  console.log('sessionStorage cleared');
  
  // 5. Force reload without cache
  console.log('Forcing hard reload in 2 seconds...');
  setTimeout(() => {
    window.location.reload(true);
  }, 2000);
})();
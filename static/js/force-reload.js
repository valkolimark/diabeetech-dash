// Force reload data by clearing cache
(function() {
  'use strict';
  
  console.log('[FORCE-RELOAD] Script loaded');
  
  // Clear localStorage items that might cache data
  const keysToRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.includes('sgv') || key.includes('entries') || key.includes('cache'))) {
      keysToRemove.push(key);
    }
  }
  
  keysToRemove.forEach(key => {
    console.log('[FORCE-RELOAD] Removing cached key:', key);
    localStorage.removeItem(key);
  });
  
  // Force a hard reload after a short delay
  window.forceHardReload = function() {
    console.log('[FORCE-RELOAD] Forcing hard reload...');
    // Disconnect socket if connected
    if (window.socket && window.socket.connected) {
      window.socket.disconnect();
    }
    // Clear any client-side data
    if (window.Nightscout && window.Nightscout.client && window.Nightscout.client.ddata) {
      window.Nightscout.client.ddata = {};
    }
    // Reload with cache bypass
    window.location.reload(true);
  };
  
  console.log('[FORCE-RELOAD] Type forceHardReload() in console to force reload');
  
})();
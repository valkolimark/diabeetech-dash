// Multi-tenant authentication check
(function() {
  'use strict';
  
  // Check if we're on a page that requires authentication
  const publicPaths = ['/login', '/forgot-password', '/reset-password'];
  const currentPath = window.location.pathname;
  
  if (publicPaths.some(path => currentPath.startsWith(path))) {
    // Public page, no auth check needed
    return;
  }
  
  // Check for authentication token
  const token = localStorage.getItem('authToken');
  
  if (!token) {
    // No token, redirect to login
    window.location.href = '/login';
    return;
  }
  
  // Verify token is still valid
  fetch('/api/auth/verify', {
    headers: {
      'Authorization': 'Bearer ' + token
    }
  })
  .then(response => {
    if (!response.ok) {
      // Token invalid, clear storage and redirect to login
      localStorage.removeItem('authToken');
      localStorage.removeItem('refreshToken');
      window.location.href = '/login';
    }
    // Token is valid, continue loading the page
  })
  .catch(error => {
    console.error('Auth verification error:', error);
    // On error, redirect to login to be safe
    window.location.href = '/login';
  });
  
  // Add token to all API requests
  const originalFetch = window.fetch;
  window.fetch = function(url, options = {}) {
    // Only add auth header to API requests
    if (url.startsWith('/api/') && !url.startsWith('/api/auth/login')) {
      options.headers = options.headers || {};
      if (!options.headers['Authorization']) {
        const authToken = localStorage.getItem('authToken');
        if (authToken) {
          options.headers['Authorization'] = 'Bearer ' + authToken;
        }
      }
    }
    return originalFetch(url, options);
  };
  
  // Add token to jQuery AJAX requests if jQuery is available
  if (typeof $ !== 'undefined' && $.ajaxSetup) {
    $.ajaxSetup({
      beforeSend: function(xhr, settings) {
        if (settings.url && settings.url.startsWith('/api/') && !settings.url.startsWith('/api/auth/login')) {
          const authToken = localStorage.getItem('authToken');
          if (authToken) {
            xhr.setRequestHeader('Authorization', 'Bearer ' + authToken);
          }
        }
      }
    });
  }
  
  // Signal that auth check is loaded
  window.authCheckLoaded = true;
})();
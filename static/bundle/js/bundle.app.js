// Temporary bundle file to fix loading issue
// This should be replaced by webpack build in production

console.log('Nightscout bundle loaded');

// Initialize global Nightscout object
window.Nightscout = window.Nightscout || {};

// Mock client object with init method
window.Nightscout.client = {
  init: function() {
    console.log('Nightscout client initializing...');
    
    try {
      // Hide loading screen
      const loadingPanel = document.getElementById('centerMessagePanel');
      if (loadingPanel) {
        loadingPanel.style.transition = 'opacity 500ms';
        loadingPanel.style.opacity = '0';
        setTimeout(() => {
          loadingPanel.style.display = 'none';
        }, 500);
      }
      
      // Show main content
      const containers = document.querySelectorAll('.container, #chartContainer');
      containers.forEach(container => {
        container.style.display = 'block';
      });
      
      // Remove loading class from body
      document.body.classList.remove('loading');
      
      // If jQuery is available, use it too
      if (typeof $ !== 'undefined') {
        $('#centerMessagePanel').fadeOut(500);
        $('.container').show();
        $('#chartContainer').show();
        $('body').removeClass('loading');
        $(window).trigger('nightscout-ready');
      }
      
      console.log('Nightscout client initialization complete');
      
      // Ensure we hide loading screen even if other parts fail
      setTimeout(() => {
        const panel = document.getElementById('centerMessagePanel');
        if (panel && panel.style.display !== 'none') {
          panel.style.display = 'none';
        }
      }, 1000);
      
    } catch (error) {
      console.error('Error during Nightscout initialization:', error);
      // Force hide loading screen on error
      const loadingPanel = document.getElementById('centerMessagePanel');
      if (loadingPanel) {
        loadingPanel.style.display = 'none';
      }
    }
  }
};

// Add other required Nightscout modules as stubs
window.Nightscout.units = function() { return { mgdl: 1, mmol: 18 }; };
window.Nightscout.plugins = function() { return {}; };

// Basic initialization
$(document).ready(function() {
  console.log('Document ready, waiting for client.js to call init...');
  
  // Basic error handler
  window.onerror = function(msg, url, line, col, error) {
    console.error('Nightscout Error:', msg, 'at', url, ':', line);
    return false;
  };
  
  // Fallback: If init hasn't been called after 2 seconds, force it
  setTimeout(function() {
    const loadingPanel = document.getElementById('centerMessagePanel');
    if (loadingPanel && loadingPanel.style.display !== 'none') {
      console.warn('Loading screen still visible after 2s, forcing init...');
      if (window.Nightscout && window.Nightscout.client && window.Nightscout.client.init) {
        window.Nightscout.client.init();
      } else {
        // Direct DOM manipulation as last resort
        loadingPanel.style.display = 'none';
        document.querySelectorAll('.container, #chartContainer').forEach(el => {
          el.style.display = 'block';
        });
      }
    }
  }, 2000);
});

// Placeholder for missing modules
window.d3 = window.d3 || { version: '3.5.17' };

// jQuery is loaded by the page, but we need to ensure it's available
if (typeof $ === 'undefined' && typeof jQuery !== 'undefined') {
  window.$ = jQuery;
}

// If jQuery is not available, provide basic functionality
if (typeof $ === 'undefined') {
  console.warn('jQuery not found, using vanilla JavaScript fallback');
  
  // Basic jQuery-like functionality
  window.$ = function(selector) {
    if (typeof selector === 'function') {
      // Document ready handler
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', selector);
      } else {
        selector();
      }
      return;
    }
    
    // Basic element selection
    const element = typeof selector === 'string' ? document.querySelector(selector) : selector;
    return {
      fadeOut: function(duration) {
        if (element) {
          element.style.transition = `opacity ${duration}ms`;
          element.style.opacity = '0';
          setTimeout(() => {
            element.style.display = 'none';
          }, duration);
        }
        return this;
      },
      show: function() {
        if (element) {
          element.style.display = 'block';
        }
        return this;
      },
      removeClass: function(className) {
        if (element) {
          element.classList.remove(className);
        }
        return this;
      },
      trigger: function(eventName) {
        if (element) {
          const event = new Event(eventName);
          element.dispatchEvent(event);
        }
        return this;
      }
    };
  };
  
  // Implement $(window)
  window.$.fn = {};
  Object.defineProperty(window, 'jQuery', {
    get: function() { return window.$; }
  });
}
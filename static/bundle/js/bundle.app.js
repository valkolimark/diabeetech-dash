// Enhanced temporary bundle file for Nightscout
// This provides basic functionality until webpack build is fixed

console.log('Nightscout bundle loaded');

// Initialize global Nightscout object
window.Nightscout = window.Nightscout || {};

// Add d3 to global scope
window.d3 = window.d3 || { version: '3.5.17' };

// Mock language module
window.language = window.language || {
  translate: function(text) { return text; },
  DOMtranslate: function() {},
  set: function() {},
  get: function() { return 'en'; }
};

// Mock browserUtils
const browserUtils = function($) {
  return {
    queryParms: function() {
      const params = {};
      window.location.search.substr(1).split('&').forEach(function(item) {
        const pair = item.split('=');
        params[pair[0]] = decodeURIComponent(pair[1] || '');
      });
      return params;
    }
  };
};

// Enhanced client object with basic API connectivity
window.Nightscout.client = {
  headers: function() {
    const token = localStorage.getItem('authToken');
    if (token) {
      return { 'Authorization': 'Bearer ' + token };
    }
    return {};
  },
  
  init: function(callback) {
    console.log('Nightscout client initializing...');
    
    const client = this;
    client.browserUtils = browserUtils($);
    
    // Hide loading screen
    $('#centerMessagePanel').fadeOut(500);
    $('.container').show();
    $('#chartContainer').show();
    $('body').removeClass('loading');
    
    // Initialize settings
    client.settings = {
      units: 'mg/dL',
      timeFormat: 24,
      nightMode: false,
      showRawbg: 'never',
      customTitle: 'Nightscout',
      theme: 'default',
      alarmUrgentHigh: true,
      alarmHigh: true,
      alarmLow: true,
      alarmUrgentLow: true,
      alarmTimeagoWarn: true,
      alarmTimeagoWarnMins: 15,
      alarmTimeagoUrgent: true,
      alarmTimeagoUrgentMins: 30,
      showPlugins: 'delta direction upbat',
      language: 'en',
      scaleY: 'log',
      showForecast: 'ar2',
      focusHours: 3,
      heartbeat: 60,
      baseURL: '',
      authDefaultRoles: 'readable',
      thresholds: {
        bgHigh: 260,
        bgTargetTop: 180,
        bgTargetBottom: 80,
        bgLow: 55
      }
    };
    
    // Load status from server
    $.ajax({
      method: 'GET',
      url: '/api/v1/status.json?t=' + new Date().getTime(),
      headers: client.headers()
    }).done(function(serverSettings) {
      console.log('Server settings loaded:', serverSettings);
      
      // Merge server settings
      if (serverSettings.settings) {
        Object.assign(client.settings, serverSettings.settings);
      }
      
      // Initialize plugins (basic stubs)
      client.plugins = function() {
        return {
          delta: { name: 'delta', label: 'Delta', pluginType: 'pill-status' },
          direction: { name: 'direction', label: 'Direction', pluginType: 'pill-status' },
          upbat: { name: 'upbat', label: 'Uploader Battery', pluginType: 'pill-status' }
        };
      };
      
      // Initialize chart (basic implementation)
      client.chart = {
        update: function() { console.log('Chart update called'); },
        init: function() { 
          console.log('Chart init called');
          $('#chartContainer').html('<div style="text-align:center; padding:50px;">Chart placeholder - Nightscout is loading...</div>');
        }
      };
      
      // Initialize WebSocket
      if (window.io) {
        client.socket = window.io();
        
        client.socket.on('connect', function() {
          console.log('Socket connected');
        });
        
        client.socket.on('dataUpdate', function(data) {
          console.log('Data update received:', data);
        });
      }
      
      // Trigger ready event
      $(window).trigger('nightscout-ready');
      console.log('Nightscout client initialization complete');
      
      if (callback) callback();
      
    }).fail(function(jqXHR) {
      console.error('Failed to load server settings:', jqXHR);
      $('#loadingMessageText').html('Failed to connect to server. Please refresh the page.');
      
      // Still hide loading screen
      setTimeout(function() {
        $('#centerMessagePanel').fadeOut(500);
        $('.container').show();
      }, 2000);
    });
    
    // Setup menu handlers
    this.setupMenuHandlers();
  },
  
  setupMenuHandlers: function() {
    // Drawer menu toggle
    $('#drawerToggle').on('click', function(event) {
      event.preventDefault();
      $('#drawer').toggleClass('open');
      $('#drawer-overlay').toggleClass('open');
    });
    
    $('#drawer-overlay').on('click', function() {
      $('#drawer').removeClass('open');
      $('#drawer-overlay').removeClass('open');
    });
    
    // Settings toggle
    $('#settingsToggle').on('click', function(event) {
      event.preventDefault();
      $('#settingsDrawer').toggleClass('open');
    });
    
    // Treatment toggle
    $('#treatmentDrawerToggle').on('click', function(event) {
      event.preventDefault();
      $('#treatmentDrawer').toggleClass('open');
    });
    
    // Add basic form handlers
    $('form').on('submit', function(event) {
      event.preventDefault();
      console.log('Form submitted:', this.id);
    });
  }
};

// Add other required Nightscout modules
window.Nightscout.units = function() { 
  return { 
    mgdl: 1, 
    mmol: 18,
    bg: function(val) { return Math.round(val); }
  }; 
};

window.Nightscout.plugins = function() { 
  return {
    base: function() { return []; },
    eachPlugin: function(f) { 
      ['delta', 'direction', 'upbat'].forEach(f);
    }
  }; 
};

window.Nightscout.report_plugins = function() { return {}; };
window.Nightscout.admin_plugins = function() { return {}; };

// Mock other modules
window.Nightscout.profileclient = {
  init: function() { console.log('Profile client initialized'); }
};

window.Nightscout.foodclient = {
  init: function() { console.log('Food client initialized'); }
};

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
      }
    }
  }, 2000);
});

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = window.Nightscout;
}
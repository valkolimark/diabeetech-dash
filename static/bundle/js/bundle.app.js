// Temporary bundle file to fix loading issue
// This should be replaced by webpack build in production

console.log('Nightscout bundle loaded');

// Initialize global Nightscout object
window.Nightscout = window.Nightscout || {};

// Basic initialization to prevent loading screen hang
$(document).ready(function() {
  console.log('Nightscout initializing...');
  
  // Hide loading screen
  $('#centerMessagePanel').fadeOut(500);
  
  // Show main content
  $('.container').show();
  $('#chartContainer').show();
  
  // Basic error handler
  window.onerror = function(msg, url, line, col, error) {
    console.error('Nightscout Error:', msg, 'at', url, ':', line);
    return false;
  };
  
  console.log('Nightscout basic initialization complete');
  
  // Trigger app ready event
  $(window).trigger('nightscout-ready');
});

// Placeholder for missing modules
window.d3 = window.d3 || { version: '3.5.17' };
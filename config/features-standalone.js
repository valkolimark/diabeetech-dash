/**
 * Simplified Feature Flags for Standalone Admin Server
 */

module.exports = {
  adminDashboard: {
    enabled: true,
    features: {
      userManagement: { enabled: true },
      tenantManagement: { enabled: true },
      systemMonitoring: { enabled: true },
      billing: { enabled: false },
      security: { enabled: true },
      developerTools: { enabled: true }
    }
  },
  
  isEnabled: function(feature) {
    return true; // All features enabled for admin
  },
  
  getEnabledFeatures: function() {
    return [
      'adminDashboard',
      'userManagement', 
      'tenantManagement',
      'systemMonitoring',
      'security'
    ];
  }
};
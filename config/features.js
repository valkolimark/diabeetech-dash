/**
 * Feature Flag Configuration for Nightscout Multi-tenant
 * Controls the gradual rollout of admin dashboard features
 */

module.exports = {
  // Main admin dashboard toggle
  adminDashboard: {
    enabled: process.env.FEATURE_ADMIN_DASHBOARD === 'true',
    superAdminOnly: true,
    requiresRole: 'superadmin',
    
    // Individual feature toggles within admin dashboard
    features: {
      // User Management
      userManagement: {
        enabled: process.env.FEATURE_USER_MGMT === 'true',
        create: process.env.FEATURE_USER_CREATE === 'true',
        update: process.env.FEATURE_USER_UPDATE === 'true',
        delete: process.env.FEATURE_USER_DELETE === 'true',
        bulkOperations: process.env.FEATURE_USER_BULK === 'true'
      },
      
      // Tenant Management
      tenantManagement: {
        enabled: process.env.FEATURE_TENANT_MGMT === 'true',
        create: process.env.FEATURE_TENANT_CREATE === 'true',
        update: process.env.FEATURE_TENANT_UPDATE === 'true',
        delete: process.env.FEATURE_TENANT_DELETE === 'true',
        suspend: process.env.FEATURE_TENANT_SUSPEND === 'true'
      },
      
      // System Monitoring
      systemMonitoring: {
        enabled: process.env.FEATURE_MONITORING === 'true',
        metrics: process.env.FEATURE_METRICS === 'true',
        logs: process.env.FEATURE_LOG_VIEWER === 'true',
        alerts: process.env.FEATURE_ALERTS === 'true'
      },
      
      // Billing (Future)
      billing: {
        enabled: process.env.FEATURE_BILLING === 'true',
        subscriptions: process.env.FEATURE_SUBSCRIPTIONS === 'true',
        invoices: process.env.FEATURE_INVOICES === 'true',
        payments: process.env.FEATURE_PAYMENTS === 'true'
      },
      
      // Security Features
      security: {
        twoFactorAuth: process.env.FEATURE_2FA === 'true',
        auditLogs: process.env.FEATURE_AUDIT_LOGS === 'true',
        ipWhitelist: process.env.FEATURE_IP_WHITELIST === 'true',
        sessionManagement: process.env.FEATURE_SESSION_MGMT === 'true'
      },
      
      // Developer Tools
      developerTools: {
        enabled: process.env.FEATURE_DEV_TOOLS === 'true',
        apiPlayground: process.env.FEATURE_API_PLAYGROUND === 'true',
        webhooks: process.env.FEATURE_WEBHOOKS === 'true',
        apiKeys: process.env.FEATURE_API_KEYS === 'true'
      }
    }
  },
  
  // Gradual rollout configuration
  rollout: {
    percentage: parseInt(process.env.FEATURE_ROLLOUT_PERCENT || '0'),
    betaUsers: (process.env.FEATURE_BETA_USERS || '').split(',').filter(Boolean),
    testTenants: (process.env.FEATURE_TEST_TENANTS || '').split(',').filter(Boolean)
  },
  
  // Feature flag helpers
  isEnabled(feature) {
    const parts = feature.split('.');
    let current = this;
    
    for (const part of parts) {
      current = current[part];
      if (!current) return false;
      if (typeof current === 'boolean') return current;
      if (current.enabled !== undefined) return current.enabled;
    }
    
    return false;
  },
  
  // Check if user has access to feature
  hasAccess(feature, user) {
    if (!this.isEnabled(feature)) return false;
    
    // Check if user is in beta
    if (this.rollout.betaUsers.includes(user.email)) return true;
    
    // Check if tenant is in test group
    if (user.tenant && this.rollout.testTenants.includes(user.tenant)) return true;
    
    // Check rollout percentage
    if (this.rollout.percentage > 0) {
      const hash = require('crypto')
        .createHash('md5')
        .update(user._id.toString())
        .digest('hex');
      const userHash = parseInt(hash.substring(0, 8), 16);
      const threshold = (this.rollout.percentage / 100) * 0xffffffff;
      return userHash <= threshold;
    }
    
    // Check specific feature requirements
    const featureConfig = this.getFeatureConfig(feature);
    if (featureConfig && featureConfig.requiresRole) {
      return user.role === featureConfig.requiresRole;
    }
    
    return true;
  },
  
  // Get feature configuration
  getFeatureConfig(feature) {
    const parts = feature.split('.');
    let current = this;
    
    for (const part of parts) {
      current = current[part];
      if (!current) return null;
    }
    
    return current;
  },
  
  // List all enabled features
  getEnabledFeatures() {
    const features = [];
    
    const traverse = (obj, path = []) => {
      for (const [key, value] of Object.entries(obj)) {
        if (key === 'isEnabled' || key === 'hasAccess' || 
            key === 'getFeatureConfig' || key === 'getEnabledFeatures') {
          continue;
        }
        
        const currentPath = [...path, key];
        
        if (typeof value === 'boolean' && value) {
          features.push(currentPath.join('.'));
        } else if (value && typeof value === 'object') {
          if (value.enabled === true) {
            features.push(currentPath.join('.'));
          }
          traverse(value, currentPath);
        }
      }
    };
    
    traverse(this);
    return features;
  }
};
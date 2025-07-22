'use strict';

async function cloneSettingsFromReferenceTenant(env, ctx, fromTenantSubdomain, toTenantDb) {
  const connectionManager = require('./connectionManager')(env);
  
  try {
    // Get reference tenant database
    const referenceTenant = await ctx.store.collection('tenants').findOne({ subdomain: fromTenantSubdomain });
    if (!referenceTenant) {
      console.warn(`Reference tenant ${fromTenantSubdomain} not found, using defaults`);
      return;
    }
    
    const referenceDb = await connectionManager.getDatabase(referenceTenant.tenantId);
    
    // Collections to clone
    const collectionsToClone = [
      'settings',
      'profile', 
      'food',
      'clockconfig'
    ];
    
    for (const collectionName of collectionsToClone) {
      try {
        const sourceCollection = referenceDb.collection(collectionName);
        const targetCollection = toTenantDb.collection(collectionName);
        
        // Get documents from source
        const documents = await sourceCollection.find({}).toArray();
        
        if (documents.length > 0) {
          // Remove _id fields to avoid conflicts
          const cleanedDocs = documents.map(doc => {
            const { _id, ...cleanDoc } = doc;
            return cleanDoc;
          });
          
          // Insert into target
          await targetCollection.insertMany(cleanedDocs);
          console.log(`Cloned ${cleanedDocs.length} documents from ${collectionName}`);
        }
      } catch (err) {
        console.warn(`Failed to clone collection ${collectionName}:`, err.message);
      }
    }
    
    // Ensure critical settings exist
    await ensureCriticalSettings(toTenantDb, env);
    
  } catch (err) {
    console.error('Error cloning settings from reference tenant:', err);
    // Don't throw - continue with defaults if cloning fails
  }
}

async function ensureCriticalSettings(tenantDb, env) {
  const settingsCollection = tenantDb.collection('settings');
  
  // Check if settings exist
  const existingSettings = await settingsCollection.findOne({});
  
  if (!existingSettings) {
    // Create default settings if none exist
    const defaultSettings = {
      units: 'mg/dl',
      timeFormat: 12,
      nightMode: false,
      showRawbg: 'never',
      customTitle: 'Nightscout',
      theme: 'default',
      alarmUrgentHigh: true,
      alarmUrgentHighMins: [30, 60, 90, 120],
      alarmHigh: true,
      alarmHighMins: [30, 60, 90, 120],
      alarmLow: true,
      alarmLowMins: [15, 30, 45, 60],
      alarmUrgentLow: true,
      alarmUrgentLowMins: [15, 30, 45],
      alarmUrgentMins: [30, 60, 90, 120],
      alarmWarnMins: [30, 60, 90, 120],
      showPlugins: 'careportal boluscalc food bwp cage sage iage iob cob basal ar2 treatmentnotify delta direction upbat rawbg',
      showForecast: 'ar2',
      focusHours: 3,
      heartbeat: 60,
      baseURL: '',
      authDefaultRoles: 'readable',
      thresholds: {
        bgHigh: 180,
        bgTargetTop: 180,
        bgTargetBottom: 80,
        bgLow: 70
      },
      DEFAULT_FEATURES: ['bgnow', 'delta', 'direction', 'timeago', 'devicestatus', 'upbat', 'errorcodes', 'profile', 'careportal'],
      alarmTypes: ['simple'],
      enable: ['careportal', 'boluscalc', 'food', 'bwp', 'cage', 'sage', 'iage', 'iob', 'cob', 'basal', 'ar2', 'rawbg', 'pushover', 'bgi', 'pump', 'openaps', 'treatmentnotify', 'bgnow', 'delta', 'direction', 'timeago', 'devicestatus', 'upbat', 'errorcodes', 'profile', 'dbsize', 'runtimestate', 'bridge']
    };
    
    await settingsCollection.insertOne(defaultSettings);
    console.log('Created default settings for new tenant');
  }
}

module.exports = {
  cloneSettingsFromReferenceTenant,
  ensureCriticalSettings
};
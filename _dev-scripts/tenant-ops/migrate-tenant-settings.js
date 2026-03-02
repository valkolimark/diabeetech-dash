// Migrate all environment variables to tenant-level settings
const { MongoClient } = require('mongodb');

const MONGO_URI = 'mongodb+srv://markt:xebkaW-kaqmu4-wynkor@nightscout-master.nkz27.mongodb.net/nightscout-master?retryWrites=true&w=majority&appName=nightscout-master';

// Default values for settings
const DEFAULT_SETTINGS = {
  // Alarm settings
  ALARM_HIGH: true,
  ALARM_LOW: true,
  ALARM_TIMEAGO_URGENT: true,
  ALARM_TIMEAGO_URGENT_MINS: 30,
  ALARM_TIMEAGO_WARN: true,
  ALARM_TIMEAGO_WARN_MINS: 15,
  ALARM_TYPES: 'simple',
  ALARM_URGENT_HIGH: true,
  ALARM_URGENT_LOW: true,
  
  // BG thresholds (mg/dL)
  BG_HIGH: 260,
  BG_LOW: 55,
  BG_TARGET_BOTTOM: 80,
  BG_TARGET_TOP: 180,
  
  // Display settings
  BOLUS_RENDER_OVER: 1,
  CUSTOM_TITLE: 'Nightscout',
  DISPLAY_UNITS: 'mg/dl',
  NIGHT_MODE: false,
  SHOW_RAWBG: 'noise',
  THEME: 'colors',
  TIME_FORMAT: 12,
  
  // Plugins
  ENABLE: 'careportal basal iob cob bwp rawbg',
  SHOW_PLUGINS: 'careportal basal iob cob bwp rawbg',
  
  // Bridge settings (already handled separately)
  // BRIDGE_PASSWORD, BRIDGE_SERVER, BRIDGE_USER_NAME handled in bridge object
  
  // MiniMed Connect settings
  MMCONNECT_USER_NAME: '',
  MMCONNECT_PASSWORD: '',
  MMCONNECT_SERVER: '',
  
  // Timezone
  DISPLAY_TIMEZONE: 'America/Chicago'
};

async function migrateTenantSettings(tenantId) {
  const client = new MongoClient(MONGO_URI);
  
  try {
    await client.connect();
    const db = client.db(`tenant_${tenantId}`);
    const settingsCollection = db.collection('settings');
    
    // Get current settings
    const currentSettings = await settingsCollection.findOne({}) || {};
    
    console.log(`\nMigrating settings for tenant: ${tenantId}`);
    console.log('Current settings keys:', Object.keys(currentSettings));
    
    // Build updated settings
    const updatedSettings = {
      ...currentSettings,
      
      // Core settings
      units: currentSettings.units || DEFAULT_SETTINGS.DISPLAY_UNITS,
      timeFormat: currentSettings.timeFormat || DEFAULT_SETTINGS.TIME_FORMAT,
      nightMode: currentSettings.nightMode !== undefined ? currentSettings.nightMode : DEFAULT_SETTINGS.NIGHT_MODE,
      showRawbg: currentSettings.showRawbg || DEFAULT_SETTINGS.SHOW_RAWBG,
      customTitle: currentSettings.customTitle || DEFAULT_SETTINGS.CUSTOM_TITLE,
      theme: currentSettings.theme || DEFAULT_SETTINGS.THEME,
      language: currentSettings.language || 'en',
      showPlugins: currentSettings.showPlugins || DEFAULT_SETTINGS.SHOW_PLUGINS,
      enable: currentSettings.enable || DEFAULT_SETTINGS.ENABLE,
      timezone: currentSettings.timezone || DEFAULT_SETTINGS.DISPLAY_TIMEZONE,
      
      // Thresholds
      thresholds: {
        bgHigh: currentSettings.thresholds?.bgHigh || DEFAULT_SETTINGS.BG_HIGH,
        bgTargetTop: currentSettings.thresholds?.bgTargetTop || DEFAULT_SETTINGS.BG_TARGET_TOP,
        bgTargetBottom: currentSettings.thresholds?.bgTargetBottom || DEFAULT_SETTINGS.BG_TARGET_BOTTOM,
        bgLow: currentSettings.thresholds?.bgLow || DEFAULT_SETTINGS.BG_LOW
      },
      
      // Alarms
      alarmTypes: currentSettings.alarmTypes || [DEFAULT_SETTINGS.ALARM_TYPES],
      alarmUrgentHigh: currentSettings.alarmUrgentHigh !== undefined ? currentSettings.alarmUrgentHigh : DEFAULT_SETTINGS.ALARM_URGENT_HIGH,
      alarmUrgentHighMins: currentSettings.alarmUrgentHighMins || [30, 60, 90, 120],
      alarmHigh: currentSettings.alarmHigh !== undefined ? currentSettings.alarmHigh : DEFAULT_SETTINGS.ALARM_HIGH,
      alarmHighMins: currentSettings.alarmHighMins || [30, 60, 90, 120],
      alarmLow: currentSettings.alarmLow !== undefined ? currentSettings.alarmLow : DEFAULT_SETTINGS.ALARM_LOW,
      alarmLowMins: currentSettings.alarmLowMins || [15, 30, 45, 60],
      alarmUrgentLow: currentSettings.alarmUrgentLow !== undefined ? currentSettings.alarmUrgentLow : DEFAULT_SETTINGS.ALARM_URGENT_LOW,
      alarmUrgentLowMins: currentSettings.alarmUrgentLowMins || [15, 30, 45],
      alarmTimeagoWarn: currentSettings.alarmTimeagoWarn !== undefined ? currentSettings.alarmTimeagoWarn : DEFAULT_SETTINGS.ALARM_TIMEAGO_WARN,
      alarmTimeagoWarnMins: currentSettings.alarmTimeagoWarnMins || DEFAULT_SETTINGS.ALARM_TIMEAGO_WARN_MINS,
      alarmTimeagoUrgent: currentSettings.alarmTimeagoUrgent !== undefined ? currentSettings.alarmTimeagoUrgent : DEFAULT_SETTINGS.ALARM_TIMEAGO_URGENT,
      alarmTimeagoUrgentMins: currentSettings.alarmTimeagoUrgentMins || DEFAULT_SETTINGS.ALARM_TIMEAGO_URGENT_MINS,
      
      // Rendering
      bolusRenderOver: currentSettings.bolusRenderOver || DEFAULT_SETTINGS.BOLUS_RENDER_OVER,
      
      // MiniMed Connect (if configured)
      mmconnect: currentSettings.mmconnect || {
        userName: DEFAULT_SETTINGS.MMCONNECT_USER_NAME,
        password: DEFAULT_SETTINGS.MMCONNECT_PASSWORD,
        server: DEFAULT_SETTINGS.MMCONNECT_SERVER,
        enable: false
      },
      
      // Keep existing bridge settings
      bridge: currentSettings.bridge,
      bridge_interval: currentSettings.bridge_interval,
      
      // Metadata
      lastModified: new Date()
    };
    
    // Update settings
    const result = await settingsCollection.replaceOne(
      {},
      updatedSettings,
      { upsert: true }
    );
    
    console.log('✅ Settings migrated successfully');
    console.log('- Modified:', result.modifiedCount);
    console.log('- Upserted:', result.upsertedCount);
    
    // Show key settings
    console.log('\nKey settings:');
    console.log('- Units:', updatedSettings.units);
    console.log('- Time format:', updatedSettings.timeFormat);
    console.log('- Theme:', updatedSettings.theme);
    console.log('- Timezone:', updatedSettings.timezone);
    console.log('- BG thresholds:', updatedSettings.thresholds);
    console.log('- Enabled plugins:', updatedSettings.enable);
    
    return updatedSettings;
    
  } catch (err) {
    console.error('Error migrating settings:', err);
    throw err;
  } finally {
    await client.close();
  }
}

// Main execution
async function main() {
  console.log('=== Tenant Settings Migration ===\n');
  console.log('This will migrate all environment variables to tenant-level settings');
  console.log('in the tenant database where they belong.\n');
  
  // For now, just migrate onepanman
  const tenantId = 'onepanman';
  
  try {
    await migrateTenantSettings(tenantId);
    console.log('\n✅ Migration complete!');
    console.log('\nNext steps:');
    console.log('1. Deploy changes: git push heroku main');
    console.log('2. The app will now use tenant-level settings');
    console.log('3. Each tenant can have different alarm thresholds, themes, etc.');
  } catch (err) {
    console.error('\n❌ Migration failed:', err.message);
  }
}

main();
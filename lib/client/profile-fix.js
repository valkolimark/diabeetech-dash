'use strict';

// Client-side profile fix to ensure profile data is properly structured
function fixProfileData(profile) {
  if (!profile) return null;
  
  // If profile already has the correct structure, return it
  if (profile.store && typeof profile.store === 'object') {
    return profile;
  }
  
  // Fix profile structure if needed
  const fixed = {
    _id: profile._id || 'defaultProfile',
    defaultProfile: profile.defaultProfile || 'Default',
    startDate: profile.startDate || new Date().toISOString(),
    mills: profile.mills || Date.now(),
    units: profile.units || 'mg/dl'
  };
  
  // If profile has direct properties (dia, sens, etc), move them to store
  if (profile.dia || profile.sens || profile.carbratio || profile.basal) {
    fixed.store = {
      'Default': {
        dia: profile.dia || 4,
        timezone: profile.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
        basal: profile.basal || [{ time: '00:00', value: 1.0 }],
        carbratio: profile.carbratio || [{ time: '00:00', value: 10 }],
        sens: profile.sens || [{ time: '00:00', value: 50 }],
        target_low: profile.target_low || [{ time: '00:00', value: 80 }],
        target_high: profile.target_high || [{ time: '00:00', value: 120 }],
        carbs_hr: profile.carbs_hr || 20,
        delay: profile.delay || 20,
        units: profile.units || 'mg/dl'
      }
    };
  } else {
    // Profile doesn't have any data, use defaults
    fixed.store = {
      'Default': {
        dia: 4,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        basal: [{ time: '00:00', value: 1.0 }],
        carbratio: [{ time: '00:00', value: 10 }],
        sens: [{ time: '00:00', value: 50 }],
        target_low: [{ time: '00:00', value: 80 }],
        target_high: [{ time: '00:00', value: 120 }],
        carbs_hr: 20,
        delay: 20,
        units: 'mg/dl'
      }
    };
  }
  
  return fixed;
}

module.exports = fixProfileData;
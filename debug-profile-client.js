// Add this debug script to the client to understand profile issues
// This would be injected into the browser console

(function debugProfile() {
  // Check if profile module exists
  console.log('=== PROFILE DEBUG ===');
  
  if (typeof Nightscout !== 'undefined' && Nightscout.client) {
    const client = Nightscout.client;
    
    // Check profile data
    if (client.profilefunctions) {
      console.log('Profile functions available');
      console.log('Has data:', client.profilefunctions.hasData());
      console.log('Profile data:', client.profilefunctions.data);
      
      // Try to get current profile
      try {
        const currentProfile = client.profilefunctions.getCurrentProfile();
        console.log('Current profile:', currentProfile);
      } catch (e) {
        console.error('Error getting current profile:', e);
      }
      
      // Check activeProfileToTime
      try {
        const activeProfile = client.profilefunctions.activeProfileToTime();
        console.log('Active profile name:', activeProfile);
      } catch (e) {
        console.error('Error getting active profile:', e);
      }
      
      // Check profile from time
      try {
        const profileFromTime = client.profilefunctions.profileFromTime();
        console.log('Profile from time:', profileFromTime);
      } catch (e) {
        console.error('Error getting profile from time:', e);
      }
    }
    
    // Check raw profile data
    if (client.ddata && client.ddata.profiles) {
      console.log('Raw profile data:', client.ddata.profiles);
    }
  } else {
    console.error('Nightscout client not found');
  }
})();
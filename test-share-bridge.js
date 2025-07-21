// Test the actual share2nightscout-bridge module
const bridge = require('share2nightscout-bridge');

const options = {
  login: {
    accountName: 'mark@markmireles.com',
    password: 'GodIsGood23!'
  },
  interval: 150000, // 2.5 minutes
  fetch: {
    maxCount: 10,
    minutes: 60
  },
  nightscout: {
    endpoint: 'http://localhost:1337/api/v1/entries.json',
    secret: 'dummy' // We'll intercept before it posts
  },
  callback: function(err, glucose) {
    if (err) {
      console.error('❌ Bridge error:', err);
      return;
    }
    
    console.log('✅ Bridge fetched data successfully!');
    console.log('Glucose readings:', glucose);
    
    if (glucose && glucose.length > 0) {
      console.log('\nLatest reading:');
      console.log('- SGV:', glucose[0].sgv);
      console.log('- Direction:', glucose[0].direction);
      console.log('- Date:', new Date(glucose[0].date));
      
      // Don't actually post to Nightscout, just show what we got
      console.log('\n✅ The bridge is working! Data can be fetched.');
      console.log('Total readings:', glucose.length);
    }
    
    process.exit(0);
  },
  maxFailures: 1
};

console.log('🔄 Testing share2nightscout-bridge...\n');
console.log('Account:', options.login.accountName);
console.log('Fetching last', options.fetch.minutes, 'minutes of data\n');

// Run once
bridge(options);
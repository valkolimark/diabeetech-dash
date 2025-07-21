// Debug Dexcom Share API connection
const axios = require('axios');

// Dexcom configuration
const DEXCOM_CONFIG = {
  userName: 'mark@markmireles.com',
  password: 'GodIsGood23!',
  server: 'us'
};

// Dexcom Share API endpoints
const DEXCOM_BASE_URL = 'https://share2.dexcom.com/ShareWebServices/Services';
const LOGIN_ENDPOINT = '/General/LoginPublisherAccountByName';
const READINGS_ENDPOINT = '/Publisher/ReadPublisherLatestGlucoseValues';
const VERIFY_ENDPOINT = '/General/VerifyInternetConnectivity';
const AUTHENTICATE_ENDPOINT = '/General/AuthenticatePublisherAccount';

async function debugDexcomAPI() {
  console.log('🔍 Debugging Dexcom Share API Connection\n');
  
  try {
    // Step 1: Test connectivity
    console.log('1. Testing API connectivity...');
    try {
      const connectivityResponse = await axios.get(
        `${DEXCOM_BASE_URL}${VERIFY_ENDPOINT}`,
        {
          headers: {
            'User-Agent': 'Dexcom Share/3.0.2.11 CFNetwork/672.0.2 Darwin/14.0.0'
          }
        }
      );
      console.log('✅ API is reachable');
    } catch (err) {
      console.log('⚠️ Connectivity test failed:', err.message);
    }
    
    // Step 2: Test authentication
    console.log('\n2. Testing authentication...');
    try {
      const authResponse = await axios.post(
        `${DEXCOM_BASE_URL}${AUTHENTICATE_ENDPOINT}`,
        {
          accountName: DEXCOM_CONFIG.userName,
          password: DEXCOM_CONFIG.password,
          applicationId: 'd89443d2-327c-4a6f-89e5-496bbb0317db'
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Dexcom Share/3.0.2.11 CFNetwork/672.0.2 Darwin/14.0.0',
            'Accept': 'application/json'
          }
        }
      );
      
      console.log('Auth response:', authResponse.data);
      
      if (authResponse.data === '00000000-0000-0000-0000-000000000000') {
        console.log('❌ Authentication failed - invalid credentials');
        console.log('\nPossible issues:');
        console.log('- Check username/password are correct');
        console.log('- Ensure Dexcom Share is enabled in your Dexcom app');
        console.log('- If using a follower account, ensure you have been invited');
        return;
      } else {
        console.log('✅ Authentication successful');
      }
    } catch (err) {
      console.log('❌ Authentication error:', err.response?.data || err.message);
      return;
    }
    
    // Step 3: Login and get session
    console.log('\n3. Logging in to get session...');
    const loginResponse = await axios.post(
      `${DEXCOM_BASE_URL}${LOGIN_ENDPOINT}`,
      {
        accountName: DEXCOM_CONFIG.userName,
        password: DEXCOM_CONFIG.password,
        applicationId: 'd89443d2-327c-4a6f-89e5-496bbb0317db'
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Dexcom Share/3.0.2.11 CFNetwork/672.0.2 Darwin/14.0.0',
          'Accept': 'application/json'
        }
      }
    );
    
    const sessionId = loginResponse.data;
    console.log('✅ Session ID:', sessionId.substring(0, 8) + '...');
    
    // Step 4: Try different time ranges
    console.log('\n4. Testing different time ranges for glucose data...');
    
    const timeRanges = [
      { minutes: 15, maxCount: 3 },
      { minutes: 60, maxCount: 12 },
      { minutes: 180, maxCount: 36 },
      { minutes: 1440, maxCount: 288 }
    ];
    
    for (const range of timeRanges) {
      console.log(`\nTrying ${range.minutes} minutes (max ${range.maxCount} readings)...`);
      
      try {
        const readingsResponse = await axios.post(
          `${DEXCOM_BASE_URL}${READINGS_ENDPOINT}`,
          {
            sessionId: sessionId,
            minutes: range.minutes,
            maxCount: range.maxCount
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': 'Dexcom Share/3.0.2.11 CFNetwork/672.0.2 Darwin/14.0.0',
              'Accept': 'application/json'
            }
          }
        );
        
        const readings = readingsResponse.data;
        console.log('Response type:', typeof readings);
        console.log('Response:', JSON.stringify(readings).substring(0, 200));
        
        if (Array.isArray(readings) && readings.length > 0) {
          console.log(`✅ Found ${readings.length} readings!`);
          console.log('\nLatest reading:');
          const latest = readings[0];
          console.log('- Value:', latest.Value, 'mg/dL');
          console.log('- Trend:', latest.Trend);
          console.log('- Time:', latest.ST);
          break;
        } else if (Array.isArray(readings)) {
          console.log(`⚠️ No readings in last ${range.minutes} minutes`);
        } else {
          console.log('❌ Unexpected response format');
        }
      } catch (err) {
        console.log('Error:', err.response?.status, err.response?.data || err.message);
      }
    }
    
  } catch (error) {
    console.error('\n❌ Error during debug:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
      console.error('Headers:', error.response.headers);
    } else {
      console.error(error.message);
    }
  }
}

// Run the debug
debugDexcomAPI();
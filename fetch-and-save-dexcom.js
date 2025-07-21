// Direct Dexcom fetch using axios
const axios = require('axios');
const { MongoClient } = require('mongodb');

const MONGO_URI = 'mongodb+srv://markt:xebkaW-kaqmu4-wynkor@nightscout-master.nkz27.mongodb.net/nightscout-master?retryWrites=true&w=majority&appName=nightscout-master';

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

// Trend mapping
const DIRECTIONS = {
  NONE: 0,
  DoubleUp: 1,
  SingleUp: 2,
  FortyFiveUp: 3,
  Flat: 4,
  FortyFiveDown: 5,
  SingleDown: 6,
  DoubleDown: 7,
  'NOT COMPUTABLE': 8,
  'RATE OUT OF RANGE': 9
};

const DIRECTION_NAMES = ['None', 'DoubleUp', 'SingleUp', 'FortyFiveUp', 'Flat', 'FortyFiveDown', 'SingleDown', 'DoubleDown', 'NOT COMPUTABLE', 'RATE OUT OF RANGE'];

async function fetchAndSaveDexcom() {
  console.log('🔄 Fetching Dexcom data...\n');
  
  try {
    // Login to Dexcom
    console.log('Logging in to Dexcom...');
    const loginData = {
      accountName: DEXCOM_CONFIG.userName,
      password: DEXCOM_CONFIG.password,
      applicationId: 'd89443d2-327c-4a6f-89e5-496bbb0317db'
    };
    
    const loginResponse = await axios.post(
      `${DEXCOM_BASE_URL}${LOGIN_ENDPOINT}`,
      loginData,
      {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Dexcom Share/3.0.2.11 CFNetwork/711.2.23 Darwin/14.0.0',
          'Accept': 'application/json'
        }
      }
    );
    
    const sessionId = loginResponse.data;
    console.log('✅ Login successful!');
    
    // Fetch glucose readings
    console.log('Fetching glucose readings...');
    const readingsData = {
      sessionId: sessionId,
      minutes: 1440,
      maxCount: 288
    };
    
    const readingsResponse = await axios.post(
      `${DEXCOM_BASE_URL}${READINGS_ENDPOINT}`,
      readingsData,
      {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      }
    );
    
    const readings = readingsResponse.data;
    
    // Debug the response
    console.log('Response type:', typeof readings);
    console.log('Response:', JSON.stringify(readings).substring(0, 500));
    
    if (!Array.isArray(readings) || readings.length === 0) {
      console.log('No readings available. This could mean:');
      console.log('- Dexcom sensor is warming up');
      console.log('- Share was just enabled and needs time to sync');
      console.log('- No recent CGM data');
      console.log('\nWait a few minutes and try again.');
      return;
    }
    
    console.log(`✅ Fetched ${readings.length} readings\n`);
    
    // Connect to MongoDB
    const client = new MongoClient(MONGO_URI);
    await client.connect();
    const db = client.db('tenant_onepanman');
    
    // Process readings
    const entries = readings.map(reading => {
      // Parse Dexcom timestamp "/Date(1234567890000)/"
      const match = reading.WT.match(/Date\((\d+)\)/);
      const timestamp = match ? parseInt(match[1]) : Date.now();
      
      return {
        device: 'share2',
        date: timestamp,
        dateString: new Date(timestamp).toISOString(),
        sgv: reading.Value,
        direction: DIRECTION_NAMES[reading.Trend] || 'None',
        type: 'sgv',
        created_at: new Date().toISOString(),
        mills: timestamp,
        mgdl: reading.Value
      };
    });
    
    // Save to MongoDB
    console.log('Saving to MongoDB...');
    for (const entry of entries) {
      await db.collection('entries').replaceOne(
        { date: entry.date, device: entry.device },
        entry,
        { upsert: true }
      );
    }
    
    console.log(`✅ Saved ${entries.length} entries to MongoDB`);
    
    // Show latest readings
    console.log('\nLatest readings (Central Time):');
    entries.slice(0, 10).forEach((entry, i) => {
      const date = new Date(entry.date);
      const centralTime = date.toLocaleString('en-US', {
        timeZone: 'America/Chicago',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
      console.log(`${i+1}. ${centralTime} CST - ${entry.sgv} mg/dL ${entry.direction}`);
    });
    
    await client.close();
    console.log('\n✅ Done! Refresh your browser to see the data.');
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

fetchAndSaveDexcom();
// Test Dexcom bridge fetch manually
const axios = require('axios');
const { MongoClient } = require('mongodb');
const crypto = require('crypto');

// MongoDB connection
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

async function fetchDexcomData() {
  console.log('🔄 Fetching data from Dexcom Share API...\n');
  
  try {
    // Step 1: Login to Dexcom
    console.log('1. Logging in to Dexcom...');
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
          'User-Agent': 'Dexcom Share/3.0.2.11 CFNetwork/672.0.2 Darwin/14.0.0'
        }
      }
    );
    
    const sessionId = loginResponse.data;
    console.log('✅ Login successful! Session ID:', sessionId.substring(0, 8) + '...');
    
    // Step 2: Fetch glucose readings
    console.log('\n2. Fetching glucose readings...');
    const readingsResponse = await axios.post(
      `${DEXCOM_BASE_URL}${READINGS_ENDPOINT}`,
      {
        sessionId: sessionId,
        minutes: 180,  // Get last 3 hours
        maxCount: 36   // Get up to 36 readings
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Dexcom Share/3.0.2.11 CFNetwork/672.0.2 Darwin/14.0.0'
        }
      }
    );
    
    const readings = readingsResponse.data;
    console.log('Response data:', JSON.stringify(readings));
    
    if (!Array.isArray(readings)) {
      console.log('❌ Unexpected response format. Expected array, got:', typeof readings);
      await client.close();
      return;
    }
    
    if (readings.length === 0) {
      console.log('⚠️ No readings available from Dexcom. This could mean:');
      console.log('- The Dexcom sensor is warming up');
      console.log('- No recent data is available');
      console.log('- The account credentials may be incorrect');
      await client.close();
      return;
    }
    
    console.log('✅ Fetched', readings.length, 'readings\n');
    
    // Step 3: Process and save to MongoDB
    const client = new MongoClient(MONGO_URI);
    await client.connect();
    const db = client.db('tenant_onepanman');
    
    const entries = readings.map(reading => {
      // Parse Dexcom timestamp
      const match = reading.ST.match(/Date\\((\\d+)([+-]\\d+)?\\)/);
      const timestamp = match ? parseInt(match[1]) : Date.now();
      const date = new Date(timestamp);
      
      // Adjust for Central Time Zone (America/Chicago)
      const centralDate = new Date(date.toLocaleString("en-US", {timeZone: "America/Chicago"}));
      
      return {
        device: 'share2',
        date: timestamp,
        dateString: date.toISOString(),
        sgv: reading.Value,
        direction: reading.Trend,
        type: 'sgv',
        created_at: new Date().toISOString(),
        mills: timestamp
      };
    });
    
    console.log('3. Saving to MongoDB...');
    
    // Remove old entries to avoid duplicates
    await db.collection('entries').deleteMany({
      device: 'share2',
      date: { $gte: entries[entries.length - 1].date }
    });
    
    // Insert new entries
    const result = await db.collection('entries').insertMany(entries);
    console.log('✅ Saved', result.insertedCount, 'entries to MongoDB\n');
    
    // Show latest readings
    console.log('📊 Latest readings:');
    entries.slice(0, 5).forEach((entry, i) => {
      const localTime = new Date(entry.date).toLocaleString('en-US', {
        timeZone: 'America/Chicago',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
      console.log(`${i+1}. ${localTime} CST - ${entry.sgv} mg/dL ${entry.direction}`);
    });
    
    await client.close();
    
    console.log('\n✅ Bridge fetch complete!');
    console.log('🔄 Data should now appear in Nightscout');
    
  } catch (error) {
    console.error('❌ Error fetching Dexcom data:');
    if (error.response) {
      console.error('Response:', error.response.status, error.response.data);
    } else {
      console.error(error.message);
    }
  }
}

// Run the fetch
fetchDexcomData();
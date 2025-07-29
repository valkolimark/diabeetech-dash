#!/bin/bash

# Update Dexcom credentials on Heroku
# This script runs the credential update directly on Heroku

APP_NAME="btech"

echo "=== Updating Dexcom Credentials on Heroku ==="
echo ""

# Create temporary update script
cat > /tmp/update-credentials.js << 'EOF'
const MongoClient = require('mongodb').MongoClient;

async function updateCredentials() {
  const uri = process.env.MONGODB_URI;
  const client = await MongoClient.connect(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });
  
  console.log('Connected to MongoDB');
  
  // Update Arimarco
  const arimarcoDb = client.db('nightscout-tenant-arimarco');
  await arimarcoDb.collection('settings').updateOne({}, {
    $set: {
      'bridge.userName': 'ari@p5400.com',
      'bridge.password': 'CamZack23!',
      'bridge.enable': true,
      'bridge.interval': 150000
    }
  }, { upsert: true });
  
  await arimarcoDb.collection('profile').updateOne(
    { _id: 'default' },
    {
      $set: {
        'bridge.userName': 'ari@p5400.com',
        'bridge.password': 'CamZack23!',
        'bridge.enable': true,
        'bridge.interval': 150000
      }
    }
  );
  
  console.log('✅ Arimarco credentials updated');
  
  // Update Jordan
  const jordanDb = client.db('nightscout_3231e141e813d8b788a306ed');
  await jordanDb.collection('settings').updateOne({}, {
    $set: {
      'bridge.userName': 'jordanmarco2323',
      'bridge.password': 'Camzack23',
      'bridge.enable': true,
      'bridge.interval': 150000
    }
  }, { upsert: true });
  
  await jordanDb.collection('profile').updateOne(
    { _id: 'default' },
    {
      $set: {
        'bridge.userName': 'jordanmarco2323',
        'bridge.password': 'Camzack23',
        'bridge.enable': true,
        'bridge.interval': 150000
      }
    }
  );
  
  console.log('✅ Jordan credentials updated');
  
  await client.close();
  console.log('\nCredentials updated successfully!');
}

updateCredentials().catch(console.error);
EOF

echo "Running credential update on Heroku..."
echo ""

# Copy and run the script on Heroku
heroku run --no-tty -a $APP_NAME "cat > /tmp/update.js && node /tmp/update.js" < /tmp/update-credentials.js

echo ""
echo "Restarting app to apply changes..."
heroku restart -a $APP_NAME

echo ""
echo "✅ Update complete! Monitor bridge activity with:"
echo "   heroku logs --tail -a $APP_NAME | grep -i bridge"
echo ""
echo "Test the endpoints:"
echo "   curl 'https://arimarco.diabeetech.net/api/v1/entries/current.json?secret=51a26cb40dcca4fd97601d00f8253129091c06ca'"
echo "   curl 'https://jordan.diabeetech.net/api/v1/entries/current.json?secret=51a26cb40dcca4fd97601d00f8253129091c06ca'"

# Clean up
rm -f /tmp/update-credentials.js
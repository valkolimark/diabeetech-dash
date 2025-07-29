#!/bin/bash

# Complete Dexcom Credential Fix
# This script updates credentials and verifies the fix

APP_NAME="btech"
API_SECRET="51a26cb40dcca4fd97601d00f8253129091c06ca"

echo "=== Complete Dexcom Credential Fix for Btech ==="
echo ""

# Check Heroku CLI
if ! heroku auth:whoami &> /dev/null; then
    echo "❌ Not logged into Heroku CLI"
    echo "Please run: heroku login"
    exit 1
fi

# Step 1: Get MongoDB URI
echo "Step 1: Getting MongoDB URI from Heroku..."
MONGODB_URI=$(heroku config:get MONGODB_URI -a $APP_NAME 2>/dev/null)

if [ -z "$MONGODB_URI" ]; then
    echo "❌ Could not get MongoDB URI"
    exit 1
fi

echo "✅ MongoDB URI retrieved"
echo ""

# Step 2: Run credential update
echo "Step 2: Updating Dexcom credentials in database..."
node tools/update-live-dexcom-credentials.js "$MONGODB_URI"

if [ $? -ne 0 ]; then
    echo "❌ Failed to update credentials"
    exit 1
fi

echo ""
echo "Step 3: Restarting Heroku app..."
heroku restart -a $APP_NAME

echo ""
echo "Step 4: Waiting for app to restart (30 seconds)..."
sleep 30

echo ""
echo "Step 5: Testing API endpoints..."
echo ""

# Test Arimarco
echo "Testing Arimarco..."
arimarco_response=$(curl -s "https://arimarco.diabeetech.net/api/v1/entries/current.json?secret=$API_SECRET")
if [ "$arimarco_response" != "[]" ]; then
    echo "✅ Arimarco: Data found"
    echo "$arimarco_response" | jq '.[0] | {sgv, dateString}' 2>/dev/null || echo "$arimarco_response"
else
    echo "⚠️  Arimarco: No data yet (bridge may need more time)"
fi

echo ""

# Test Jordan
echo "Testing Jordan..."
jordan_response=$(curl -s "https://jordan.diabeetech.net/api/v1/entries/current.json?secret=$API_SECRET")
if [ "$jordan_response" != "[]" ]; then
    echo "✅ Jordan: Data found"
    echo "$jordan_response" | jq '.[0] | {sgv, dateString}' 2>/dev/null || echo "$jordan_response"
else
    echo "⚠️  Jordan: No data yet (bridge may need more time)"
fi

echo ""
echo "=== Fix Complete ==="
echo ""
echo "Monitor bridge activity with:"
echo "  heroku logs --tail -a $APP_NAME | grep -i bridge"
echo ""
echo "If data doesn't appear within 5 minutes, check:"
echo "  1. Dexcom account credentials are correct"
echo "  2. Dexcom accounts have recent glucose data"
echo "  3. Bridge errors in logs"
#!/bin/bash

# Test Registration with Dexcom Integration
# Creates a test user with Dexcom credentials to verify full data flow

API_SECRET="51a26cb40dcca4fd97601d00f8253129091c06ca"
BASE_URL="https://diabeetech.net"
TEST_USER="testreg"
TEST_EMAIL="testreg@example.com"
TEST_PASSWORD="TestReg123!"
DEXCOM_USER="ari@p5400.com"
DEXCOM_PASS="CamZack23!"

echo "=== Testing Registration with Dexcom Integration ==="
echo "Creating user: $TEST_USER"
echo "With Dexcom account: $DEXCOM_USER"
echo ""

# Step 1: Check if username is available
echo "Step 1: Checking username availability..."
AVAILABILITY=$(curl -s "$BASE_URL/api/register/check-username/$TEST_USER")
echo "Response: $AVAILABILITY"

if [[ $(echo "$AVAILABILITY" | jq -r '.available' 2>/dev/null) != "true" ]]; then
    echo "⚠️  Username '$TEST_USER' already taken"
    echo "Proceeding to test login instead..."
    SKIP_REGISTRATION=true
else
    echo "✅ Username available"
    SKIP_REGISTRATION=false
fi
echo ""

if [ "$SKIP_REGISTRATION" = false ]; then
    # Step 2: Register with Dexcom
    echo "Step 2: Registering account with Dexcom integration..."
    REGISTER_RESPONSE=$(curl -s -X POST "$BASE_URL/api/register" \
        -H "Content-Type: application/json" \
        -d "{
            \"username\": \"$TEST_USER\",
            \"email\": \"$TEST_EMAIL\",
            \"password\": \"$TEST_PASSWORD\",
            \"displayName\": \"Test Registration\",
            \"units\": \"mg/dl\",
            \"dexcom\": {
                \"username\": \"$DEXCOM_USER\",
                \"password\": \"$DEXCOM_PASS\"
            }
        }")

    if [[ -z "$REGISTER_RESPONSE" ]]; then
        echo "❌ No response from registration endpoint"
        exit 1
    fi

    # Check for success
    MESSAGE=$(echo "$REGISTER_RESPONSE" | jq -r '.message' 2>/dev/null)
    if [[ "$MESSAGE" != "Account created successfully" ]]; then
        echo "❌ Registration failed"
        echo "Response: $REGISTER_RESPONSE"
        exit 1
    fi

    echo "✅ Registration successful!"
    echo "Response: $(echo "$REGISTER_RESPONSE" | jq -c '.')"
    
    # Extract details
    TENANT_URL=$(echo "$REGISTER_RESPONSE" | jq -r '.tenant.url')
    DEXCOM_CONFIGURED=$(echo "$REGISTER_RESPONSE" | jq -r '.features.dexcomConfigured')
    
    echo ""
    echo "Tenant created:"
    echo "  URL: $TENANT_URL"
    echo "  Dexcom Configured: $DEXCOM_CONFIGURED"
    
    # Wait for services
    echo ""
    echo "Waiting 15 seconds for services to initialize..."
    sleep 15
else
    TENANT_URL="https://testreg.diabeetech.net"
fi

# Step 3: Test login
echo ""
echo "Step 3: Testing login..."
LOGIN_RESPONSE=$(curl -s -X POST "$TENANT_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{
        \"email\": \"$TEST_EMAIL\",
        \"password\": \"$TEST_PASSWORD\"
    }")

if [[ -z $(echo "$LOGIN_RESPONSE" | jq -r '.accessToken' 2>/dev/null) ]]; then
    echo "❌ Login failed"
    echo "Response: $LOGIN_RESPONSE"
    echo ""
    echo "Troubleshooting: Check if password field needs fixing"
    exit 1
fi

echo "✅ Login successful"
TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.accessToken')

# Step 4: Check API status
echo ""
echo "Step 4: Checking API status..."
STATUS_RESPONSE=$(curl -s "$TENANT_URL/api/v1/status.json?secret=$API_SECRET")

if [[ $(echo "$STATUS_RESPONSE" | jq -r '.status' 2>/dev/null) != "ok" ]]; then
    echo "❌ API status check failed"
    echo "Response: $STATUS_RESPONSE"
else
    echo "✅ API is operational"
fi

# Step 5: Wait for Dexcom data
echo ""
echo "Step 5: Waiting for Dexcom bridge to collect data (30 seconds)..."
sleep 30

# Step 6: Check for glucose data
echo ""
echo "Step 6: Checking for glucose data..."
ENTRIES_RESPONSE=$(curl -s "$TENANT_URL/api/v1/entries/current.json?secret=$API_SECRET")

if [[ "$ENTRIES_RESPONSE" == "[]" ]]; then
    echo "⚠️  No glucose data yet"
    echo ""
    echo "Checking bridge logs..."
    echo "Run: heroku logs --tail -a btech | grep -i 'bridge.*testreg'"
    
    # Try waiting more
    echo ""
    echo "Waiting additional 60 seconds for bridge..."
    sleep 60
    
    # Check again
    ENTRIES_RESPONSE=$(curl -s "$TENANT_URL/api/v1/entries/current.json?secret=$API_SECRET")
    if [[ "$ENTRIES_RESPONSE" == "[]" ]]; then
        echo "❌ Still no data after waiting"
        echo ""
        echo "Possible issues:"
        echo "  1. Bridge not started - restart app"
        echo "  2. Dexcom credentials incorrect"
        echo "  3. No recent data in Dexcom account"
    else
        echo "✅ Data collection started!"
    fi
else
    echo "✅ Glucose data found!"
    echo "$ENTRIES_RESPONSE" | jq '.[0] | {sgv, dateString, direction}'
fi

# Step 7: Verify multiple endpoints
echo ""
echo "Step 7: Testing additional endpoints..."

# Treatments
TREATMENTS=$(curl -s "$TENANT_URL/api/v1/treatments.json?secret=$API_SECRET")
echo -n "  Treatments endpoint: "
if [[ -n "$TREATMENTS" ]]; then echo "✅"; else echo "❌"; fi

# Device status
DEVICESTATUS=$(curl -s "$TENANT_URL/api/v1/devicestatus.json?secret=$API_SECRET")
echo -n "  Device status endpoint: "
if [[ -n "$DEVICESTATUS" ]]; then echo "✅"; else echo "❌"; fi

# Profile
PROFILE=$(curl -s "$TENANT_URL/api/v1/profile.json?secret=$API_SECRET")
echo -n "  Profile endpoint: "
if [[ -n "$PROFILE" ]]; then echo "✅"; else echo "❌"; fi

# Summary
echo ""
echo "=== Test Summary ==="
if [[ "$SKIP_REGISTRATION" = true ]]; then
    echo "⚠️  Registration skipped (user already exists)"
else
    echo "✅ Registration completed"
fi
echo "✅ Login working"
echo "✅ API endpoints accessible"

if [[ "$ENTRIES_RESPONSE" != "[]" ]]; then
    echo "✅ Dexcom data collection working"
else
    echo "⚠️  Dexcom data not yet available"
fi

echo ""
echo "Test account details:"
echo "  URL: $TENANT_URL"
echo "  Email: $TEST_EMAIL"
echo "  Password: $TEST_PASSWORD"
echo "  API Secret: $API_SECRET"
echo ""
echo "Monitor data collection:"
echo "  curl '$TENANT_URL/api/v1/entries/current.json?secret=$API_SECRET' | jq '.'"
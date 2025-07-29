#!/bin/bash

# Test Registration Process End-to-End
# This script validates the complete registration flow

API_SECRET="51a26cb40dcca4fd97601d00f8253129091c06ca"
BASE_URL="https://diabeetech.net"
TEST_USER="testuser$(date +%s)"
TEST_EMAIL="test${TEST_USER}@example.com"
TEST_PASSWORD="TestPass123!"

echo "=== Diabeetech Registration Test ==="
echo "Testing registration with:"
echo "  Username: $TEST_USER"
echo "  Email: $TEST_EMAIL"
echo ""

# Step 1: Check username availability
echo "1. Checking username availability..."
AVAILABILITY=$(curl -s "$BASE_URL/api/register/check-username/$TEST_USER")
echo "Response: $AVAILABILITY"

if [[ $(echo "$AVAILABILITY" | jq -r '.available') != "true" ]]; then
    echo "❌ Username not available"
    exit 1
fi
echo "✅ Username available"
echo ""

# Step 2: Register new account
echo "2. Registering new account..."
REGISTER_RESPONSE=$(curl -s -X POST "$BASE_URL/api/register" \
    -H "Content-Type: application/json" \
    -d "{
        \"username\": \"$TEST_USER\",
        \"email\": \"$TEST_EMAIL\",
        \"password\": \"$TEST_PASSWORD\",
        \"displayName\": \"Test User\",
        \"units\": \"mg/dl\"
    }")

if [[ -z "$REGISTER_RESPONSE" ]] || [[ $(echo "$REGISTER_RESPONSE" | jq -r '.message') != "Account created successfully" ]]; then
    echo "❌ Registration failed"
    echo "Response: $REGISTER_RESPONSE"
    exit 1
fi

echo "✅ Registration successful"
TENANT_URL=$(echo "$REGISTER_RESPONSE" | jq -r '.tenant.url')
echo "  Tenant URL: $TENANT_URL"
echo ""

# Step 3: Wait for services to initialize
echo "3. Waiting for services to initialize (10 seconds)..."
sleep 10

# Step 4: Test login
echo "4. Testing login..."
LOGIN_RESPONSE=$(curl -s -X POST "$TENANT_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{
        \"email\": \"$TEST_EMAIL\",
        \"password\": \"$TEST_PASSWORD\"
    }")

if [[ -z "$LOGIN_RESPONSE" ]] || [[ -z $(echo "$LOGIN_RESPONSE" | jq -r '.accessToken' 2>/dev/null) ]]; then
    echo "❌ Login failed"
    echo "Response: $LOGIN_RESPONSE"
    
    # Additional diagnostics
    echo ""
    echo "Diagnostics:"
    echo "  - Check if password field is correct in database"
    echo "  - Run: node tools/check-user-status.js $TEST_EMAIL"
    exit 1
fi

echo "✅ Login successful"
TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.accessToken')
echo ""

# Step 5: Test API access
echo "5. Testing API access..."
API_RESPONSE=$(curl -s "$TENANT_URL/api/v1/status.json?secret=$API_SECRET")

if [[ $(echo "$API_RESPONSE" | jq -r '.status') != "ok" ]]; then
    echo "❌ API access failed"
    echo "Response: $API_RESPONSE"
    exit 1
fi

echo "✅ API access working"
echo ""

# Step 6: Check data endpoints
echo "6. Checking data endpoints..."
ENTRIES_RESPONSE=$(curl -s "$TENANT_URL/api/v1/entries.json?secret=$API_SECRET")

if [[ "$ENTRIES_RESPONSE" == "[]" ]]; then
    echo "⚠️  No entries yet (expected for new account without Dexcom)"
else
    echo "✅ Entries endpoint working"
fi

# Summary
echo ""
echo "=== Registration Test Complete ==="
echo "✅ All critical tests passed"
echo ""
echo "New tenant details:"
echo "  URL: $TENANT_URL"
echo "  Email: $TEST_EMAIL"
echo "  Password: $TEST_PASSWORD"
echo "  API Secret: $API_SECRET"
echo ""
echo "To clean up test account, run:"
echo "  node scripts/tests/delete-tenant-by-subdomain.js $TEST_USER"
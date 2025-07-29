#!/bin/bash

# Test script for Btech Nightscout API endpoints
# This script tests the API endpoints for both tenants

API_SECRET="51a26cb40dcca4fd97601d00f8253129091c06ca"
ARIMARCO_URL="https://arimarco.diabeetech.net"
JORDAN_URL="https://jordan.diabeetech.net"

echo "=== Btech API Endpoint Tests ==="
echo "Testing time: $(date)"
echo ""

# Function to test API endpoint
test_endpoint() {
    local name=$1
    local url=$2
    local endpoint=$3
    
    echo "Testing $name - $endpoint"
    response=$(curl -s -w "\nHTTP_STATUS:%{http_code}" "$url$endpoint?secret=$API_SECRET")
    http_status=$(echo "$response" | grep "HTTP_STATUS:" | cut -d: -f2)
    body=$(echo "$response" | grep -v "HTTP_STATUS:")
    
    if [ "$http_status" = "200" ]; then
        echo "✅ Status: $http_status"
        echo "Response preview: $(echo "$body" | head -c 200)..."
    else
        echo "❌ Status: $http_status"
        echo "Response: $body"
    fi
    echo ""
}

# Test Arimarco tenant
echo "=== ARIMARCO TENANT ==="
test_endpoint "Arimarco" "$ARIMARCO_URL" "/api/v1/entries/current.json"
test_endpoint "Arimarco" "$ARIMARCO_URL" "/api/v1/entries.json"
test_endpoint "Arimarco" "$ARIMARCO_URL" "/api/v1/status.json"
test_endpoint "Arimarco" "$ARIMARCO_URL" "/api/v1/devicestatus.json"

# Test Jordan tenant
echo "=== JORDAN TENANT ==="
test_endpoint "Jordan" "$JORDAN_URL" "/api/v1/entries/current.json"
test_endpoint "Jordan" "$JORDAN_URL" "/api/v1/entries.json"
test_endpoint "Jordan" "$JORDAN_URL" "/api/v1/status.json"
test_endpoint "Jordan" "$JORDAN_URL" "/api/v1/devicestatus.json"

echo "=== Test completed ==="
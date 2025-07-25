#!/bin/bash

# Check data availability for onepanman tenant
SUBDOMAIN="onepanman"
API_SECRET="GodIsSoGood2Me23!"
API_SECRET_HASH=$(echo -n "$API_SECRET" | shasum | cut -d ' ' -f1)
BASE_URL="https://${SUBDOMAIN}.diabeetech.net"

echo "========================================="
echo "Checking data for: $SUBDOMAIN"
echo "========================================="

# 1. Check API Status
echo -e "\n1. API Status Check:"
curl -s -X GET "${BASE_URL}/api/v1/status" \
  -H "api-secret: ${API_SECRET_HASH}" \
  -H "Accept: application/json" | jq '.' 2>/dev/null || echo "Status check failed"

# 2. Check Entries (BG data)
echo -e "\n\n2. Recent BG Entries (last 10):"
ENTRIES=$(curl -s -X GET "${BASE_URL}/api/v1/entries?count=10" \
  -H "api-secret: ${API_SECRET_HASH}" \
  -H "Accept: application/json")
echo "Entries count: $(echo "$ENTRIES" | grep -o '"_id"' | wc -l)"
echo "Latest entry: $(echo "$ENTRIES" | jq '.[0] | {dateString, sgv, direction}' 2>/dev/null)"

# 3. Check Treatments
echo -e "\n\n3. Recent Treatments (last 10):"
TREATMENTS=$(curl -s -X GET "${BASE_URL}/api/v1/treatments?count=10" \
  -H "api-secret: ${API_SECRET_HASH}" \
  -H "Accept: application/json")
echo "Treatments count: $(echo "$TREATMENTS" | grep -o '"_id"' | wc -l)"

# 4. Check Device Status
echo -e "\n\n4. Recent Device Status:"
DEVICESTATUS=$(curl -s -X GET "${BASE_URL}/api/v1/devicestatus?count=5" \
  -H "api-secret: ${API_SECRET_HASH}" \
  -H "Accept: application/json")
echo "Device status count: $(echo "$DEVICESTATUS" | grep -o '"_id"' | wc -l)"
echo "Latest device: $(echo "$DEVICESTATUS" | jq '.[0] | {device, created_at}' 2>/dev/null)"

# 5. Check Profile
echo -e "\n\n5. Profile Data:"
PROFILE=$(curl -s -X GET "${BASE_URL}/api/v1/profile" \
  -H "api-secret: ${API_SECRET_HASH}" \
  -H "Accept: application/json")
echo "Profile exists: $(echo "$PROFILE" | grep -q '"_id"' && echo "Yes" || echo "No")"

# 6. Test without authentication (should fail)
echo -e "\n\n6. Testing without auth (should fail):"
NO_AUTH=$(curl -s -X GET "${BASE_URL}/api/v1/entries" -w "\nHTTP_STATUS:%{http_code}")
echo "Status: $(echo "$NO_AUTH" | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2)"

# 7. Check main page
echo -e "\n\n7. Main page status:"
MAIN_PAGE=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/")
echo "Main page HTTP status: $MAIN_PAGE"

echo -e "\n========================================="
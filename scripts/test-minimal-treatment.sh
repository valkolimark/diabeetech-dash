#!/bin/bash

# Minimal test for treatments API
# Just the bare minimum fields

SUBDOMAIN="onepanman"
API_SECRET_HASH="51a26cb40dcca4fd97601d00f8253129091c06ca"
BASE_URL="https://${SUBDOMAIN}.diabeetech.net"

echo "Testing minimal treatment creation..."
echo "=================================="

# Test with just eventType
MINIMAL_DATA='{
  "eventType": "Note"
}'

echo "Sending: $MINIMAL_DATA"
echo

RESPONSE=$(curl -s -X POST "${BASE_URL}/api/v1/treatments" \
  -H "api-secret: ${API_SECRET_HASH}" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d "$MINIMAL_DATA" \
  -w "\nHTTP_STATUS:%{http_code}")

HTTP_STATUS=$(echo "$RESPONSE" | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed 's/HTTP_STATUS:[0-9]*$//')

echo "Response Status: $HTTP_STATUS"
echo "Response Body: $BODY"

# If that fails, try with created_at
if [ "$HTTP_STATUS" != "200" ] && [ "$HTTP_STATUS" != "201" ]; then
  echo -e "\nTrying with created_at field..."
  
  WITH_DATE='{
    "eventType": "Note",
    "created_at": "'$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")'"
  }'
  
  echo "Sending: $WITH_DATE"
  echo
  
  RESPONSE=$(curl -s -X POST "${BASE_URL}/api/v1/treatments" \
    -H "api-secret: ${API_SECRET_HASH}" \
    -H "Content-Type: application/json" \
    -H "Accept: application/json" \
    -d "$WITH_DATE" \
    -w "\nHTTP_STATUS:%{http_code}")
  
  HTTP_STATUS=$(echo "$RESPONSE" | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2)
  BODY=$(echo "$RESPONSE" | sed 's/HTTP_STATUS:[0-9]*$//')
  
  echo "Response Status: $HTTP_STATUS"
  echo "Response Body: $BODY"
fi
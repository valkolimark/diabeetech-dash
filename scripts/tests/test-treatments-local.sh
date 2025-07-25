#!/bin/bash

# Quick local test for treatments API
# This script assumes you're running Nightscout locally

SUBDOMAIN="${1:-onepanman}"
API_SECRET="${2:-GodIsSoGood2Me23!}"
API_SECRET_HASH=$(echo -n "$API_SECRET" | shasum | cut -d ' ' -f1)
BASE_URL="http://localhost:1337"  # Local development URL

echo "Testing Treatments API locally"
echo "API Secret Hash: ${API_SECRET_HASH:0:10}..."
echo "================================"

# Test 1: Simple POST
echo "Test 1: Creating simple treatment..."
RESPONSE=$(curl -s -X POST "${BASE_URL}/api/v1/treatments" \
  -H "api-secret: ${API_SECRET_HASH}" \
  -H "X-Tenant-Subdomain: ${SUBDOMAIN}" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{
    "eventType": "Note",
    "notes": "Test from local script",
    "created_at": "'$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")'"
  }' \
  -w "\nHTTP_STATUS:%{http_code}")

HTTP_STATUS=$(echo "$RESPONSE" | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed 's/HTTP_STATUS:[0-9]*$//')

echo "Status: $HTTP_STATUS"
echo "Response: $BODY"

if [[ "$HTTP_STATUS" == "200" ]]; then
  echo "✅ Success!"
else
  echo "❌ Failed!"
fi
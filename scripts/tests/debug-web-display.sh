#!/bin/bash

# Debug why web interface isn't displaying data
SUBDOMAIN="onepanman"
API_SECRET="GodIsSoGood2Me23!"
API_SECRET_HASH=$(echo -n "$API_SECRET" | shasum | cut -d ' ' -f1)
BASE_URL="https://${SUBDOMAIN}.diabeetech.net"

echo "========================================="
echo "Debugging Web Display Issue"
echo "========================================="

# 1. Check recent entries with more detail
echo -e "\n1. Last 5 BG entries with timestamps:"
curl -s -X GET "${BASE_URL}/api/v1/entries?count=5" \
  -H "api-secret: ${API_SECRET_HASH}" \
  -H "Accept: application/json" | jq '.[] | {date, dateString, sgv, direction, device, type}' 2>/dev/null

# 2. Check data format
echo -e "\n\n2. Raw data format check (first entry):"
curl -s -X GET "${BASE_URL}/api/v1/entries?count=1" \
  -H "api-secret: ${API_SECRET_HASH}" \
  -H "Accept: application/json" | jq '.' 2>/dev/null

# 3. Check pebble endpoint (simpler data format)
echo -e "\n\n3. Pebble endpoint check:"
curl -s -X GET "${BASE_URL}/pebble" \
  -H "Accept: application/json" | head -20

# 4. Check if there's a time zone issue
echo -e "\n\n4. Time analysis:"
echo "Current UTC time: $(date -u)"
echo "Current local time: $(date)"
LATEST_ENTRY=$(curl -s -X GET "${BASE_URL}/api/v1/entries?count=1" \
  -H "api-secret: ${API_SECRET_HASH}" \
  -H "Accept: application/json" | jq -r '.[0].dateString' 2>/dev/null)
echo "Latest entry time: $LATEST_ENTRY"

# 5. Check settings that might affect display
echo -e "\n\n5. Display-related settings:"
curl -s -X GET "${BASE_URL}/api/v1/status" \
  -H "api-secret: ${API_SECRET_HASH}" \
  -H "Accept: application/json" | jq '.settings | {units, timeFormat, theme, showPlugins, focusHours}' 2>/dev/null
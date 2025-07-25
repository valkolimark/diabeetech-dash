#!/bin/bash

# Find treatments with potential issues
SUBDOMAIN="onepanman"
API_SECRET="GodIsSoGood2Me23!"
API_SECRET_HASH=$(echo -n "$API_SECRET" | shasum | cut -d ' ' -f1)
BASE_URL="https://${SUBDOMAIN}.diabeetech.net"

echo "Finding potentially problematic treatments..."

# Get all treatments and check for missing fields
echo -e "\n1. Checking treatments for missing eventType:"
curl -s -X GET "${BASE_URL}/api/v1/treatments?count=50" \
  -H "api-secret: ${API_SECRET_HASH}" \
  -H "Accept: application/json" | \
  jq '.[] | select(.eventType == null or .eventType == "") | {_id, eventType, created_at, notes}'

echo -e "\n2. Checking for treatments with unusual fields:"
curl -s -X GET "${BASE_URL}/api/v1/treatments?count=50" \
  -H "api-secret: ${API_SECRET_HASH}" \
  -H "Accept: application/json" | \
  jq '.[] | select(.eventType == null) | .'

echo -e "\n3. Treatment types summary:"
curl -s -X GET "${BASE_URL}/api/v1/treatments?count=50" \
  -H "api-secret: ${API_SECRET_HASH}" \
  -H "Accept: application/json" | \
  jq -r '.[].eventType' | sort | uniq -c

echo -e "\n4. Most recent treatment:"
curl -s -X GET "${BASE_URL}/api/v1/treatments?count=1" \
  -H "api-secret: ${API_SECRET_HASH}" \
  -H "Accept: application/json" | jq '.'
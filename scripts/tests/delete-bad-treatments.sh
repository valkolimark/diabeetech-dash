#!/bin/bash

# Delete treatments with null eventType
SUBDOMAIN="onepanman"
API_SECRET="GodIsSoGood2Me23!"
API_SECRET_HASH=$(echo -n "$API_SECRET" | shasum | cut -d ' ' -f1)
BASE_URL="https://${SUBDOMAIN}.diabeetech.net"

echo "Deleting treatments with null eventType..."

# Treatment IDs to delete
BAD_IDS=("6883af5c3a82892757a35c87" "6883af5c3a82892757a35c86")

for ID in "${BAD_IDS[@]}"; do
    echo "Attempting to delete treatment: $ID"
    
    # Try DELETE endpoint
    RESPONSE=$(curl -s -X DELETE "${BASE_URL}/api/v1/treatments/${ID}" \
        -H "api-secret: ${API_SECRET_HASH}" \
        -H "Accept: application/json" \
        -w "\nHTTP_STATUS:%{http_code}")
    
    STATUS=$(echo "$RESPONSE" | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2)
    BODY=$(echo "$RESPONSE" | sed 's/HTTP_STATUS:[0-9]*$//')
    
    echo "Response: Status=$STATUS, Body=$BODY"
done

echo -e "\nChecking if treatments still exist..."
curl -s -X GET "${BASE_URL}/api/v1/treatments?count=50" \
  -H "api-secret: ${API_SECRET_HASH}" \
  -H "Accept: application/json" | \
  jq '.[] | select(.eventType == null) | {_id, eventType}'
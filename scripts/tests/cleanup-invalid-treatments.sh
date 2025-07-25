#!/bin/bash

# Clean up treatments with missing mills field
SUBDOMAIN="onepanman"
API_SECRET="GodIsSoGood2Me23!"
API_SECRET_HASH=$(echo -n "$API_SECRET" | shasum | cut -d ' ' -f1)
BASE_URL="https://${SUBDOMAIN}.diabeetech.net"

echo "Cleaning up invalid treatments..."

# Get list of treatments with null mills
INVALID_IDS=$(curl -s -X GET "${BASE_URL}/api/v1/treatments?count=100" \
  -H "api-secret: ${API_SECRET_HASH}" \
  -H "Accept: application/json" | \
  jq -r '.[] | select(.mills == null) | ._id')

# Count how many we found
COUNT=$(echo "$INVALID_IDS" | wc -l)
echo "Found $COUNT treatments with missing mills field"

# Delete each one
for ID in $INVALID_IDS; do
    if [ ! -z "$ID" ]; then
        echo "Deleting treatment: $ID"
        curl -s -X DELETE "${BASE_URL}/api/v1/treatments/${ID}" \
            -H "api-secret: ${API_SECRET_HASH}" \
            -H "Accept: application/json" > /dev/null
    fi
done

echo -e "\nVerifying cleanup..."
# Check if any remain
REMAINING=$(curl -s -X GET "${BASE_URL}/api/v1/treatments?count=100" \
  -H "api-secret: ${API_SECRET_HASH}" \
  -H "Accept: application/json" | \
  jq '.[] | select(.mills == null) | ._id' | wc -l)

echo "Remaining treatments with null mills: $REMAINING"

# Show remaining valid treatments
echo -e "\nRemaining treatments summary:"
curl -s -X GET "${BASE_URL}/api/v1/treatments?count=20" \
  -H "api-secret: ${API_SECRET_HASH}" \
  -H "Accept: application/json" | \
  jq -r '.[] | "\(.eventType // "Unknown") - \(.created_at // "No date") - by \(.enteredBy // "Unknown")"'
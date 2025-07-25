#!/bin/bash

# Check treatments from itiflux device
SUBDOMAIN="onepanman"
API_SECRET="GodIsSoGood2Me23!"
API_SECRET_HASH=$(echo -n "$API_SECRET" | shasum | cut -d ' ' -f1)
BASE_URL="https://${SUBDOMAIN}.diabeetech.net"

echo "Checking treatments from itiflux device..."

# 1. Find all treatments from itiflux (case insensitive)
echo -e "\n1. All treatments from itiflux (last 50):"
curl -s -X GET "${BASE_URL}/api/v1/treatments?count=50" \
  -H "api-secret: ${API_SECRET_HASH}" \
  -H "Accept: application/json" | \
  jq '.[] | select(.enteredBy | ascii_downcase == "itiflux") | {_id, eventType, created_at, mills, carbs, insulin, notes, enteredBy}'

# 2. Check the structure of a properly formatted treatment
echo -e "\n2. Example of a properly formatted treatment (with mills):"
curl -s -X GET "${BASE_URL}/api/v1/treatments?count=10" \
  -H "api-secret: ${API_SECRET_HASH}" \
  -H "Accept: application/json" | \
  jq '.[] | select(.mills != null) | {eventType, created_at, mills, enteredBy}' | head -20

# 3. Show what fields are expected
echo -e "\n3. Expected structure for treatments:"
echo "Required fields:"
echo "- eventType: The type of treatment (e.g., 'Meal Bolus', 'Carb Correction')"
echo "- created_at: ISO 8601 timestamp (e.g., '2025-07-25T12:00:00.000Z')"
echo "- mills: Epoch timestamp in milliseconds (e.g., 1753453200000)"
echo ""
echo "The 'mills' field should be the epoch timestamp (milliseconds since Jan 1, 1970)"
echo "It can be calculated from created_at date"

# 4. Example calculation
echo -e "\n4. Example mills calculation:"
SAMPLE_DATE="2025-07-25T12:00:00.000Z"
echo "For date: $SAMPLE_DATE"
echo "Mills would be: $(node -e "console.log(new Date('$SAMPLE_DATE').getTime())")"
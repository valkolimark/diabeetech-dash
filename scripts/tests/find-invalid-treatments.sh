#!/bin/bash

# Find treatments that might cause rendering issues
SUBDOMAIN="onepanman"
API_SECRET="GodIsSoGood2Me23!"
API_SECRET_HASH=$(echo -n "$API_SECRET" | shasum | cut -d ' ' -f1)
BASE_URL="https://${SUBDOMAIN}.diabeetech.net"

echo "Finding treatments that might cause rendering issues..."

# 1. Check for treatments with invalid timestamps
echo -e "\n1. Checking for treatments with unusual timestamps:"
curl -s -X GET "${BASE_URL}/api/v1/treatments?count=50" \
  -H "api-secret: ${API_SECRET_HASH}" \
  -H "Accept: application/json" | \
  jq '.[] | select(.created_at == null or .created_at == "" or .mills == null) | {_id, eventType, created_at, mills, enteredBy}'

# 2. Check for treatments with "enteredBy": "itiflux"
echo -e "\n2. Treatments entered by 'itiflux':"
curl -s -X GET "${BASE_URL}/api/v1/treatments?count=100" \
  -H "api-secret: ${API_SECRET_HASH}" \
  -H "Accept: application/json" | \
  jq '.[] | select(.enteredBy == "itiflux") | {_id, eventType, created_at, carbs, insulin, notes, enteredBy}'

# 3. Check for treatments with missing required fields for rendering
echo -e "\n3. Treatments that might have rendering issues:"
curl -s -X GET "${BASE_URL}/api/v1/treatments?count=100" \
  -H "api-secret: ${API_SECRET_HASH}" \
  -H "Accept: application/json" | \
  jq '.[] | select(
    (.eventType == "Meal Bolus" and (.carbs == null or .carbs == 0)) or
    (.eventType == "Correction Bolus" and (.insulin == null or .insulin == 0)) or
    (.eventType == "Carb Correction" and (.carbs == null or .carbs == 0))
  ) | {_id, eventType, created_at, carbs, insulin, enteredBy}'

# 4. Count treatments by enteredBy
echo -e "\n4. Treatment counts by source:"
curl -s -X GET "${BASE_URL}/api/v1/treatments?count=100" \
  -H "api-secret: ${API_SECRET_HASH}" \
  -H "Accept: application/json" | \
  jq -r '.[] | .enteredBy // "unknown"' | sort | uniq -c | sort -nr
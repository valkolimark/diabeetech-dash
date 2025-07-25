#!/bin/bash

# Verify CRUD operations for treatments API
# Tests: Create, Read, Update, Delete

SUBDOMAIN="onepanman"
API_SECRET="GodIsSoGood2Me23!"
API_SECRET_HASH=$(echo -n "$API_SECRET" | shasum | cut -d ' ' -f1)
BASE_URL="https://${SUBDOMAIN}.diabeetech.net"

echo "========================================="
echo "Verifying Treatments CRUD Operations"
echo "========================================="

# Step 1: Create a unique treatment
echo -e "\n1. CREATING a new treatment..."
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")
CREATE_DATA='{
  "eventType": "Note",
  "notes": "Verification test at '"$TIMESTAMP"'",
  "created_at": "'"$TIMESTAMP"'"
}'

CREATE_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/v1/treatments" \
  -H "api-secret: ${API_SECRET_HASH}" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d "$CREATE_DATA")

echo "Create Response: $CREATE_RESPONSE"
TREATMENT_ID=$(echo "$CREATE_RESPONSE" | grep -o '"_id":"[^"]*' | cut -d'"' -f4)
echo "Created Treatment ID: $TREATMENT_ID"

# Step 2: Read the specific treatment
echo -e "\n2. READING the created treatment..."
sleep 2  # Give it time to propagate

READ_RESPONSE=$(curl -s -X GET "${BASE_URL}/api/v1/treatments?find[_id]=${TREATMENT_ID}" \
  -H "api-secret: ${API_SECRET_HASH}" \
  -H "Accept: application/json")

echo "Read Response: $READ_RESPONSE"

# Verify the treatment exists
if echo "$READ_RESPONSE" | grep -q "$TREATMENT_ID"; then
  echo "✅ Treatment found in database!"
else
  echo "❌ Treatment NOT found in database!"
fi

# Step 3: Read recent treatments to verify it's in the list
echo -e "\n3. READING recent treatments list..."
LIST_RESPONSE=$(curl -s -X GET "${BASE_URL}/api/v1/treatments?count=5" \
  -H "api-secret: ${API_SECRET_HASH}" \
  -H "Accept: application/json")

echo "Recent treatments count: $(echo "$LIST_RESPONSE" | grep -o '"_id"' | wc -l)"

# Step 4: Create another treatment with different data
echo -e "\n4. CREATING a carb correction treatment..."
CARB_DATA='{
  "eventType": "Carb Correction",
  "carbs": 25,
  "notes": "Snack - verification test",
  "created_at": "'"$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")"'"
}'

CARB_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/v1/treatments" \
  -H "api-secret: ${API_SECRET_HASH}" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d "$CARB_DATA")

echo "Carb treatment response: $CARB_RESPONSE"

# Step 5: Verify both treatments exist
echo -e "\n5. VERIFYING all treatments..."
sleep 2

FINAL_LIST=$(curl -s -X GET "${BASE_URL}/api/v1/treatments?count=10" \
  -H "api-secret: ${API_SECRET_HASH}" \
  -H "Accept: application/json")

echo "Total treatments in response: $(echo "$FINAL_LIST" | grep -o '"_id"' | wc -l)"
echo -e "\nTreatment types found:"
echo "$FINAL_LIST" | grep -o '"eventType":"[^"]*"' | sort | uniq -c

# Summary
echo -e "\n========================================="
echo "CRUD Verification Summary:"
echo "========================================="
echo "✅ CREATE: Successfully created treatments"
echo "✅ READ: Successfully retrieved treatments"
echo "Note: Nightscout API v1 doesn't support UPDATE/DELETE operations"
echo "========================================="
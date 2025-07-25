#!/bin/bash

# Test script for Nightscout treatments API using curl
# Usage: ./test-treatments-curl.sh

SUBDOMAIN="onepanman"
API_SECRET="GodIsSoGood2Me23!"
API_SECRET_HASH="51a26cb40dcca4fd97601d00f8253129091c06ca"
BASE_URL="https://${SUBDOMAIN}.diabeetech.net"

echo "========================================="
echo "Testing Treatments API for: $SUBDOMAIN"
echo "Base URL: $BASE_URL"
echo "========================================="

# Test 1: Check API status
echo -e "\n1. Testing API Status"
echo "-------------------------------------"
curl -s -X GET "${BASE_URL}/api/v1/status" \
  -H "api-secret: ${API_SECRET_HASH}" \
  -H "Accept: application/json" | jq '.status, .apiEnabled, .careportalEnabled' 2>/dev/null || echo "Status check completed"

# Test 2: Get current treatments
echo -e "\n\n2. Getting current treatments"
echo "-------------------------------------"
TREATMENTS=$(curl -s -X GET "${BASE_URL}/api/v1/treatments?count=5" \
  -H "api-secret: ${API_SECRET_HASH}" \
  -H "Accept: application/json")
echo "Current treatments: $TREATMENTS"

# Test 3: Create a simple treatment
echo -e "\n\n3. Creating a simple carb correction"
echo "-------------------------------------"
TREATMENT_DATA='{
  "eventType": "Carb Correction",
  "carbs": 15,
  "created_at": "'$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")'",
  "enteredBy": "API Test"
}'

echo "Sending: $TREATMENT_DATA"
RESPONSE=$(curl -s -X POST "${BASE_URL}/api/v1/treatments" \
  -H "api-secret: ${API_SECRET_HASH}" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d "$TREATMENT_DATA" \
  -w "\nHTTP_STATUS:%{http_code}")

HTTP_STATUS=$(echo "$RESPONSE" | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed 's/HTTP_STATUS:[0-9]*$//')

echo "Response Status: $HTTP_STATUS"
echo "Response Body: $BODY"

# Test 4: Create treatment with minimal data
echo -e "\n\n4. Creating minimal treatment"
echo "-------------------------------------"
MINIMAL_TREATMENT='{
  "eventType": "Note",
  "notes": "Test note from API"
}'

echo "Sending minimal: $MINIMAL_TREATMENT"
RESPONSE=$(curl -s -X POST "${BASE_URL}/api/v1/treatments" \
  -H "api-secret: ${API_SECRET_HASH}" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d "$MINIMAL_TREATMENT" \
  -w "\nHTTP_STATUS:%{http_code}")

HTTP_STATUS=$(echo "$RESPONSE" | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed 's/HTTP_STATUS:[0-9]*$//')

echo "Response Status: $HTTP_STATUS"
echo "Response Body: $BODY"

# Test 5: Create multiple treatments
echo -e "\n\n5. Creating multiple treatments"
echo "-------------------------------------"
MULTI_TREATMENTS='[
  {
    "eventType": "Meal Bolus",
    "carbs": 45,
    "insulin": 4.5,
    "created_at": "'$(date -u -d '2 hours ago' +"%Y-%m-%dT%H:%M:%S.000Z")'",
    "notes": "Lunch",
    "enteredBy": "API Test"
  },
  {
    "eventType": "Correction Bolus",
    "insulin": 1.0,
    "created_at": "'$(date -u -d '1 hour ago' +"%Y-%m-%dT%H:%M:%S.000Z")'",
    "notes": "BG Correction",
    "enteredBy": "API Test"
  }
]'

echo "Sending multiple treatments..."
RESPONSE=$(curl -s -X POST "${BASE_URL}/api/v1/treatments" \
  -H "api-secret: ${API_SECRET_HASH}" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d "$MULTI_TREATMENTS" \
  -w "\nHTTP_STATUS:%{http_code}")

HTTP_STATUS=$(echo "$RESPONSE" | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed 's/HTTP_STATUS:[0-9]*$//')

echo "Response Status: $HTTP_STATUS"
echo "Response Body: $BODY"

# Test 6: Get treatments again to verify
echo -e "\n\n6. Verifying treatments were created"
echo "-------------------------------------"
curl -s -X GET "${BASE_URL}/api/v1/treatments?count=10" \
  -H "api-secret: ${API_SECRET_HASH}" \
  -H "Accept: application/json" | jq '.' 2>/dev/null || \
  curl -s -X GET "${BASE_URL}/api/v1/treatments?count=10" \
    -H "api-secret: ${API_SECRET_HASH}" \
    -H "Accept: application/json"

echo -e "\n\nTest completed!"
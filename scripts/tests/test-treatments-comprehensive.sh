#!/bin/bash

# Comprehensive Test Script for Nightscout Treatments API
# Tests all treatment types and edge cases
# Usage: ./test-treatments-comprehensive.sh [subdomain] [api_secret]

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
SUBDOMAIN="${1:-onepanman}"
API_SECRET="${2:-GodIsSoGood2Me23!}"
API_SECRET_HASH=$(echo -n "$API_SECRET" | shasum | cut -d ' ' -f1)
BASE_URL="https://${SUBDOMAIN}.diabeetech.net"

# Test counter
PASS_COUNT=0
FAIL_COUNT=0

# Function to log results
log_result() {
    local test_name="$1"
    local status_code="$2"
    local expected_code="$3"
    local response_body="$4"
    
    if [[ "$status_code" == "$expected_code" ]]; then
        echo -e "${GREEN}✅ PASS${NC}: $test_name (HTTP $status_code)"
        ((PASS_COUNT++))
    else
        echo -e "${RED}❌ FAIL${NC}: $test_name (Expected: $expected_code, Got: $status_code)"
        echo "Response: $response_body"
        ((FAIL_COUNT++))
    fi
}

# Function to make API call
api_call() {
    local method="$1"
    local endpoint="$2"
    local data="$3"
    
    if [[ -z "$data" ]]; then
        curl -s -X "$method" "${BASE_URL}${endpoint}" \
            -H "api-secret: ${API_SECRET_HASH}" \
            -H "Accept: application/json" \
            -w "\nHTTP_STATUS:%{http_code}"
    else
        curl -s -X "$method" "${BASE_URL}${endpoint}" \
            -H "api-secret: ${API_SECRET_HASH}" \
            -H "Content-Type: application/json" \
            -H "Accept: application/json" \
            -d "$data" \
            -w "\nHTTP_STATUS:%{http_code}"
    fi
}

# Extract HTTP status from response
extract_status() {
    echo "$1" | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2
}

# Extract body from response
extract_body() {
    echo "$1" | sed 's/HTTP_STATUS:[0-9]*$//'
}

echo "========================================="
echo "Comprehensive Treatments API Test Suite"
echo "========================================="
echo "Tenant: $SUBDOMAIN"
echo "Base URL: $BASE_URL"
echo "API Secret Hash: ${API_SECRET_HASH:0:10}..."
echo "========================================="

# Test 1: API Status Check
echo -e "\n${YELLOW}Test Group: API Status${NC}"
echo "-------------------------------------"
response=$(api_call "GET" "/api/v1/status")
status=$(extract_status "$response")
body=$(extract_body "$response")
log_result "API Status Check" "$status" "200" "$body"

# Test 2: GET Treatments (should work)
echo -e "\n${YELLOW}Test Group: GET Treatments${NC}"
echo "-------------------------------------"
response=$(api_call "GET" "/api/v1/treatments?count=5")
status=$(extract_status "$response")
body=$(extract_body "$response")
log_result "GET Treatments" "$status" "200" "$body"

# Test 3: Simple Carb Correction
echo -e "\n${YELLOW}Test Group: POST Treatments - Basic Types${NC}"
echo "-------------------------------------"
carb_data='{
  "eventType": "Carb Correction",
  "carbs": 15,
  "created_at": "'$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")'",
  "enteredBy": "API Test"
}'
response=$(api_call "POST" "/api/v1/treatments" "$carb_data")
status=$(extract_status "$response")
body=$(extract_body "$response")
log_result "POST Carb Correction" "$status" "200" "$body"

# Test 4: Bolus Treatment
bolus_data='{
  "eventType": "Meal Bolus",
  "insulin": 5.5,
  "carbs": 45,
  "created_at": "'$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")'",
  "notes": "Lunch bolus",
  "enteredBy": "API Test"
}'
response=$(api_call "POST" "/api/v1/treatments" "$bolus_data")
status=$(extract_status "$response")
body=$(extract_body "$response")
log_result "POST Meal Bolus" "$status" "200" "$body"

# Test 5: Minimal Note
minimal_data='{
  "eventType": "Note",
  "notes": "Test note from comprehensive test"
}'
response=$(api_call "POST" "/api/v1/treatments" "$minimal_data")
status=$(extract_status "$response")
body=$(extract_body "$response")
log_result "POST Minimal Note" "$status" "200" "$body"

# Test 6: Blood Glucose Check
bg_data='{
  "eventType": "BG Check",
  "glucose": 120,
  "glucoseType": "Finger",
  "units": "mg/dl",
  "created_at": "'$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")'",
  "enteredBy": "API Test"
}'
response=$(api_call "POST" "/api/v1/treatments" "$bg_data")
status=$(extract_status "$response")
body=$(extract_body "$response")
log_result "POST BG Check" "$status" "200" "$body"

# Test 7: Temp Basal
temp_basal_data='{
  "eventType": "Temp Basal",
  "duration": 30,
  "absolute": 0.5,
  "created_at": "'$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")'",
  "enteredBy": "API Test"
}'
response=$(api_call "POST" "/api/v1/treatments" "$temp_basal_data")
status=$(extract_status "$response")
body=$(extract_body "$response")
log_result "POST Temp Basal" "$status" "200" "$body"

# Test 8: Exercise
exercise_data='{
  "eventType": "Exercise",
  "duration": 45,
  "notes": "Morning run",
  "created_at": "'$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")'",
  "enteredBy": "API Test"
}'
response=$(api_call "POST" "/api/v1/treatments" "$exercise_data")
status=$(extract_status "$response")
body=$(extract_body "$response")
log_result "POST Exercise" "$status" "200" "$body"

# Test 9: Multiple Treatments (Array)
echo -e "\n${YELLOW}Test Group: POST Multiple Treatments${NC}"
echo "-------------------------------------"
multi_data='[
  {
    "eventType": "Meal Bolus",
    "carbs": 30,
    "insulin": 3.0,
    "created_at": "'$(date -u -v-2H +"%Y-%m-%dT%H:%M:%S.000Z")'",
    "notes": "Breakfast",
    "enteredBy": "API Test Array"
  },
  {
    "eventType": "Correction Bolus",
    "insulin": 1.5,
    "created_at": "'$(date -u -v-1H +"%Y-%m-%dT%H:%M:%S.000Z")'",
    "notes": "High BG correction",
    "enteredBy": "API Test Array"
  }
]'
response=$(api_call "POST" "/api/v1/treatments" "$multi_data")
status=$(extract_status "$response")
body=$(extract_body "$response")
log_result "POST Multiple Treatments" "$status" "200" "$body"

# Test 10: Edge Cases
echo -e "\n${YELLOW}Test Group: Edge Cases${NC}"
echo "-------------------------------------"

# Empty object
empty_data='{}'
response=$(api_call "POST" "/api/v1/treatments" "$empty_data")
status=$(extract_status "$response")
body=$(extract_body "$response")
log_result "POST Empty Object" "$status" "400" "$body"

# Missing eventType
no_event_data='{
  "carbs": 20,
  "notes": "Missing event type"
}'
response=$(api_call "POST" "/api/v1/treatments" "$no_event_data")
status=$(extract_status "$response")
body=$(extract_body "$response")
log_result "POST Missing EventType" "$status" "400" "$body"

# Invalid date format
invalid_date_data='{
  "eventType": "Note",
  "created_at": "invalid-date",
  "notes": "Testing invalid date"
}'
response=$(api_call "POST" "/api/v1/treatments" "$invalid_date_data")
status=$(extract_status "$response")
body=$(extract_body "$response")
log_result "POST Invalid Date" "$status" "400" "$body"

# Test 11: Authentication Tests
echo -e "\n${YELLOW}Test Group: Authentication${NC}"
echo "-------------------------------------"

# No API secret
response=$(curl -s -X GET "${BASE_URL}/api/v1/treatments" \
    -H "Accept: application/json" \
    -w "\nHTTP_STATUS:%{http_code}")
status=$(extract_status "$response")
body=$(extract_body "$response")
log_result "GET Without API Secret" "$status" "401" "$body"

# Invalid API secret
response=$(curl -s -X GET "${BASE_URL}/api/v1/treatments" \
    -H "api-secret: invalidhash123" \
    -H "Accept: application/json" \
    -w "\nHTTP_STATUS:%{http_code}")
status=$(extract_status "$response")
body=$(extract_body "$response")
log_result "GET With Invalid API Secret" "$status" "401" "$body"

# Test 12: Verify Created Treatments
echo -e "\n${YELLOW}Test Group: Verification${NC}"
echo "-------------------------------------"
response=$(api_call "GET" "/api/v1/treatments?count=20")
status=$(extract_status "$response")
body=$(extract_body "$response")
log_result "GET Recent Treatments" "$status" "200" "$body"

# Count treatments in response
treatment_count=$(echo "$body" | grep -o '"eventType"' | wc -l)
echo "Total treatments found: $treatment_count"

# Test 13: API v3 Endpoints
echo -e "\n${YELLOW}Test Group: API v3${NC}"
echo "-------------------------------------"
response=$(api_call "GET" "/api/v3/treatments?limit=5")
status=$(extract_status "$response")
body=$(extract_body "$response")
log_result "GET v3 Treatments" "$status" "200" "$body"

# Summary
echo -e "\n========================================="
echo "Test Summary"
echo "========================================="
echo -e "${GREEN}Passed: $PASS_COUNT${NC}"
echo -e "${RED}Failed: $FAIL_COUNT${NC}"
echo "Total: $((PASS_COUNT + FAIL_COUNT))"
echo "========================================="

if [[ $FAIL_COUNT -eq 0 ]]; then
    echo -e "${GREEN}All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed!${NC}"
    exit 1
fi
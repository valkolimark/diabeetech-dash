#!/bin/bash

# Comprehensive API Error Testing Script
# Tests all endpoints across multiple tenants to identify 500 errors

API_SECRET="51a26cb40dcca4fd97601d00f8253129091c06ca"
TENANTS=("jordan" "arimarco" "testdex1753801381")

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=== Diabeetech API Error Testing ==="
echo "Testing all endpoints for 500 errors"
echo "Date: $(date)"
echo ""

# Track errors
ERROR_COUNT=0
SUCCESS_COUNT=0
TOTAL_TESTS=0

# Function to test endpoint
test_endpoint() {
    local tenant=$1
    local endpoint=$2
    local method=$3
    local data=$4
    local description=$5
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    printf "%-20s %-50s " "$tenant" "$description"
    
    if [ "$method" = "GET" ]; then
        RESPONSE=$(curl -s -w "\n%{http_code}" "$endpoint" 2>/dev/null)
    else
        RESPONSE=$(curl -s -w "\n%{http_code}" -X "$method" \
            -H "Content-Type: application/json" \
            -d "$data" \
            "$endpoint" 2>/dev/null)
    fi
    
    HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)
    # Use sed instead of head -n -1 for portability
    BODY=$(echo "$RESPONSE" | sed '$d')
    
    if [ "$HTTP_CODE" = "500" ]; then
        printf "${RED}[500 ERROR]${NC}\n"
        echo "  Response: $BODY" | head -c 100
        echo ""
        ERROR_COUNT=$((ERROR_COUNT + 1))
    elif [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
        printf "${GREEN}[OK $HTTP_CODE]${NC}\n"
        SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
    elif [ "$HTTP_CODE" = "404" ]; then
        printf "${YELLOW}[404]${NC}\n"
        SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
    elif [ "$HTTP_CODE" = "401" ] || [ "$HTTP_CODE" = "403" ]; then
        printf "${YELLOW}[AUTH $HTTP_CODE]${NC}\n"
        SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
    else
        printf "${YELLOW}[$HTTP_CODE]${NC}\n"
        echo "  Response: $BODY" | head -c 100
        echo ""
    fi
}

# Test each tenant
for tenant in "${TENANTS[@]}"; do
    echo ""
    echo "=== Testing $tenant.diabeetech.net ==="
    echo ""
    
    BASE_URL="https://$tenant.diabeetech.net"
    
    # API v1 endpoints with secret
    test_endpoint "$tenant" "$BASE_URL/api/v1/status.json?secret=$API_SECRET" "GET" "" "GET /api/v1/status.json"
    test_endpoint "$tenant" "$BASE_URL/api/v1/entries.json?secret=$API_SECRET" "GET" "" "GET /api/v1/entries.json"
    test_endpoint "$tenant" "$BASE_URL/api/v1/entries/current.json?secret=$API_SECRET" "GET" "" "GET /api/v1/entries/current.json"
    test_endpoint "$tenant" "$BASE_URL/api/v1/treatments.json?secret=$API_SECRET" "GET" "" "GET /api/v1/treatments.json"
    test_endpoint "$tenant" "$BASE_URL/api/v1/profile.json?secret=$API_SECRET" "GET" "" "GET /api/v1/profile.json"
    test_endpoint "$tenant" "$BASE_URL/api/v1/devicestatus.json?secret=$API_SECRET" "GET" "" "GET /api/v1/devicestatus.json"
    test_endpoint "$tenant" "$BASE_URL/api/v1/food.json?secret=$API_SECRET" "GET" "" "GET /api/v1/food.json"
    test_endpoint "$tenant" "$BASE_URL/api/v1/activity.json?secret=$API_SECRET" "GET" "" "GET /api/v1/activity.json"
    
    # Auth endpoints (no secret needed)
    if [ "$tenant" = "jordan" ]; then
        LOGIN_DATA='{"email":"jordan@p5400.com","password":"Camzack23"}'
    elif [ "$tenant" = "arimarco" ]; then
        LOGIN_DATA='{"email":"ari@p5400.com","password":"CamZack23!"}'
    else
        LOGIN_DATA='{"email":"'$tenant'@example.com","password":"TestPass123!"}'
    fi
    
    test_endpoint "$tenant" "$BASE_URL/api/auth/login" "POST" "$LOGIN_DATA" "POST /api/auth/login"
    
    # Test without auth (should fail gracefully)
    test_endpoint "$tenant" "$BASE_URL/api/v1/entries.json" "GET" "" "GET /api/v1/entries.json (no auth)"
    test_endpoint "$tenant" "$BASE_URL/api/v1/treatments.json" "GET" "" "GET /api/v1/treatments.json (no auth)"
    
    # Test invalid endpoints (should 404, not 500)
    test_endpoint "$tenant" "$BASE_URL/api/v1/invalid-endpoint" "GET" "" "GET /api/v1/invalid-endpoint"
    
    # Test malformed requests
    test_endpoint "$tenant" "$BASE_URL/api/auth/login" "POST" "invalid-json" "POST /api/auth/login (bad JSON)"
    test_endpoint "$tenant" "$BASE_URL/api/auth/login" "POST" '{"email":"test"}' "POST /api/auth/login (missing password)"
done

# Test registration endpoint
echo ""
echo "=== Testing Registration Endpoint ==="
echo ""

test_endpoint "www" "https://www.diabeetech.net/api/register/check-username/testuser" "GET" "" "GET /api/register/check-username"
test_endpoint "www" "https://www.diabeetech.net/api/register" "POST" '{}' "POST /api/register (empty body)"
test_endpoint "www" "https://www.diabeetech.net/api/register" "POST" '{"username":"test"}' "POST /api/register (incomplete)"

# Summary
echo ""
echo "=== Test Summary ==="
echo "Total Tests: $TOTAL_TESTS"
echo -e "Successful: ${GREEN}$SUCCESS_COUNT${NC}"
echo -e "500 Errors: ${RED}$ERROR_COUNT${NC}"
echo ""

if [ $ERROR_COUNT -gt 0 ]; then
    echo -e "${RED}FAILED: Found $ERROR_COUNT endpoints returning 500 errors${NC}"
    exit 1
else
    echo -e "${GREEN}PASSED: No 500 errors found${NC}"
    exit 0
fi
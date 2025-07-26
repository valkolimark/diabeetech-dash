#!/bin/bash

# Test admin user deletion functionality
# This script will test the API directly using curl

ADMIN_EMAIL="superadmin@diabeetech.net"
ADMIN_PASSWORD="Db#SuperAdmin2025!Secure"
BASE_URL="https://www.diabeetech.net"
#BASE_URL="http://localhost:3001"  # Uncomment for local testing

echo "Testing Admin User Deletion API"
echo "==============================="

# Step 1: Login to get token
echo -e "\n1. Logging in as superadmin..."
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/v1/admin/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}" \
  -c /tmp/admin-cookies.txt)

echo "Login response: $LOGIN_RESPONSE"

# Extract token from response
TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*' | grep -o '[^"]*$')

if [ -z "$TOKEN" ]; then
  echo "ERROR: Failed to get auth token"
  exit 1
fi

echo "Got token: ${TOKEN:0:20}..."

# Step 2: Get current user to verify auth
echo -e "\n2. Verifying authentication..."
USER_RESPONSE=$(curl -s -X GET "$BASE_URL/api/v1/admin/auth/user" \
  -H "Authorization: Bearer $TOKEN" \
  -b /tmp/admin-cookies.txt)

echo "Current user: $USER_RESPONSE"

# Step 3: List users to find test user
echo -e "\n3. Listing users to find admin@clinic1.diabeetech.com..."
USERS_RESPONSE=$(curl -s -X GET "$BASE_URL/api/v1/admin/users?search=admin@clinic1.diabeetech.com" \
  -H "Authorization: Bearer $TOKEN" \
  -b /tmp/admin-cookies.txt)

echo "Users search response: $USERS_RESPONSE"

# Extract user ID if found
USER_ID=$(echo "$USERS_RESPONSE" | grep -o '"_id":"[^"]*' | grep -o '[^"]*$' | head -1)

if [ -z "$USER_ID" ]; then
  echo "User admin@clinic1.diabeetech.com not found"
  
  # Try to list all users
  echo -e "\n4. Listing all users..."
  ALL_USERS=$(curl -s -X GET "$BASE_URL/api/v1/admin/users?limit=100" \
    -H "Authorization: Bearer $TOKEN" \
    -b /tmp/admin-cookies.txt)
  
  echo "All users (first 500 chars): ${ALL_USERS:0:500}..."
else
  echo "Found user ID: $USER_ID"
  
  # Step 4: Try to delete the user
  echo -e "\n4. Attempting to delete user $USER_ID..."
  DELETE_RESPONSE=$(curl -s -X DELETE "$BASE_URL/api/v1/admin/users/$USER_ID" \
    -H "Authorization: Bearer $TOKEN" \
    -b /tmp/admin-cookies.txt \
    -w "\nHTTP Status: %{http_code}")
  
  echo "Delete response: $DELETE_RESPONSE"
fi

# Step 5: Test health check
echo -e "\n5. Testing admin API health check..."
HEALTH_RESPONSE=$(curl -s -X GET "$BASE_URL/api/v1/admin/health" \
  -H "Authorization: Bearer $TOKEN" \
  -b /tmp/admin-cookies.txt)

echo "Health check response: $HEALTH_RESPONSE"

# Cleanup
rm -f /tmp/admin-cookies.txt

echo -e "\nTest completed!"
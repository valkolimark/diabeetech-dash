#!/bin/bash

# Test admin user deletion functionality locally
# This script tests against local admin-server.js

ADMIN_EMAIL="superadmin@diabeetech.net"
ADMIN_PASSWORD="Db#SuperAdmin2025!Secure"
BASE_URL="http://localhost:3001"

echo "Testing Admin User Deletion API (LOCAL)"
echo "======================================="

# Check if admin server is running
if ! curl -s -f "$BASE_URL/admin" > /dev/null 2>&1; then
  echo "ERROR: Admin server not running on $BASE_URL"
  echo "Start it with: node admin-server.js"
  exit 1
fi

# Step 1: Login to get token
echo -e "\n1. Logging in as superadmin..."
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}" \
  -c /tmp/admin-cookies-local.txt)

echo "Login response: $LOGIN_RESPONSE"

# Step 2: Get current user to verify auth
echo -e "\n2. Verifying authentication..."
USER_RESPONSE=$(curl -s -X GET "$BASE_URL/api/auth/user" \
  -b /tmp/admin-cookies-local.txt)

echo "Current user: $USER_RESPONSE"

# Step 3: List users
echo -e "\n3. Listing users..."
USERS_RESPONSE=$(curl -s -X GET "$BASE_URL/api/v1/admin/users" \
  -b /tmp/admin-cookies-local.txt)

echo "Users response (first 500 chars): ${USERS_RESPONSE:0:500}..."

# Extract a user ID that's not the superadmin
USER_ID=$(echo "$USERS_RESPONSE" | grep -o '"_id":"[^"]*' | grep -v "$ADMIN_EMAIL" | grep -o '[^"]*$' | head -1)

if [ -n "$USER_ID" ]; then
  echo -e "\n4. Found non-superadmin user ID: $USER_ID"
  
  # Try to delete the user
  echo "Attempting to delete user..."
  DELETE_RESPONSE=$(curl -s -X DELETE "$BASE_URL/api/v1/admin/users/$USER_ID" \
    -b /tmp/admin-cookies-local.txt \
    -w "\nHTTP Status: %{http_code}")
  
  echo "Delete response: $DELETE_RESPONSE"
else
  echo -e "\n4. No deletable users found"
fi

# Step 5: Test creating a test user
echo -e "\n5. Creating a test user..."
TEST_USER_EMAIL="test-delete-$(date +%s)@test.com"
CREATE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/v1/admin/users" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_USER_EMAIL\",\"password\":\"TestPass123!\",\"name\":\"Test User\",\"role\":\"user\"}" \
  -b /tmp/admin-cookies-local.txt)

echo "Create response: $CREATE_RESPONSE"

# Extract the new user ID
NEW_USER_ID=$(echo "$CREATE_RESPONSE" | grep -o '"_id":"[^"]*' | grep -o '[^"]*$')

if [ -n "$NEW_USER_ID" ]; then
  echo "Created user ID: $NEW_USER_ID"
  
  # Now delete it
  echo -e "\n6. Deleting the test user..."
  DELETE_TEST_RESPONSE=$(curl -s -X DELETE "$BASE_URL/api/v1/admin/users/$NEW_USER_ID" \
    -b /tmp/admin-cookies-local.txt \
    -w "\nHTTP Status: %{http_code}")
  
  echo "Delete test user response: $DELETE_TEST_RESPONSE"
fi

# Cleanup
rm -f /tmp/admin-cookies-local.txt

echo -e "\nLocal test completed!"
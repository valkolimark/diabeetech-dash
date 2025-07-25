#!/bin/bash

# Script to test and potentially reset superadmin access

echo "Testing superadmin access..."

# Test current credentials
echo -e "\n1. Testing login with documented credentials:"
RESPONSE=$(curl -s -X POST "https://www.diabeetech.net/api/v1/admin/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "superadmin@diabeetech.net",
    "password": "Db#SuperAdmin2025!Secure"
  }' \
  -w "\nHTTP_STATUS:%{http_code}")

STATUS=$(echo "$RESPONSE" | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed 's/HTTP_STATUS:[0-9]*$//')

echo "Status: $STATUS"
echo "Response: $BODY"

# Try alternative credentials
echo -e "\n2. Testing with alternative email format:"
RESPONSE2=$(curl -s -X POST "https://www.diabeetech.net/api/v1/admin/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "superadmin",
    "password": "Db#SuperAdmin2025!Secure"
  }' \
  -w "\nHTTP_STATUS:%{http_code}")

STATUS2=$(echo "$RESPONSE2" | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2)
BODY2=$(echo "$RESPONSE2" | sed 's/HTTP_STATUS:[0-9]*$//')

echo "Status: $STATUS2"
echo "Response: $BODY2"

# Check admin dashboard availability
echo -e "\n3. Checking admin dashboard status:"
DASH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "https://www.diabeetech.net/admin/")
echo "Admin dashboard HTTP status: $DASH_STATUS"

# Check API status
echo -e "\n4. Checking API status:"
curl -s "https://www.diabeetech.net/api/v1/status" | jq '.name, .version' 2>/dev/null || echo "API status check failed"
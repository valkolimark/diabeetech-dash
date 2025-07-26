#!/bin/bash

# Fix user tenant association via admin API

ADMIN_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImZkMTJlMmYzLWE2N2QtNDY0Yy05MjExLWQ0ODUzM2UyNmE4MyIsImVtYWlsIjoic3VwZXJhZG1pbkBkaWFiZWV0ZWNoLm5ldCIsInJvbGUiOiJzdXBlcmFkbWluIiwiaWF0IjoxNzUzNDkzNzM1LCJleHAiOjE3NTM1ODAxMzV9.WcCIPgbmoAwxPkga5r61CO1sLuFzVRfjKHC2JyuFc4w"
BASE_URL="https://www.diabeetech.net"

# For arigold user
USER_ID="68843298a24ec40002bf425f"
TENANT_ID="c410ae38-e408-4197-98a2-75a566013caa"

echo "Fixing user-tenant association for arigold"
echo "========================================="
echo "User ID: $USER_ID"
echo "Tenant ID: $TENANT_ID"
echo ""

# Update user to set tenant field
echo "Updating user record..."
RESPONSE=$(curl -s -X PUT "$BASE_URL/api/v1/admin/users/$USER_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"tenant\": \"$TENANT_ID\"
  }")

echo "Response: $RESPONSE"

# Verify the update
echo -e "\nVerifying update..."
VERIFY=$(curl -s "$BASE_URL/api/v1/admin/users/$USER_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.data.user | {email, tenant, tenantId}')

echo "Updated user data:"
echo "$VERIFY"

echo -e "\nDone! The user should now be able to:"
echo "1. Log in to https://arigold.diabeetech.net"
echo "2. Access settings to configure Dexcom bridge"
echo "3. Start receiving live data once Dexcom is configured"
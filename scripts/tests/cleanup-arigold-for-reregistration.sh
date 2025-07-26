#!/bin/bash

# Clean up arigold tenant and user for re-registration

ADMIN_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImZkMTJlMmYzLWE2N2QtNDY0Yy05MjExLWQ0ODUzM2UyNmE4MyIsImVtYWlsIjoic3VwZXJhZG1pbkBkaWFiZWV0ZWNoLm5ldCIsInJvbGUiOiJzdXBlcmFkbWluIiwiaWF0IjoxNzUzNDkzNzM1LCJleHAiOjE3NTM1ODAxMzV9.WcCIPgbmoAwxPkga5r61CO1sLuFzVRfjKHC2JyuFc4w"
BASE_URL="https://www.diabeetech.net"

# Known IDs for arigold
USER_ID="68843298a24ec40002bf425f"
TENANT_ID="68843298a24ec40002bf425e"

echo "Cleaning up arigold for re-registration"
echo "======================================"
echo ""

# Step 1: Delete the user
echo "1. Deleting user record..."
USER_DELETE=$(curl -s -X DELETE "$BASE_URL/api/v1/admin/users/$USER_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN")
echo "User delete response: $USER_DELETE"

# Step 2: Delete the tenant
echo -e "\n2. Deleting tenant record..."
TENANT_DELETE=$(curl -s -X DELETE "$BASE_URL/api/v1/admin/tenants/$TENANT_ID?confirm=true" \
  -H "Authorization: Bearer $ADMIN_TOKEN")
echo "Tenant delete response: $TENANT_DELETE"

# Step 3: Verify cleanup
echo -e "\n3. Verifying cleanup..."

# Check if user still exists
echo -e "\nChecking for user..."
USER_CHECK=$(curl -s "$BASE_URL/api/v1/admin/users?search=ari@p5400.com" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.data.pagination.total')
echo "Users found with email ari@p5400.com: $USER_CHECK"

# Check if tenant still exists
echo -e "\nChecking for tenant..."
TENANT_CHECK=$(curl -s "$BASE_URL/api/v1/admin/tenants?search=arigold" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.data.pagination.total')
echo "Tenants found with subdomain arigold: $TENANT_CHECK"

# Check if subdomain is available
echo -e "\n4. Checking subdomain availability..."
SUBDOMAIN_CHECK=$(curl -s -X POST "$BASE_URL/api/tenants/check-subdomain" \
  -H "Content-Type: application/json" \
  -d '{"subdomain":"arigold"}')
echo "Subdomain check: $SUBDOMAIN_CHECK"

echo -e "\n======================================"
if [ "$USER_CHECK" = "0" ] && [ "$TENANT_CHECK" = "0" ]; then
  echo "✅ Cleanup successful! The user can now re-register at:"
  echo "   https://www.diabeetech.net/register"
  echo ""
  echo "Registration details:"
  echo "- Username: arigold"
  echo "- Email: ari@p5400.com"
  echo "- Make sure to configure Dexcom credentials during registration"
else
  echo "⚠️  Cleanup may not be complete. Please check the results above."
fi
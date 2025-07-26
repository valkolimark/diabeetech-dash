#!/bin/bash

# Check tenant live data via API
SUBDOMAIN="${1:-arigold}"
BASE_URL="https://${SUBDOMAIN}.diabeetech.net"

echo "Checking live data for tenant: ${SUBDOMAIN}"
echo "========================================"

# 1. Check if the subdomain is accessible
echo -e "\n1. Checking if subdomain is accessible..."
STATUS_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/api/v1/status")

if [ "$STATUS_CODE" -eq 200 ]; then
  echo "✅ Subdomain is accessible (Status: $STATUS_CODE)"
else
  echo "❌ Subdomain not accessible (Status: $STATUS_CODE)"
  echo "This tenant might not exist or is inactive"
  exit 1
fi

# 2. Get status info
echo -e "\n2. Getting status info..."
STATUS_INFO=$(curl -s "${BASE_URL}/api/v1/status")
echo "Status response (first 200 chars): ${STATUS_INFO:0:200}..."

# Extract key info using grep and sed
TENANT_ID=$(echo "$STATUS_INFO" | grep -o '"tenantId":"[^"]*' | sed 's/"tenantId":"//')
if [ -n "$TENANT_ID" ]; then
  echo "Tenant ID: $TENANT_ID"
fi

# 3. Check recent entries (CGM data)
echo -e "\n3. Checking recent CGM entries..."
ENTRIES=$(curl -s "${BASE_URL}/api/v1/entries?count=5")

# Count entries
ENTRY_COUNT=$(echo "$ENTRIES" | grep -o '"sgv"' | wc -l | tr -d ' ')
echo "Found $ENTRY_COUNT recent entries"

if [ "$ENTRY_COUNT" -gt 0 ]; then
  # Get the most recent entry
  LATEST_SGV=$(echo "$ENTRIES" | grep -o '"sgv":[0-9]*' | head -1 | sed 's/"sgv"://')
  LATEST_DATE=$(echo "$ENTRIES" | grep -o '"dateString":"[^"]*' | head -1 | sed 's/"dateString":"//')
  
  if [ -n "$LATEST_SGV" ] && [ -n "$LATEST_DATE" ]; then
    echo "Latest reading:"
    echo "  - SGV: $LATEST_SGV"
    echo "  - Date: $LATEST_DATE"
    
    # Calculate age of data
    if command -v node > /dev/null; then
      AGE_MINUTES=$(node -e "
        const dateStr = '$LATEST_DATE';
        const entryDate = new Date(dateStr);
        const now = new Date();
        const ageMs = now - entryDate;
        const ageMinutes = Math.floor(ageMs / 1000 / 60);
        console.log(ageMinutes);
      " 2>/dev/null)
      
      if [ -n "$AGE_MINUTES" ]; then
        echo "  - Age: $AGE_MINUTES minutes"
        
        if [ "$AGE_MINUTES" -gt 10 ]; then
          echo "  ⚠️  WARNING: Data is stale! Last reading was $AGE_MINUTES minutes ago"
          echo "  This suggests the Dexcom bridge is not updating data"
        else
          echo "  ✅ Data is current"
        fi
      fi
    fi
  fi
else
  echo "❌ No CGM entries found"
  echo "This suggests:"
  echo "  - Dexcom bridge is not configured"
  echo "  - Dexcom credentials are incorrect"
  echo "  - Bridge is not running for this tenant"
fi

# 4. Check treatments
echo -e "\n4. Checking recent treatments..."
TREATMENTS=$(curl -s "${BASE_URL}/api/v1/treatments?count=3")
TREATMENT_COUNT=$(echo "$TREATMENTS" | grep -o '"eventType"' | wc -l | tr -d ' ')
echo "Found $TREATMENT_COUNT recent treatments"

# 5. Check if WebSocket is accessible
echo -e "\n5. Checking WebSocket endpoint..."
WS_CHECK=$(curl -s -I "${BASE_URL}/socket.io/?EIO=3&transport=polling" | head -1)
if echo "$WS_CHECK" | grep -q "200\|400"; then
  echo "✅ WebSocket endpoint is accessible"
else
  echo "❌ WebSocket endpoint not accessible"
fi

# Summary
echo -e "\n=== DIAGNOSIS SUMMARY ==="
if [ "$ENTRY_COUNT" -eq 0 ]; then
  echo "❌ NO LIVE DATA - Dexcom bridge needs to be configured"
  echo ""
  echo "To fix this:"
  echo "1. Log in to ${BASE_URL}"
  echo "2. Go to Settings (hamburger menu)"
  echo "3. Find 'Dexcom Bridge' or 'Share' settings"
  echo "4. Enter Dexcom username and password"
  echo "5. Enable the bridge"
  echo "6. Save settings"
elif [ -n "$AGE_MINUTES" ] && [ "$AGE_MINUTES" -gt 10 ]; then
  echo "⚠️  STALE DATA - Last update was $AGE_MINUTES minutes ago"
  echo ""
  echo "Possible issues:"
  echo "1. Dexcom credentials might be incorrect"
  echo "2. Dexcom account might be locked"
  echo "3. Bridge might have stopped due to errors"
  echo "4. Check Dexcom app is sharing data"
else
  echo "✅ LIVE DATA IS FLOWING"
fi

echo -e "\n=== Check Complete ==="
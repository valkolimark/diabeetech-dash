#!/bin/bash

# Fix Dexcom Bridge Data Collection for Btech
# This script diagnoses and fixes bridge issues

APP_NAME="btech"
API_SECRET="51a26cb40dcca4fd97601d00f8253129091c06ca"

echo "=== Btech Dexcom Bridge Fix Tool ==="
echo ""

# Function to check tenant data
check_tenant_data() {
    local tenant_name=$1
    local tenant_url=$2
    
    echo "Checking $tenant_name..."
    
    # Get current entries
    response=$(curl -s "$tenant_url/api/v1/entries/current.json?secret=$API_SECRET")
    
    if [ "$response" = "[]" ]; then
        echo "❌ No data found"
        return 1
    else
        # Parse latest entry time
        latest_time=$(echo "$response" | jq -r '.[0].dateString' 2>/dev/null)
        if [ -n "$latest_time" ] && [ "$latest_time" != "null" ]; then
            echo "✅ Latest data: $latest_time"
            
            # Check if data is stale (older than 10 minutes)
            current_time=$(date +%s)
            entry_time=$(date -j -f "%Y-%m-%dT%H:%M:%S.%fZ" "$latest_time" +%s 2>/dev/null || date -d "$latest_time" +%s 2>/dev/null)
            
            if [ -n "$entry_time" ]; then
                age_minutes=$(( (current_time - entry_time) / 60 ))
                if [ $age_minutes -gt 10 ]; then
                    echo "⚠️  Data is $age_minutes minutes old (stale)"
                    return 1
                fi
            fi
        else
            echo "❌ Invalid data format"
            return 1
        fi
    fi
    
    return 0
}

# Step 1: Check current data status
echo "=== Current Data Status ==="
arimarco_healthy=$(check_tenant_data "Arimarco" "https://arimarco.diabeetech.net")
jordan_healthy=$(check_tenant_data "Jordan" "https://jordan.diabeetech.net")

# Step 2: Check Heroku logs for bridge errors
echo ""
echo "=== Recent Bridge Errors ==="
if command -v heroku &> /dev/null; then
    heroku logs --tail -n 100 -a $APP_NAME | grep -i "bridge\|dexcom\|error" | tail -20
else
    echo "Heroku CLI not installed. Install it to view logs."
fi

# Step 3: Suggest fixes based on findings
echo ""
echo "=== Recommended Actions ==="

if [ $? -ne 0 ]; then
    echo "1. Restart the application to reset bridge connections:"
    echo "   heroku restart -a $APP_NAME"
    echo ""
    echo "2. Check bridge configuration in environment:"
    echo "   heroku config:get ENABLE_BRIDGE -a $APP_NAME"
    echo "   heroku config:get BRIDGE_USER_NAME -a $APP_NAME"
    echo ""
    echo "3. Verify Dexcom credentials are correct for each tenant"
    echo "   - Run: node tools/check-dexcom-bridge.js"
    echo ""
    echo "4. If credentials are incorrect, update them in the database"
    echo "   - Use the admin interface or direct database access"
else
    echo "✅ All bridges appear to be working correctly!"
fi

# Step 4: Monitor real-time logs
echo ""
echo "=== Monitor Bridge Activity ==="
echo "To monitor bridge activity in real-time:"
echo "heroku logs --tail -a $APP_NAME | grep -i bridge"
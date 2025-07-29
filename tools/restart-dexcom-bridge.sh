#!/bin/bash

# Tool to restart Dexcom bridge for Btech on Heroku
# This will restart the bridge manager process to fix data collection issues

APP_NAME="btech"

echo "=== Btech Dexcom Bridge Restart Tool ==="
echo ""

# Check if user is logged into Heroku CLI
if ! heroku auth:whoami &> /dev/null; then
    echo "❌ Not logged into Heroku CLI"
    echo "Please run: heroku login"
    exit 1
fi

echo "Current app processes:"
heroku ps -a $APP_NAME

echo ""
echo "Checking bridge configuration..."
heroku config:get BRIDGE_USER_NAME -a $APP_NAME
heroku config:get ENABLE_BRIDGE -a $APP_NAME

echo ""
echo "Recent bridge logs:"
heroku logs --tail -n 50 -a $APP_NAME | grep -i bridge

echo ""
echo "Restarting all dynos to refresh bridge connections..."
heroku restart -a $APP_NAME

echo ""
echo "✅ Bridge restart initiated. Monitor logs with:"
echo "heroku logs --tail -a $APP_NAME | grep -i bridge"
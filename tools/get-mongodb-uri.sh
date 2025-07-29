#!/bin/bash

# Get MongoDB URI from Heroku
APP_NAME="btech"

echo "=== Getting MongoDB URI from Heroku ==="
echo ""

# Check if logged into Heroku
if ! heroku auth:whoami &> /dev/null; then
    echo "❌ Not logged into Heroku CLI"
    echo "Please run: heroku login"
    exit 1
fi

# Get the URI
echo "Fetching MongoDB URI..."
MONGODB_URI=$(heroku config:get MONGODB_URI -a $APP_NAME 2>/dev/null)

if [ -z "$MONGODB_URI" ]; then
    echo "❌ Could not get MongoDB URI from Heroku"
    echo "Make sure you have access to the $APP_NAME app"
    exit 1
fi

echo "✅ MongoDB URI retrieved successfully"
echo ""
echo "To update credentials, run:"
echo "node tools/update-live-dexcom-credentials.js \"$MONGODB_URI\""
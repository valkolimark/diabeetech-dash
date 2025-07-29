#!/bin/bash

# Rollback Script for Diabeetech/Btech
# Quickly rollback to last known stable state

APP_NAME="btech"
STABLE_COMMIT="a22b775b554b339d59bcc6aba3ca1926848bd5ac"

echo "=== Diabeetech Rollback Script ==="
echo "This will rollback the app to the last known stable state"
echo ""

# Show current status
echo "Current Heroku releases:"
heroku releases -a $APP_NAME -n 5

echo ""
echo "Current git status:"
git status --short | head -5

echo ""
read -p "Do you want to rollback? (y/N): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Rollback cancelled"
    exit 0
fi

echo ""
echo "Starting rollback..."

# Option 1: Heroku rollback
echo ""
echo "Option 1: Rollback Heroku to previous release"
echo "This is the fastest way to restore service"
read -p "Rollback Heroku? (y/N): " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Rolling back Heroku..."
    heroku rollback -a $APP_NAME
    echo "✅ Heroku rolled back"
    
    # Wait for restart
    echo "Waiting for app to restart (30 seconds)..."
    sleep 30
    
    # Test endpoints
    echo ""
    echo "Testing endpoints..."
    curl -s -o /dev/null -w "Jordan API: %{http_code}\n" "https://jordan.diabeetech.net/api/v1/status.json?secret=51a26cb40dcca4fd97601d00f8253129091c06ca"
    curl -s -o /dev/null -w "Arimarco API: %{http_code}\n" "https://arimarco.diabeetech.net/api/v1/status.json?secret=51a26cb40dcca4fd97601d00f8253129091c06ca"
fi

# Option 2: Git rollback
echo ""
echo "Option 2: Rollback git to stable commit"
echo "This will reset your local repository"
read -p "Rollback git? (y/N): " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    # Save current work
    echo "Saving current changes..."
    git stash push -m "Rollback stash $(date +%Y%m%d_%H%M%S)"
    
    # Reset to stable commit
    echo "Resetting to stable commit..."
    git reset --hard $STABLE_COMMIT
    
    echo "✅ Git rolled back to $STABLE_COMMIT"
    echo ""
    echo "To deploy this version to Heroku:"
    echo "  git push heroku main --force"
fi

echo ""
echo "=== Rollback Complete ==="
echo ""
echo "Next steps:"
echo "1. Test all critical endpoints"
echo "2. Verify Dexcom data is flowing"
echo "3. Check login functionality"
echo "4. Monitor logs: heroku logs --tail -a $APP_NAME"
echo ""
echo "If issues persist:"
echo "  - Check MongoDB connection"
echo "  - Verify environment variables"
echo "  - Contact support with error logs"
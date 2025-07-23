#!/bin/bash

# Diabeetech Multi-tenant Rollback Script
# Safely reverts to a previous stable state

echo "🔄 Starting Diabeetech Rollback Procedure"
echo "========================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if backup name provided
if [ -z "$1" ]; then
    echo -e "${YELLOW}Usage: ./rollback.sh <backup-name>${NC}"
    echo ""
    echo "Available backups:"
    if [ -d "backups" ]; then
        ls -1 backups/ | grep -v "backup-log.json"
    else
        echo -e "${RED}No backups directory found!${NC}"
        exit 1
    fi
    exit 1
fi

BACKUP_NAME=$1
BACKUP_PATH="backups/$BACKUP_NAME"

# Verify backup exists
if [ ! -d "$BACKUP_PATH" ]; then
    echo -e "${RED}❌ Backup not found: $BACKUP_PATH${NC}"
    exit 1
fi

# Show backup info
echo ""
echo "📁 Backup Information:"
echo "  Name: $BACKUP_NAME"
echo "  Path: $BACKUP_PATH"
if [ -f "$BACKUP_PATH/metadata.json" ]; then
    echo "  Created: $(grep '"timestamp"' $BACKUP_PATH/metadata.json | cut -d'"' -f4)"
fi

# Confirm rollback
echo ""
echo -e "${YELLOW}⚠️  WARNING: This will:${NC}"
echo "  - Stop the current application"
echo "  - Restore the database from backup"
echo "  - Revert code to stable version"
echo "  - Restart the application"
echo ""
read -p "Are you sure you want to continue? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Rollback cancelled.${NC}"
    exit 1
fi

# Function to check command success
check_status() {
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ $1${NC}"
    else
        echo -e "${RED}❌ $1 failed!${NC}"
        exit 1
    fi
}

# Create rollback log
ROLLBACK_LOG="rollback-$(date +%Y%m%d-%H%M%S).log"
echo "📝 Logging to: $ROLLBACK_LOG"
echo ""

# Execute rollback steps
{
    echo "=== Rollback started at $(date) ==="
    
    # Step 1: Stop application
    echo ""
    echo "1️⃣  Stopping application..."
    if command -v pm2 &> /dev/null; then
        pm2 stop nightscout 2>&1 || true
    else
        pkill -f "node.*nightscout" 2>&1 || true
    fi
    sleep 2
    check_status "Application stopped"
    
    # Step 2: Backup current state (just in case)
    echo ""
    echo "2️⃣  Creating safety backup of current state..."
    SAFETY_BACKUP="backups/pre-rollback-$(date +%Y%m%d-%H%M%S)"
    mkdir -p "$SAFETY_BACKUP"
    
    # Save current git state
    git rev-parse HEAD > "$SAFETY_BACKUP/git-commit.txt" 2>&1
    git diff > "$SAFETY_BACKUP/uncommitted-changes.diff" 2>&1
    
    # Copy current env
    if [ -f ".env" ]; then
        cp .env "$SAFETY_BACKUP/.env.current" 2>&1
    fi
    check_status "Safety backup created"
    
    # Step 3: Restore database
    echo ""
    echo "3️⃣  Restoring database..."
    cd "$BACKUP_PATH"
    
    # Check if restore script exists
    if [ -f "restore.js" ]; then
        node restore.js 2>&1
        cd - > /dev/null
        check_status "Database restored"
    else
        echo -e "${YELLOW}⚠️  No restore script found, trying mongorestore...${NC}"
        if command -v mongorestore &> /dev/null; then
            mongorestore --uri="$MONGODB_URI" --drop . 2>&1
            cd - > /dev/null
            check_status "Database restored with mongorestore"
        else
            cd - > /dev/null
            echo -e "${RED}❌ Cannot restore database - no restore method available${NC}"
            exit 1
        fi
    fi
    
    # Step 4: Revert code
    echo ""
    echo "4️⃣  Reverting code to stable version..."
    
    # Check if we have uncommitted changes
    if [[ -n $(git status -s) ]]; then
        echo "  Stashing uncommitted changes..."
        git stash save "Rollback stash - $(date)" 2>&1
    fi
    
    # Try to checkout stable tag
    if git rev-parse --verify "v1.0-stable-pre-admin" &> /dev/null; then
        git checkout v1.0-stable-pre-admin 2>&1
        check_status "Code reverted to stable tag"
    else
        echo -e "${YELLOW}⚠️  No stable tag found, staying on current branch${NC}"
    fi
    
    # Step 5: Restore environment
    echo ""
    echo "5️⃣  Restoring environment configuration..."
    
    # Find most recent env backup
    ENV_BACKUP=$(ls -1 .env.backup-* 2>/dev/null | sort -r | head -n1)
    if [ -n "$ENV_BACKUP" ]; then
        cp "$ENV_BACKUP" .env 2>&1
        check_status "Environment configuration restored from $ENV_BACKUP"
    else
        echo -e "${YELLOW}⚠️  No environment backup found, keeping current .env${NC}"
    fi
    
    # Step 6: Reinstall dependencies
    echo ""
    echo "6️⃣  Reinstalling dependencies..."
    npm ci 2>&1
    check_status "Dependencies reinstalled"
    
    # Step 7: Run post-rollback checks
    echo ""
    echo "7️⃣  Running post-rollback checks..."
    
    # Check database connection
    node -e "
    const { MongoClient } = require('mongodb');
    require('dotenv').config();
    const client = new MongoClient(process.env.MONGODB_URI);
    client.connect().then(() => {
        console.log('✅ Database connection successful');
        client.close();
        process.exit(0);
    }).catch(err => {
        console.error('❌ Database connection failed:', err.message);
        process.exit(1);
    });
    " 2>&1
    check_status "Database connectivity"
    
    # Step 8: Start application
    echo ""
    echo "8️⃣  Starting application..."
    if command -v pm2 &> /dev/null; then
        pm2 start ecosystem.config.js 2>&1
    else
        npm run start 2>&1 &
        sleep 5
    fi
    check_status "Application started"
    
    echo ""
    echo "=== Rollback completed at $(date) ==="
    
} | tee "$ROLLBACK_LOG"

# Final summary
echo ""
echo "========================================="
echo -e "${GREEN}✅ Rollback completed successfully!${NC}"
echo "========================================="
echo ""
echo "📋 Next Steps:"
echo "  1. Verify application is running: curl http://localhost:1337/api/v1/status"
echo "  2. Check logs for any errors: tail -f logs/*.log"
echo "  3. Test user login functionality"
echo "  4. Verify tenant data access"
echo ""
echo "📝 Rollback log saved to: $ROLLBACK_LOG"
echo ""
echo "🔍 If issues persist:"
echo "  - Check the rollback log for errors"
echo "  - Review application logs"
echo "  - Your safety backup is in: $SAFETY_BACKUP"
echo ""

# Create rollback success marker
touch ".rollback-success-$(date +%Y%m%d-%H%M%S)"

exit 0
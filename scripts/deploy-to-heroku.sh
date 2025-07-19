#!/bin/bash

# Nightscout Multi-Tenant Heroku Deployment Script
# This script helps automate the deployment process

echo "======================================"
echo "Nightscout Multi-Tenant Deployment"
echo "======================================"
echo ""

# Check if Heroku CLI is installed
if ! command -v heroku &> /dev/null; then
    echo "❌ Heroku CLI is not installed. Please install it first:"
    echo "   https://devcenter.heroku.com/articles/heroku-cli"
    exit 1
fi

# Configuration
HEROKU_APP="btech"
BASE_DOMAIN="diabeetech.com"
ADMIN_EMAIL="mark@p5400.com"

echo "📋 Deployment Configuration:"
echo "   Heroku App: $HEROKU_APP"
echo "   Base Domain: $BASE_DOMAIN"
echo "   Admin Email: $ADMIN_EMAIL"
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -f "app.json" ]; then
    echo "❌ Error: This script must be run from the Nightscout root directory"
    exit 1
fi

# Login to Heroku
echo "🔐 Logging in to Heroku..."
heroku login

# Add Heroku remote
echo "🔗 Setting up Heroku remote..."
heroku git:remote -a $HEROKU_APP

# Generate JWT Secret if not provided
if [ -z "$JWT_SECRET" ]; then
    echo "🔑 Generating JWT secret..."
    JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")
    echo "   Generated: $JWT_SECRET"
fi

# Collect MongoDB URI
echo ""
echo "📊 MongoDB Atlas Configuration"
echo "Please enter your MongoDB connection string:"
echo "(Format: mongodb+srv://username:password@cluster.mongodb.net/nightscout_master)"
read -p "MASTER_MONGODB_URI: " MONGODB_URI

# Collect Gmail credentials
echo ""
echo "📧 Gmail Configuration (for notifications)"
read -p "Gmail address: " GMAIL_USER
echo "Generate an app password at: https://myaccount.google.com/apppasswords"
read -sp "Gmail app password: " GMAIL_PASS
echo ""

# Confirm settings
echo ""
echo "📋 Please confirm these settings:"
echo "   MongoDB URI: ${MONGODB_URI:0:30}..."
echo "   JWT Secret: ${JWT_SECRET:0:20}..."
echo "   Gmail User: $GMAIL_USER"
echo ""
read -p "Continue with deployment? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Deployment cancelled"
    exit 1
fi

# Set environment variables
echo ""
echo "⚙️  Setting environment variables..."

heroku config:set MULTI_TENANT_ENABLED=true \
    MASTER_MONGODB_URI="$MONGODB_URI" \
    JWT_SECRET="$JWT_SECRET" \
    BASE_DOMAIN=$BASE_DOMAIN \
    EMAIL_HOST=smtp.gmail.com \
    EMAIL_PORT=587 \
    EMAIL_SECURE=false \
    EMAIL_USER="$GMAIL_USER" \
    EMAIL_PASS="$GMAIL_PASS" \
    EMAIL_FROM=noreply@$BASE_DOMAIN \
    NODE_ENV=production \
    DISPLAY_UNITS=mg/dl \
    TIME_FORMAT=12 \
    THEME=colors \
    ENABLE="careportal iob cob bwp cage sage iage treatmentnotify basal dbsize" \
    USE_NPM_INSTALL=true \
    --app $HEROKU_APP

# Deploy to Heroku
echo ""
echo "🚀 Deploying to Heroku..."
git add .
git commit -m "Deploy multi-tenant Nightscout to Heroku" || true
git push heroku main

# Scale the dyno
echo ""
echo "📈 Scaling dyno..."
heroku ps:scale web=1:standard-1x --app $HEROKU_APP

# Add custom domains
echo ""
echo "🌐 Adding custom domains..."
heroku domains:add $BASE_DOMAIN --app $HEROKU_APP
heroku domains:add "*.$BASE_DOMAIN" --app $HEROKU_APP

# Enable automatic certificates
echo ""
echo "🔒 Enabling SSL certificates..."
heroku certs:auto:enable --app $HEROKU_APP

# Show app info
echo ""
echo "✅ Deployment complete!"
echo ""
echo "📱 Your app is available at:"
echo "   https://btech-d038118b5224.herokuapp.com"
echo ""
echo "🏥 Initial tenants will be available at:"
echo "   https://clinic1.$BASE_DOMAIN"
echo "   https://clinic2.$BASE_DOMAIN"
echo ""
echo "📧 Check your email ($ADMIN_EMAIL) for admin credentials"
echo ""
echo "⚠️  IMPORTANT NEXT STEPS:"
echo "1. Configure DNS in GoDaddy:"
echo "   - Add CNAME record: @ → btech-d038118b5224.herokuapp.com"
echo "   - Add CNAME record: * → btech-d038118b5224.herokuapp.com"
echo "2. Wait for DNS propagation (5-30 minutes)"
echo "3. Login and change admin passwords"
echo ""
echo "📊 View logs with: heroku logs --tail --app $HEROKU_APP"
echo "🔄 Restart app with: heroku restart --app $HEROKU_APP"
# Local Setup Instructions for Diabeetech Admin Dashboard

## Prerequisites

### 1. Install MongoDB

#### macOS (using Homebrew):
```bash
# Install Homebrew if not already installed
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Tap the MongoDB formula
brew tap mongodb/brew

# Install MongoDB Community Edition
brew install mongodb-community

# Start MongoDB
brew services start mongodb-community

# Verify MongoDB is running
mongosh --eval "db.version()"
```

#### Alternative: Use MongoDB Atlas (Cloud)
1. Go to https://www.mongodb.com/cloud/atlas
2. Create a free cluster
3. Get your connection string
4. Update `.env` with: `MONGODB_URI=<your-atlas-connection-string>`

### 2. Install Node.js Dependencies

```bash
# Install main app dependencies
npm install

# Build admin dashboard
cd admin-dashboard
npm install
npm run build
cd ..
```

## Starting the Application

### 1. Start MongoDB (if using local)
```bash
brew services start mongodb-community
```

### 2. Create SuperAdmin User
```bash
node setup-superadmin.js --default
```

Default credentials:
- Email: `superadmin@diabeetech.net`
- Password: `Db#SuperAdmin2025!Secure`

### 3. Start the Application
```bash
npm start
```

### 4. Access Admin Dashboard
Open your browser and go to: http://localhost:1337/admin

## Quick Start (All Commands)

```bash
# 1. Start MongoDB
brew services start mongodb-community

# 2. Setup and run
npm install
cd admin-dashboard && npm install && npm run build && cd ..
node setup-superadmin.js --default
npm start

# 3. Open browser
open http://localhost:1337/admin
```

## Troubleshooting

### MongoDB Connection Issues
If you get connection errors:
1. Check MongoDB is running: `brew services list`
2. Check MongoDB logs: `tail -f /usr/local/var/log/mongodb/mongo.log`
3. Try connecting manually: `mongosh`

### Port Already in Use
If port 1337 is in use:
1. Find process: `lsof -i :1337`
2. Kill process: `kill -9 <PID>`
3. Or change port in `.env`: `PORT=3000`

### Build Errors
If the admin dashboard build fails:
1. Clear node_modules: `rm -rf admin-dashboard/node_modules`
2. Clear cache: `npm cache clean --force`
3. Reinstall: `cd admin-dashboard && npm install`

### Login Issues
If you can't log in:
1. Verify superadmin was created: `mongosh nightscout-master --eval "db.users.find({role:'superadmin'})"`
2. Re-run setup: `node setup-superadmin.js`
3. Check cookies are enabled in browser

## Development Mode

For development with hot reload:
```bash
# Terminal 1: Run the main app
npm run dev

# Terminal 2: Run admin dashboard in watch mode
cd admin-dashboard
npm run watch
```

## Stopping Services

```bash
# Stop the app
Ctrl+C (in the terminal running npm start)

# Stop MongoDB
brew services stop mongodb-community
```
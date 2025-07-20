# Dexcom Bridge Setup for Multi-Tenant Nightscout

## Current Situation
- Profile is now loading correctly for clinic2
- No CGM data entries found in the database
- Dexcom Bridge and MM Connect are not currently configured

## Options for Getting CGM Data into Nightscout

### Option 1: Dexcom Share Bridge (Built-in)
The Nightscout Dexcom Bridge can pull data directly from Dexcom Share/Follow service.

**Requirements:**
- Dexcom G5, G6, or G7 CGM
- Dexcom app with Share enabled
- Dexcom account credentials

**To Enable:**
1. Add these environment variables to Heroku:
```bash
heroku config:set BRIDGE_USER_NAME="your-dexcom-username"
heroku config:set BRIDGE_PASSWORD="your-dexcom-password"
heroku config:set BRIDGE_INTERVAL=150000  # 2.5 minutes in milliseconds
heroku config:set ENABLE="$ENABLE bridge"  # Add bridge to existing ENABLE list
```

### Option 2: Uploaders (External Apps)
Various apps can upload CGM data to Nightscout:

1. **xDrip+ (Android)**
   - Supports Dexcom G4/G5/G6/G7, Libre, and many others
   - Configure with: `https://clinic2.diabeetech.net`
   - API Secret: `GodIsSoGood2Me23!`

2. **Spike (iOS - if still available)**
   - Similar to xDrip+ for iOS
   - Same configuration as above

3. **Diabox (iOS)**
   - Supports various CGMs
   - Same configuration as above

4. **Loop (iOS)**
   - If using Loop for insulin delivery
   - Configure Nightscout service in Loop settings

5. **AndroidAPS**
   - If using AndroidAPS
   - Configure NS Client with same URL and API secret

### Option 3: MiniMed Connect (for Medtronic pumps)
If using a compatible Medtronic pump with CareLink.

**To Enable:**
```bash
heroku config:set MMCONNECT_USER_NAME="carelink-username"
heroku config:set MMCONNECT_PASSWORD="carelink-password"
heroku config:set MMCONNECT_INTERVAL=60000  # 1 minute
heroku config:set ENABLE="$ENABLE mmconnect"
```

### Option 4: Manual Data Upload
You can also manually upload data via:
- Nightscout Care Portal (for manual entries)
- API calls (for programmatic uploads)
- CSV imports (if you have exported data)

## Multi-Tenant Considerations

In multi-tenant mode, the bridge runs at the server level and needs to know which tenant to upload data to. This might require additional configuration or modifications to support per-tenant bridges.

### Potential Issues:
1. The built-in bridge may need modification to support multi-tenant uploads
2. External uploaders should work fine as they use the API with authentication
3. Each tenant would need their own Dexcom/CareLink credentials

## Recommended Next Steps:

1. **For immediate testing**, use an external uploader like xDrip+ or Spike:
   - Install the app on your phone
   - Configure with URL: `https://clinic2.diabeetech.net`
   - Enter API secret: `GodIsSoGood2Me23!`
   - Enable data upload

2. **For built-in bridge**, we may need to modify the code to support per-tenant configuration of bridge credentials.

3. **For production use**, consider:
   - Setting up per-tenant bridge configuration in the database
   - Modifying the bridge plugin to read tenant-specific settings
   - Adding UI to configure bridge settings per tenant
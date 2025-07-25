# Heroku Rollback Procedure

## Current Status
- **Last Working Version**: v203 (before treatments API fix attempts)
- **Current Version**: v205 (with treatments API fixes)
- **Issue**: Treatments API still returning 500 errors

## Rollback Commands

### Check Current Release
```bash
heroku releases --app btech -n 5
```

### Rollback to Previous Working Version
```bash
# Rollback to v203 (last known working version)
heroku rollback v203 --app btech

# Or rollback to the previous release
heroku rollback --app btech
```

### Monitor Rollback
```bash
# Watch logs during rollback
heroku logs --tail --app btech

# Check release status
heroku releases:info --app btech
```

## Version History
- **v203**: Last stable release without treatments fixes
- **v204**: First attempt to fix treatments API (added bus/ddata)
- **v205**: Second attempt (added purifier)

## Post-Rollback Actions

1. **Verify Services**
   ```bash
   # Check API status
   curl https://onepanman.diabeetech.net/api/v1/status
   
   # Check entries are still working
   curl -H "api-secret: 51a26cb40dcca4fd97601d00f8253129091c06ca" \
        https://onepanman.diabeetech.net/api/v1/entries?count=5
   ```

2. **Document Issues**
   - Treatments API requires more than just bus/ddata/purifier
   - May need to investigate full context initialization
   - Check if issue is multi-tenant specific

3. **Next Steps**
   - Investigate in development environment
   - Check Heroku logs for specific error details
   - Consider if treatments need additional context properties

## Emergency Rollback

If immediate rollback is needed:
```bash
heroku rollback v203 --app btech
```

This will restore the application to the last known stable state.
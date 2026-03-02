# Rollback Plan for Memory Optimization Deployment

## Current Production State (Before Deployment)
- **Date**: 2025-07-25
- **Heroku Version**: v212
- **Git Commit**: c40b704a
- **Tag**: rollback-before-memory-opt-v212
- **Branch**: feat/restrict-admin-to-tenants

## Changes Being Deployed
1. Memory optimization in Procfile (--max-old-space-size=400)
2. Connection pool configuration
3. Data cleanup scripts
4. Memory monitoring endpoint
5. Database optimization guide

## Rollback Instructions

### Option 1: Heroku Rollback (Fastest - Recommended)
If issues occur after deployment, rollback to v212:
```bash
heroku rollback v212 -a btech
```

### Option 2: Git Rollback
If you need to rollback the code changes:
```bash
# Rollback to the tagged version
git checkout rollback-before-memory-opt-v212

# Force push to Heroku
git push heroku rollback-before-memory-opt-v212:main --force
```

### Option 3: Selective Rollback
If only specific features need rollback:
```bash
# Revert just the Procfile changes
git revert aeb2cba --no-commit
git restore --staged Procfile
git checkout HEAD -- Procfile
git commit -m "Revert memory limits in Procfile"
git push heroku main
```

## Monitoring After Deployment

### Success Indicators
- Memory usage drops below 450MB
- No R14 errors in logs
- Application responds normally
- All tenants can access their data

### Failure Indicators
- Application crashes or won't start
- Memory usage increases instead of decreases
- Database connection errors
- Timeout errors (H12)

### Commands to Monitor
```bash
# Watch logs
heroku logs --tail -a btech

# Check memory usage
heroku ps -a btech

# Check for errors
heroku logs -a btech | grep -i error | tail -20

# Test application health
curl -I https://www.diabeetech.net
```

## Emergency Contacts
- Primary: Mark (you)
- Heroku Support: If database issues arise

## Post-Deployment Checklist
- [ ] Application starts successfully
- [ ] No memory errors in first 10 minutes
- [ ] Test user login works
- [ ] API endpoints respond
- [ ] WebSocket connections work
- [ ] Admin dashboard accessible
- [ ] Memory usage trending down

## Notes
- The memory optimizations are conservative and tested
- Connection pool limits are based on Heroku recommendations
- Data cleanup is non-destructive for recent data (only >90 days)
- All changes can be reverted without data loss
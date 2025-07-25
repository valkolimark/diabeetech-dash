# Admin Dashboard Deployment Checklist

Use this checklist for deploying updates to the Diabeetech Admin Dashboard.

## 📋 Pre-Deployment Checklist

### Code Review
- [ ] All changes reviewed by at least one team member
- [ ] No hardcoded credentials or secrets
- [ ] Console.log statements removed from production code
- [ ] Error handling implemented for all API endpoints
- [ ] Input validation on all user inputs

### Testing
- [ ] Unit tests passing
- [ ] Integration tests passing
- [ ] Manual testing completed on staging
- [ ] Cross-browser testing (Chrome, Firefox, Safari)
- [ ] Mobile responsive testing
- [ ] API endpoint testing with Postman/curl

### Security
- [ ] No new dependencies with known vulnerabilities
- [ ] Security headers verified
- [ ] CORS configuration reviewed
- [ ] Authentication flow tested
- [ ] Admin-only access verified

### Documentation
- [ ] README updated if needed
- [ ] API documentation current
- [ ] Changelog updated
- [ ] Migration notes added if required

## 🚀 Deployment Steps

### 1. Backup Current State
```bash
# Create backup of current deployment
heroku pg:backups:capture --app btech-d038118b5224

# Document current version
heroku releases:info --app btech-d038118b5224
```

### 2. Environment Variables
```bash
# Verify all required env vars are set
heroku config --app btech-d038118b5224

# Required variables:
# - FEATURE_ADMIN_DASHBOARD=true
# - FEATURE_USER_MGMT=true
# - FEATURE_TENANT_MGMT=true
# - JWT_SECRET=<secure-value>
# - MASTER_MONGODB_URI=<mongodb-uri>
```

### 3. Build Verification
```bash
# Local build test
npm run build:admin

# Verify build output
ls -la admin-dashboard/dist/
ls -la views/admin-dashboard.html
```

### 4. Deploy to Staging (if available)
```bash
# Push to staging first
git push staging main

# Test on staging
curl https://staging.diabeetech.net/admin
```

### 5. Production Deployment
```bash
# Merge to main branch
git checkout main
git merge feature-branch

# Tag the release
git tag -a v1.0.1 -m "Admin dashboard update"
git push origin v1.0.1

# Deploy to Heroku
git push heroku main
```

### 6. Post-Deployment Verification

#### Immediate Checks
- [ ] Admin dashboard loads at `/admin`
- [ ] Login functionality works
- [ ] API health check responds: `/api/v1/admin/health`
- [ ] Overview data loads correctly
- [ ] No JavaScript errors in browser console

#### Functional Testing
```bash
# Test login
curl -X POST https://btech-d038118b5224.herokuapp.com/api/v1/admin/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"superadmin@diabeetech.net","password":"<password>"}'

# Test authenticated endpoint
curl -X GET https://btech-d038118b5224.herokuapp.com/api/v1/admin/overview \
  -H "Cookie: admin_token=<token-from-login>"
```

#### Tenant Site Verification
- [ ] Check existing tenant sites still work
- [ ] Verify tenant login not affected
- [ ] Test a tenant API endpoint
- [ ] Confirm no routing conflicts

### 7. Monitor Logs
```bash
# Watch for errors
heroku logs --tail --app btech-d038118b5224

# Check for specific issues
heroku logs --app btech-d038118b5224 | grep ERROR
heroku logs --app btech-d038118b5224 | grep "admin"
```

## 🔄 Rollback Procedure

If issues are detected:

### 1. Immediate Rollback
```bash
# List recent releases
heroku releases --app btech-d038118b5224

# Rollback to previous version
heroku rollback v201 --app btech-d038118b5224
```

### 2. Verify Rollback
- [ ] Admin dashboard loads correctly
- [ ] Previous functionality restored
- [ ] Check logs for stability

### 3. Investigation
- [ ] Capture logs from failed deployment
- [ ] Document issues encountered
- [ ] Create hotfix branch if needed

## 📊 Post-Deployment Monitoring

### First Hour
- Monitor error rates
- Check response times
- Verify memory usage normal
- Watch for unusual login attempts

### First 24 Hours
- Review audit logs for anomalies
- Check all scheduled jobs running
- Verify backup processes working
- Monitor user feedback channels

### First Week
- Analyze usage patterns
- Review performance metrics
- Check for security alerts
- Gather user feedback

## 🛠️ Common Issues & Solutions

### Issue: Admin routes returning 404
**Solution**: Verify admin routes are before tenant resolver in `app-multitenant.js`

### Issue: Authentication failing
**Solution**: Check JWT_SECRET is set and matches between deployments

### Issue: Database connection errors
**Solution**: Verify MASTER_MONGODB_URI is correct and accessible

### Issue: Static files not loading
**Solution**: Check `.slugignore` isn't excluding admin files

### Issue: Build failing on Heroku
**Solution**: Ensure Node version compatibility and all dependencies listed

## 📝 Deployment Log Template

```markdown
## Deployment Log - [Date]

**Version**: v1.0.x
**Deployed By**: [Name]
**Time**: [UTC Time]
**Heroku Release**: vXXX

### Changes Deployed
- Feature: [Description]
- Fix: [Description]
- Update: [Description]

### Pre-Deployment Checks
- [ ] Code review completed
- [ ] Tests passing
- [ ] Staging tested

### Deployment Status
- Start Time: [Time]
- End Time: [Time]
- Status: Success/Failed
- Rollback Required: Yes/No

### Post-Deployment Notes
- [Any issues observed]
- [Performance notes]
- [User feedback]

### Action Items
- [ ] [Any follow-up needed]
```

## 🚨 Emergency Contacts

- **DevOps Lead**: [Contact]
- **Security Team**: security@diabeetech.net
- **Database Admin**: [Contact]
- **Heroku Support**: [Ticket URL]

## 📚 Reference Documents

- [Admin Dashboard Guide](ADMIN-DASHBOARD-GUIDE.md)
- [API Reference](admin-api-reference.md)
- [Troubleshooting Guide](admin-troubleshooting.md)
- [Security Procedures](security-procedures.md)

---

**Remember**: Always deploy during low-traffic periods when possible, and have a rollback plan ready!
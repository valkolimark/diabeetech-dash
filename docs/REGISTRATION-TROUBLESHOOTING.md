# Registration Troubleshooting Guide

## Quick Diagnosis Steps

### 1. User Can't Register
```bash
# Check if username is available
curl https://diabeetech.net/api/register/check-username/[username]

# Check API endpoint
curl -X POST https://diabeetech.net/api/register \
  -H "Content-Type: application/json" \
  -d '{"test": "test"}' -v
```

### 2. User Can't Login After Registration
```bash
# Check user exists and has correct password field
node tools/check-user-status.js [email] "mongodb+srv://..."

# Fix password field if needed
node tools/fix-user-password-fields.js "mongodb+srv://..."
```

### 3. No Data After Registration
```bash
# Check bridge configuration
node tools/check-dexcom-bridge.js

# Test Dexcom credentials
node tools/test-dexcom-credentials.js

# Update and restart
node tools/update-live-dexcom-credentials.js "mongodb+srv://..."
heroku restart -a btech
```

## Common Error Messages

### "Illegal arguments: string, undefined"
**Cause**: Password field mismatch
**Fix**: Run `fix-user-password-fields.js`

### "Username already taken"
**Cause**: Subdomain exists
**Fix**: Choose different username

### "Invalid credentials"
**Cause**: Wrong password or email
**Fix**: Reset password or check email

### "Tenant context required"
**Cause**: Subdomain not resolved
**Fix**: Check DNS and tenant mapping

## Emergency Fixes

### Reset User Password
```javascript
// Create script: reset-user-password.js
const email = process.argv[2];
const newPassword = process.argv[3];

// Hash password
const hash = await bcrypt.hash(newPassword, 10);

// Update user
await users.updateOne(
  { email: email },
  { $set: { passwordHash: hash } }
);
```

### Create User Manually
```javascript
// If registration fails, create manually
const user = {
  userId: crypto.randomUUID(),
  tenantId: tenant.tenantId,
  email: "user@email.com",
  passwordHash: await bcrypt.hash("password", 10),
  role: "admin",
  isActive: true,
  createdAt: new Date()
};

await users.insertOne(user);
```

### Fix Tenant Database
```javascript
// Ensure all collections exist
const requiredCollections = [
  'entries', 'treatments', 'devicestatus', 
  'profile', 'settings', 'food', 'activity'
];

for (const coll of requiredCollections) {
  await tenantDb.createCollection(coll);
}
```

## Validation Checklist

Before declaring registration working:

- [ ] User can register via web form
- [ ] User receives success message
- [ ] User can login immediately
- [ ] Tenant URL is accessible
- [ ] API endpoints work with secret
- [ ] Dexcom data flows if configured
- [ ] Profile settings are applied

## Prevention Measures

1. **Add Registration Tests**
```javascript
// test/registration.test.js
describe('Registration', () => {
  it('creates user with passwordHash field', async () => {
    const response = await request(app)
      .post('/api/register')
      .send(validData);
    
    const user = await users.findOne({ email: validData.email });
    expect(user.passwordHash).toBeDefined();
    expect(user.password).toBeUndefined();
  });
});
```

2. **Add Field Validation**
```javascript
// In user creation
if (userData.password && !userData.passwordHash) {
  userData.passwordHash = userData.password;
  delete userData.password;
}
```

3. **Add Monitoring**
```javascript
// Log registration attempts
await audit.log({
  action: 'registration.attempt',
  email: email,
  success: success,
  error: error?.message
});
```

## Contact for Issues

If registration issues persist:
1. Check Heroku logs: `heroku logs --tail -a btech`
2. Check MongoDB connection
3. Verify environment variables
4. Test with minimal data first
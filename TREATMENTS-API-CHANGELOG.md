# Treatments API Changelog

## [Investigation] - 2025-07-25

### Added
- Comprehensive API endpoints documentation (`/docs/API-ENDPOINTS.md`)
- Treatments API fix documentation (`/docs/TREATMENTS-API-FIX.md`)
- Complete fix planning document (`/docs/TREATMENTS-API-COMPLETE-FIX.md`)
- Investigation log with findings (`/docs/TREATMENTS-API-INVESTIGATION-LOG.md`)
- Heroku rollback procedure (`/HEROKU-ROLLBACK-PROCEDURE.md`)
- Multiple test scripts for debugging:
  - `test-treatments-api.js` - Comprehensive Node.js test suite
  - `test-treatments-curl.sh` - Bash/curl testing script
  - `debug-treatments-db.js` - Direct database debugging
  - `insert-treatments-direct.js` - Direct data insertion
  - `test-minimal-treatment.sh` - Minimal API testing

### Changed
- Modified `tenantResolver.js` to add missing context properties:
  - Added `ctx.bus` for event emission
  - Added `ctx.ddata` for data processing
  - Added `ctx.purifier` for input sanitization

### Fixed (Attempted)
- Attempted to fix treatments API 500 errors in multi-tenant setup
- Identified root cause: missing context properties in tenant resolver
- Deployed fixes in v204 and v205 (rolled back to v203)

### Known Issues
- Treatments POST API still returning 500 errors
- Requires more comprehensive context initialization
- May need complete context cloning approach

### Security
- No security vulnerabilities introduced
- API authentication working correctly
- Tenant isolation maintained

### Deployment History
- v203: Last stable version (current)
- v204: First fix attempt (bus/ddata)
- v205: Second fix attempt (added purifier)
- v206: Rollback to v203

### Technical Details

#### Problem
Multi-tenant contexts created in `tenantResolver.js` were missing critical properties required by the treatments module:
- Event bus for data synchronization
- Data processor for runtime processing
- Input purifier for sanitization

#### Solution Attempted
Added explicit property references to tenant context:
```javascript
req.ctx.bus = ctx.bus;
req.ctx.ddata = ctx.ddata;
req.ctx.purifier = ctx.purifier;
```

#### Next Steps
1. Implement comprehensive error logging
2. Consider full context cloning approach
3. Set up staging environment for testing
4. Create integration tests for multi-tenant scenarios

### Testing
- Created 5 different test scripts
- Tested with tenant "onepanman"
- API Secret: `GodIsSoGood2Me23!`
- SHA-1 Hash: `51a26cb40dcca4fd97601d00f8253129091c06ca`

### Documentation
- Comprehensive API documentation created
- Detailed investigation findings documented
- Rollback procedures established
- Test data formats documented
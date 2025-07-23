# Next Session: Comprehensive Multi-Tenant Nightscout API Documentation

## Objective
Create an extremely detailed API documentation for the multi-tenant Nightscout system that covers all endpoints, authentication methods, data formats, and real-world usage examples. This documentation should enable developers to fully integrate with Nightscout for reading and writing all types of diabetes data.

## Current State
- Multi-tenant Nightscout is fully operational with JWT authentication
- Registration system implemented with bot protection
- Tenant isolation working with separate databases
- Various endpoints exist but lack comprehensive documentation

## Documentation Structure Needed

### 1. **Authentication & Authorization**
- [ ] JWT token acquisition and refresh
- [ ] API_SECRET fallback for legacy compatibility  
- [ ] Bearer token usage in headers
- [ ] Cookie-based authentication for web
- [ ] Tenant context in multi-tenant mode
- [ ] Role-based permissions (readable, careportal, admin)

### 2. **Core API Endpoints**

#### Glucose Data (Entries)
- [ ] `GET /api/v1/entries` - Retrieve glucose readings
  - Query parameters: count, find, date filters
  - Pagination strategies
  - Real-time vs historical data
- [ ] `POST /api/v1/entries` - Submit new glucose readings
  - Data format from different CGM systems
  - Batch uploads
- [ ] `PUT /api/v1/entries/:id` - Update existing entries
- [ ] `DELETE /api/v1/entries/:id` - Remove entries

#### Treatments
- [ ] `GET /api/v1/treatments` - Retrieve all treatment types
  - Insulin (bolus, basal)
  - Carbohydrates
  - Temp basals
  - Exercise
  - Notes
- [ ] `POST /api/v1/treatments` - Log new treatments
  - Required fields per treatment type
  - Validation rules
  - Timestamp handling
- [ ] Treatment calculations (IOB, COB)

#### Profile Management
- [ ] `GET /api/v1/profile` - Retrieve current profile
- [ ] `POST /api/v1/profile` - Update profile settings
  - Basal rates
  - Carb ratios
  - Insulin sensitivity factors
  - Target ranges

#### Food Database
- [ ] `GET /api/v1/food` - Search food database
- [ ] `POST /api/v1/food` - Add custom foods
- [ ] Food categories and quick picks
- [ ] Nutritional information format

#### Device Status
- [ ] `GET /api/v1/devicestatus` - Pump and uploader status
- [ ] `POST /api/v1/devicestatus` - Update device status
- [ ] OpenAPS/Loop integration formats

### 3. **Multi-Tenant Specific APIs**

#### Tenant Management
- [ ] Registration endpoints (already implemented)
- [ ] Tenant settings and configuration
- [ ] User management within tenants
- [ ] Switching between tenants

#### Bridge/Plugin APIs
- [ ] Dexcom Share integration
- [ ] MiniMed Connect setup
- [ ] Other CGM systems

### 4. **Real-World Examples**

#### Common Scenarios
- [ ] Mobile app integration guide
- [ ] Smartwatch data display
- [ ] Automated data upload scripts
- [ ] Data export for analysis
- [ ] Integration with other diabetes tools

#### Code Examples
- [ ] JavaScript/Node.js
- [ ] Python
- [ ] cURL commands
- [ ] Postman collection
- [ ] React/React Native integration

### 5. **Data Formats & Standards**

#### Timestamp Handling
- [ ] UTC vs local time
- [ ] Date format standards
- [ ] Timezone considerations

#### Units
- [ ] mg/dL vs mmol/L conversions
- [ ] Insulin unit standards
- [ ] Carbohydrate calculations

#### Error Responses
- [ ] Standard error format
- [ ] HTTP status codes
- [ ] Error code reference

### 6. **Advanced Topics**

#### Webhooks & Real-time Data
- [ ] WebSocket connections
- [ ] Server-sent events
- [ ] Webhook notifications

#### Data Aggregation
- [ ] Reports API
- [ ] Statistics calculations
- [ ] Time-in-range queries

#### Import/Export
- [ ] Bulk data import formats
- [ ] CSV/JSON export options
- [ ] Data migration tools

### 7. **Security & Best Practices**

#### Rate Limiting
- [ ] Per-endpoint limits
- [ ] Quota management
- [ ] Handling 429 responses

#### Data Privacy
- [ ] HIPAA considerations
- [ ] Data retention policies
- [ ] Encryption in transit/at rest

#### Performance
- [ ] Caching strategies
- [ ] Efficient querying
- [ ] Batch operations

### 8. **Testing & Development**

#### Test Environment
- [ ] Setting up local instance
- [ ] Test data generation
- [ ] Automated testing

#### Debugging
- [ ] Common errors and solutions
- [ ] Logging and monitoring
- [ ] API versioning

## Implementation Plan

1. **Analyze Existing Code**
   - Review all API endpoints in `/lib/api/`
   - Document actual behavior vs intended
   - Identify undocumented features

2. **Create Interactive Documentation**
   - OpenAPI/Swagger specification
   - Try-it-now functionality
   - Auto-generated client libraries

3. **Build Example Collection**
   - Postman collection with all endpoints
   - Sample apps in multiple languages
   - Video tutorials for common tasks

4. **Establish Testing Suite**
   - API endpoint tests
   - Integration test examples
   - Performance benchmarks

## Special Considerations for Multi-Tenant

- How subdomain affects API calls
- Tenant-specific API keys
- Cross-tenant data access (admin only)
- Billing/usage tracking APIs
- Tenant provisioning automation

## Deliverables

1. **Markdown Documentation** (`/docs/API-REFERENCE.md`)
2. **OpenAPI Specification** (`/docs/openapi.yaml`)
3. **Postman Collection** (`/docs/nightscout-api.postman_collection.json`)
4. **Example Applications** (`/examples/`)
5. **Migration Guide** (from single to multi-tenant)

## Success Criteria

- Developer can integrate Nightscout API without external help
- All endpoints documented with request/response examples
- Common errors and troubleshooting included
- Performance guidelines and limits clear
- Security best practices emphasized

## Notes for Implementation

- Check `/lib/api/index.js` for all API route definitions
- Review authentication in `/lib/middleware/auth.js`
- Examine `/lib/api/entries/index.js` for glucose data patterns
- Look at `/lib/api/treatments/index.js` for treatment formats
- Study WebSocket implementation in `/lib/server/websocket-multitenant.js`

Remember: This documentation will be the primary reference for developers building on top of the multi-tenant Nightscout platform. Make it comprehensive, clear, and practical.
'use strict';

const _ = require('lodash');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const language = require('../lib/language')();

describe('Multi-tenant functionality', function() {
  const self = this;
  
  before(async function() {
    // Set up multi-tenant environment
    process.env.MULTI_TENANT_ENABLED = 'true';
    process.env.MASTER_MONGODB_URI = process.env.MONGO_CONNECTION || 'mongodb://localhost:27017/nightscout_master';
    process.env.JWT_SECRET = 'test-jwt-secret-for-testing-only-32-chars-long';
    process.env.BASE_DOMAIN = 'nightscout.test';
    process.env.API_SECRET = 'test-api-secret';
    
    self.env = require('../lib/server/env')();
    self.bootevent = require('../lib/server/bootevent-multitenant');
    
    // Initialize context
    await new Promise((resolve, reject) => {
      self.bootevent(self.env, language).boot((ctx) => {
        self.ctx = ctx;
        self.app = require('../lib/server/app-multitenant')(self.env, ctx);
        resolve();
      });
    });
    
    // Initialize models
    self.tenantModel = require('../lib/models/tenant')(self.env, self.ctx);
    self.userModel = require('../lib/models/user')(self.env, self.ctx);
  });
  
  after(async function() {
    // Clean up test data
    if (self.ctx && self.ctx.store && self.ctx.store.client) {
      await self.ctx.store.client.close();
    }
  });
  
  describe('Tenant Management', function() {
    let testTenant1, testTenant2;
    
    it('should register a new tenant', async function() {
      const res = await request(self.app)
        .post('/api/tenants/register')
        .send({
          name: 'Test Clinic 1',
          subdomain: 'testclinic1',
          adminEmail: 'admin@testclinic1.com',
          adminPassword: 'Test123!@#'
        })
        .expect(201);
      
      res.body.should.have.property('tenant');
      res.body.should.have.property('token');
      res.body.tenant.should.have.property('tenantId');
      res.body.tenant.should.have.property('subdomain', 'testclinic1');
      
      testTenant1 = res.body.tenant;
    });
    
    it('should register a second tenant', async function() {
      const res = await request(self.app)
        .post('/api/tenants/register')
        .send({
          name: 'Test Clinic 2',
          subdomain: 'testclinic2',
          adminEmail: 'admin@testclinic2.com',
          adminPassword: 'Test123!@#'
        })
        .expect(201);
      
      res.body.tenant.should.have.property('subdomain', 'testclinic2');
      testTenant2 = res.body.tenant;
    });
    
    it('should reject duplicate subdomain', async function() {
      await request(self.app)
        .post('/api/tenants/register')
        .send({
          name: 'Test Clinic 3',
          subdomain: 'testclinic1',
          adminEmail: 'admin@testclinic3.com',
          adminPassword: 'Test123!@#'
        })
        .expect(400);
    });
  });
  
  describe('Authentication', function() {
    let tenant1Token, tenant2Token;
    
    before(async function() {
      // Login as tenant 1 admin
      const res1 = await request(self.app)
        .post('/api/auth/login')
        .set('X-Tenant-Subdomain', 'testclinic1')
        .send({
          email: 'admin@testclinic1.com',
          password: 'Test123!@#'
        })
        .expect(200);
      
      tenant1Token = res1.body.token;
      
      // Login as tenant 2 admin
      const res2 = await request(self.app)
        .post('/api/auth/login')
        .set('X-Tenant-Subdomain', 'testclinic2')
        .send({
          email: 'admin@testclinic2.com',
          password: 'Test123!@#'
        })
        .expect(200);
      
      tenant2Token = res2.body.token;
    });
    
    it('should access tenant 1 data with tenant 1 token', async function() {
      await request(self.app)
        .get('/api/v1/status')
        .set('Authorization', `Bearer ${tenant1Token}`)
        .set('X-Tenant-Subdomain', 'testclinic1')
        .expect(200);
    });
    
    it('should reject tenant 1 token for tenant 2', async function() {
      await request(self.app)
        .get('/api/v1/status')
        .set('Authorization', `Bearer ${tenant1Token}`)
        .set('X-Tenant-Subdomain', 'testclinic2')
        .expect(401);
    });
  });
  
  describe('Data Isolation', function() {
    let tenant1Token, tenant2Token;
    let tenant1Entry, tenant2Entry;
    
    before(async function() {
      // Get tokens
      const res1 = await request(self.app)
        .post('/api/auth/login')
        .set('X-Tenant-Subdomain', 'testclinic1')
        .send({
          email: 'admin@testclinic1.com',
          password: 'Test123!@#'
        });
      tenant1Token = res1.body.token;
      
      const res2 = await request(self.app)
        .post('/api/auth/login')
        .set('X-Tenant-Subdomain', 'testclinic2')
        .send({
          email: 'admin@testclinic2.com',
          password: 'Test123!@#'
        });
      tenant2Token = res2.body.token;
    });
    
    it('should create entry for tenant 1', async function() {
      const now = Date.now();
      const entry = {
        type: 'sgv',
        sgv: 120,
        date: now,
        dateString: new Date(now).toISOString()
      };
      
      const res = await request(self.app)
        .post('/api/v1/entries')
        .set('Authorization', `Bearer ${tenant1Token}`)
        .set('X-Tenant-Subdomain', 'testclinic1')
        .send(entry)
        .expect(200);
      
      tenant1Entry = res.body;
    });
    
    it('should create entry for tenant 2', async function() {
      const now = Date.now();
      const entry = {
        type: 'sgv',
        sgv: 140,
        date: now,
        dateString: new Date(now).toISOString()
      };
      
      const res = await request(self.app)
        .post('/api/v1/entries')
        .set('Authorization', `Bearer ${tenant2Token}`)
        .set('X-Tenant-Subdomain', 'testclinic2')
        .send(entry)
        .expect(200);
      
      tenant2Entry = res.body;
    });
    
    it('should only see tenant 1 entries when querying as tenant 1', async function() {
      const res = await request(self.app)
        .get('/api/v1/entries')
        .set('Authorization', `Bearer ${tenant1Token}`)
        .set('X-Tenant-Subdomain', 'testclinic1')
        .expect(200);
      
      res.body.should.be.instanceOf(Array);
      res.body.some(e => e.sgv === 120).should.be.true();
      res.body.some(e => e.sgv === 140).should.be.false();
    });
    
    it('should only see tenant 2 entries when querying as tenant 2', async function() {
      const res = await request(self.app)
        .get('/api/v1/entries')
        .set('Authorization', `Bearer ${tenant2Token}`)
        .set('X-Tenant-Subdomain', 'testclinic2')
        .expect(200);
      
      res.body.should.be.instanceOf(Array);
      res.body.some(e => e.sgv === 140).should.be.true();
      res.body.some(e => e.sgv === 120).should.be.false();
    });
  });
  
  describe('User Roles', function() {
    let adminToken, caregiverToken, viewerToken;
    
    before(async function() {
      // Create users with different roles for tenant 1
      const adminRes = await request(self.app)
        .post('/api/auth/login')
        .set('X-Tenant-Subdomain', 'testclinic1')
        .send({
          email: 'admin@testclinic1.com',
          password: 'Test123!@#'
        });
      adminToken = adminRes.body.token;
      
      // Create caregiver user
      await request(self.app)
        .post('/api/tenants/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('X-Tenant-Subdomain', 'testclinic1')
        .send({
          email: 'caregiver@testclinic1.com',
          password: 'Test123!@#',
          name: 'Caregiver User',
          role: 'caregiver'
        })
        .expect(201);
      
      // Create viewer user
      await request(self.app)
        .post('/api/tenants/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('X-Tenant-Subdomain', 'testclinic1')
        .send({
          email: 'viewer@testclinic1.com',
          password: 'Test123!@#',
          name: 'Viewer User',
          role: 'viewer'
        })
        .expect(201);
      
      // Get tokens for new users
      const caregiverRes = await request(self.app)
        .post('/api/auth/login')
        .set('X-Tenant-Subdomain', 'testclinic1')
        .send({
          email: 'caregiver@testclinic1.com',
          password: 'Test123!@#'
        });
      caregiverToken = caregiverRes.body.token;
      
      const viewerRes = await request(self.app)
        .post('/api/auth/login')
        .set('X-Tenant-Subdomain', 'testclinic1')
        .send({
          email: 'viewer@testclinic1.com',
          password: 'Test123!@#'
        });
      viewerToken = viewerRes.body.token;
    });
    
    it('admin should be able to create treatments', async function() {
      const treatment = {
        eventType: 'Correction Bolus',
        insulin: 2.5,
        created_at: new Date().toISOString()
      };
      
      await request(self.app)
        .post('/api/v1/treatments')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('X-Tenant-Subdomain', 'testclinic1')
        .send(treatment)
        .expect(200);
    });
    
    it('caregiver should be able to create treatments', async function() {
      const treatment = {
        eventType: 'Meal Bolus',
        insulin: 3.0,
        carbs: 45,
        created_at: new Date().toISOString()
      };
      
      await request(self.app)
        .post('/api/v1/treatments')
        .set('Authorization', `Bearer ${caregiverToken}`)
        .set('X-Tenant-Subdomain', 'testclinic1')
        .send(treatment)
        .expect(200);
    });
    
    it('viewer should not be able to create treatments', async function() {
      const treatment = {
        eventType: 'Meal Bolus',
        insulin: 3.0,
        carbs: 45,
        created_at: new Date().toISOString()
      };
      
      await request(self.app)
        .post('/api/v1/treatments')
        .set('Authorization', `Bearer ${viewerToken}`)
        .set('X-Tenant-Subdomain', 'testclinic1')
        .send(treatment)
        .expect(403);
    });
    
    it('viewer should be able to read treatments', async function() {
      await request(self.app)
        .get('/api/v1/treatments')
        .set('Authorization', `Bearer ${viewerToken}`)
        .set('X-Tenant-Subdomain', 'testclinic1')
        .expect(200);
    });
  });
});
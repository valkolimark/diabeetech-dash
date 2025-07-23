'use strict';

const crypto = require('crypto');
const _ = require('lodash');

function init(env, ctx) {
  const mongo = ctx.store;
  
  const TENANT_COLLECTION = 'tenants';
  
  const api = {};

  // Tenant schema definition
  const tenantSchema = {
    tenantId: String,       // UUID
    tenantName: String,     // Display name
    subdomain: String,      // Unique subdomain
    databaseName: String,   // MongoDB database name
    createdAt: Date,
    updatedAt: Date,
    isActive: Boolean,
    isAdmin: Boolean,       // Whether this tenant has admin tools access
    settings: Object,       // Tenant-specific configurations
    contactEmail: String,
    maxUsers: Number,       // User limit per tenant
    features: Array,        // Enabled features for this tenant
    apiSecret: String,      // Tenant-specific API secret (plain text)
    apiSecretHash: String   // SHA-1 hash of API secret for authentication
  };

  // Generate unique tenant ID
  api.generateTenantId = function() {
    return crypto.randomUUID();
  };

  // Generate database name from subdomain
  api.generateDatabaseName = function(subdomain) {
    const prefix = env.TENANT_DB_PREFIX || 'nightscout-tenant-';
    return prefix + subdomain.toLowerCase().replace(/[^a-z0-9]/g, '-');
  };

  // Generate SHA-1 hash for API secret
  api.hashApiSecret = function(apiSecret) {
    if (!apiSecret) return null;
    return crypto.createHash('sha1').update(apiSecret).digest('hex').toLowerCase();
  };

  // Validate API secret
  api.validateApiSecret = function(tenant, apiSecretOrHash) {
    if (!tenant || !apiSecretOrHash) return false;
    
    // Check if it's already a hash (40 characters hex)
    if (/^[a-f0-9]{40}$/.test(apiSecretOrHash)) {
      return tenant.apiSecretHash === apiSecretOrHash.toLowerCase();
    }
    
    // Otherwise, hash the plain text and compare
    return tenant.apiSecretHash === api.hashApiSecret(apiSecretOrHash);
  };

  // Create new tenant
  api.create = async function(tenantData) {
    const collection = mongo.collection(TENANT_COLLECTION);
    
    // Generate API secret if not provided
    const apiSecret = tenantData.apiSecret || crypto.randomBytes(16).toString('hex');
    
    const tenant = {
      tenantId: api.generateTenantId(),
      tenantName: tenantData.tenantName,
      subdomain: tenantData.subdomain.toLowerCase(),
      databaseName: api.generateDatabaseName(tenantData.subdomain),
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true,
      isAdmin: tenantData.isAdmin || false,
      settings: tenantData.settings || {},
      contactEmail: tenantData.contactEmail,
      maxUsers: tenantData.maxUsers || 10,
      features: tenantData.features || ['core'],
      apiSecret: apiSecret,
      apiSecretHash: api.hashApiSecret(apiSecret)
    };

    // Validate subdomain uniqueness
    const existing = await collection.findOne({ subdomain: tenant.subdomain });
    if (existing) {
      throw new Error('Subdomain already exists');
    }

    // Validate subdomain format
    if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(tenant.subdomain)) {
      throw new Error('Invalid subdomain format. Use only lowercase letters, numbers, and hyphens');
    }

    await collection.insertOne(tenant);
    return tenant;
  };

  // Find tenant by subdomain
  api.findBySubdomain = async function(subdomain) {
    const collection = mongo.collection(TENANT_COLLECTION);
    return await collection.findOne({ 
      subdomain: subdomain.toLowerCase(),
      isActive: true 
    });
  };

  // Find tenant by ID
  api.findById = async function(tenantId) {
    const collection = mongo.collection(TENANT_COLLECTION);
    return await collection.findOne({ 
      tenantId: tenantId,
      isActive: true 
    });
  };

  // Update tenant
  api.update = async function(tenantId, updates) {
    const collection = mongo.collection(TENANT_COLLECTION);
    
    // Don't allow changing certain fields
    delete updates.tenantId;
    delete updates.subdomain;
    delete updates.databaseName;
    delete updates.createdAt;
    
    updates.updatedAt = new Date();
    
    const result = await collection.updateOne(
      { tenantId: tenantId },
      { $set: updates }
    );
    
    return result.modifiedCount > 0;
  };

  // Deactivate tenant (soft delete)
  api.deactivate = async function(tenantId) {
    return await api.update(tenantId, { isActive: false });
  };

  // List all active tenants
  api.listActive = async function(limit = 100, skip = 0) {
    const collection = mongo.collection(TENANT_COLLECTION);
    return await collection.find({ isActive: true })
      .limit(limit)
      .skip(skip)
      .toArray();
  };

  // Check if tenant has feature enabled
  api.hasFeature = function(tenant, feature) {
    return tenant.features && tenant.features.includes(feature);
  };

  // Update API secret for a tenant
  api.updateApiSecret = async function(tenantId, apiSecret) {
    const collection = mongo.collection(TENANT_COLLECTION);
    
    const updates = {
      apiSecret: apiSecret,
      apiSecretHash: apiSecret ? api.hashApiSecret(apiSecret) : null,
      updatedAt: new Date()
    };
    
    const result = await collection.updateOne(
      { tenantId: tenantId },
      { $set: updates }
    );
    
    return result.modifiedCount > 0;
  };

  // Ensure indexes
  api.ensureIndexes = async function() {
    const collection = mongo.collection(TENANT_COLLECTION);
    await collection.createIndex({ subdomain: 1 }, { unique: true });
    await collection.createIndex({ tenantId: 1 }, { unique: true });
    await collection.createIndex({ isActive: 1 });
    await collection.createIndex({ createdAt: -1 });
  };

  return api;
}

module.exports = init;
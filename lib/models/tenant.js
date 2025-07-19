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
    settings: Object,       // Tenant-specific configurations
    contactEmail: String,
    maxUsers: Number,       // User limit per tenant
    features: Array         // Enabled features for this tenant
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

  // Create new tenant
  api.create = async function(tenantData) {
    const collection = mongo.collection(TENANT_COLLECTION);
    
    const tenant = {
      tenantId: api.generateTenantId(),
      tenantName: tenantData.tenantName,
      subdomain: tenantData.subdomain.toLowerCase(),
      databaseName: api.generateDatabaseName(tenantData.subdomain),
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true,
      settings: tenantData.settings || {},
      contactEmail: tenantData.contactEmail,
      maxUsers: tenantData.maxUsers || 10,
      features: tenantData.features || ['core']
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
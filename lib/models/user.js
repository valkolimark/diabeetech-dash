'use strict';

const crypto = require('crypto');
const _ = require('lodash');

function init(env, ctx) {
  const mongo = ctx.store;
  
  const USER_COLLECTION = 'users';
  
  const api = {};

  // User roles
  api.ROLES = {
    ADMIN: 'admin',           // Full tenant management
    CAREGIVER: 'caregiver',   // Can view and add data
    VIEWER: 'viewer'          // Read-only access
  };

  // User schema definition
  const userSchema = {
    userId: String,           // UUID
    tenantId: String,         // Foreign key to tenant
    email: String,            // Unique within tenant
    passwordHash: String,     // Hashed password
    role: String,             // User role
    isActive: Boolean,
    createdAt: Date,
    updatedAt: Date,
    lastLogin: Date,
    profile: {
      firstName: String,
      lastName: String,
      displayName: String,
      timezone: String,
      units: String           // mg/dl or mmol/l
    },
    permissions: Array,       // Additional granular permissions
    resetToken: String,       // Password reset token
    resetTokenExpires: Date,
    emailVerified: Boolean,
    emailVerificationToken: String
  };

  // Generate unique user ID
  api.generateUserId = function() {
    return crypto.randomUUID();
  };

  // Hash password using existing Nightscout approach
  api.hashPassword = function(password) {
    // Use the same hashing as Nightscout's API_SECRET
    return crypto.createHash('sha1').update(password).digest('hex');
  };

  // Verify password
  api.verifyPassword = function(password, hash) {
    return api.hashPassword(password) === hash;
  };

  // Create new user
  api.create = async function(userData) {
    const collection = mongo.collection(USER_COLLECTION);
    
    const user = {
      userId: api.generateUserId(),
      tenantId: userData.tenantId,
      email: userData.email.toLowerCase(),
      passwordHash: api.hashPassword(userData.password),
      role: userData.role || api.ROLES.VIEWER,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastLogin: null,
      profile: userData.profile || {},
      permissions: userData.permissions || [],
      resetToken: null,
      resetTokenExpires: null,
      emailVerified: false,
      emailVerificationToken: crypto.randomBytes(32).toString('hex')
    };

    // Validate email uniqueness within tenant
    const existing = await collection.findOne({ 
      tenantId: user.tenantId,
      email: user.email 
    });
    if (existing) {
      throw new Error('Email already exists for this tenant');
    }

    // Validate role
    if (!Object.values(api.ROLES).includes(user.role)) {
      throw new Error('Invalid user role');
    }

    await collection.insertOne(user);
    
    // Remove sensitive data before returning
    delete user.passwordHash;
    delete user.emailVerificationToken;
    
    return user;
  };

  // Find user by email within tenant
  api.findByEmail = async function(tenantId, email) {
    const collection = mongo.collection(USER_COLLECTION);
    return await collection.findOne({ 
      tenantId: tenantId,
      email: email.toLowerCase(),
      isActive: true 
    });
  };

  // Find user by ID
  api.findById = async function(userId) {
    const collection = mongo.collection(USER_COLLECTION);
    return await collection.findOne({ 
      userId: userId,
      isActive: true 
    });
  };

  // Authenticate user
  api.authenticate = async function(tenantId, email, password) {
    const user = await api.findByEmail(tenantId, email);
    
    if (!user) {
      return null;
    }

    if (!api.verifyPassword(password, user.passwordHash)) {
      return null;
    }

    // Update last login
    await api.updateLastLogin(user.userId);
    
    // Remove sensitive data
    delete user.passwordHash;
    delete user.resetToken;
    delete user.emailVerificationToken;
    
    return user;
  };

  // Update last login timestamp
  api.updateLastLogin = async function(userId) {
    const collection = mongo.collection(USER_COLLECTION);
    await collection.updateOne(
      { userId: userId },
      { $set: { lastLogin: new Date() } }
    );
  };

  // Update user
  api.update = async function(userId, updates) {
    const collection = mongo.collection(USER_COLLECTION);
    
    // Don't allow changing certain fields
    delete updates.userId;
    delete updates.tenantId;
    delete updates.createdAt;
    delete updates.passwordHash;
    
    updates.updatedAt = new Date();
    
    const result = await collection.updateOne(
      { userId: userId },
      { $set: updates }
    );
    
    return result.modifiedCount > 0;
  };

  // Change password
  api.changePassword = async function(userId, newPassword) {
    const collection = mongo.collection(USER_COLLECTION);
    const passwordHash = api.hashPassword(newPassword);
    
    const result = await collection.updateOne(
      { userId: userId },
      { 
        $set: { 
          passwordHash: passwordHash,
          updatedAt: new Date(),
          resetToken: null,
          resetTokenExpires: null
        } 
      }
    );
    
    return result.modifiedCount > 0;
  };

  // Generate password reset token
  api.generateResetToken = async function(userId) {
    const collection = mongo.collection(USER_COLLECTION);
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpires = new Date(Date.now() + 3600000); // 1 hour
    
    await collection.updateOne(
      { userId: userId },
      { 
        $set: { 
          resetToken: resetToken,
          resetTokenExpires: resetTokenExpires
        } 
      }
    );
    
    return resetToken;
  };

  // Deactivate user (soft delete)
  api.deactivate = async function(userId) {
    return await api.update(userId, { isActive: false });
  };

  // List users for tenant
  api.listByTenant = async function(tenantId, limit = 100, skip = 0) {
    const collection = mongo.collection(USER_COLLECTION);
    const users = await collection.find({ 
      tenantId: tenantId,
      isActive: true 
    })
      .limit(limit)
      .skip(skip)
      .toArray();
    
    // Remove sensitive data
    return users.map(user => {
      delete user.passwordHash;
      delete user.resetToken;
      delete user.emailVerificationToken;
      return user;
    });
  };

  // Count users for tenant
  api.countByTenant = async function(tenantId) {
    const collection = mongo.collection(USER_COLLECTION);
    return await collection.countDocuments({ 
      tenantId: tenantId,
      isActive: true 
    });
  };

  // Check if user has permission
  api.hasPermission = function(user, permission) {
    // Admins have all permissions
    if (user.role === api.ROLES.ADMIN) {
      return true;
    }
    
    // Check specific permissions
    return user.permissions && user.permissions.includes(permission);
  };

  // Ensure indexes
  api.ensureIndexes = async function() {
    const collection = mongo.collection(USER_COLLECTION);
    await collection.createIndex({ tenantId: 1, email: 1 }, { unique: true });
    await collection.createIndex({ userId: 1 }, { unique: true });
    await collection.createIndex({ tenantId: 1, isActive: 1 });
    await collection.createIndex({ resetToken: 1 });
    await collection.createIndex({ emailVerificationToken: 1 });
  };

  return api;
}

module.exports = init;
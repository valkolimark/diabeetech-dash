'use strict';

const express = require('express');
const _ = require('lodash');
const validator = require('validator');

function configure(env, ctx) {
  const router = express.Router();
  const tenantModel = require('../../models/tenant')(env, ctx);
  const userModel = require('../../models/user')(env, ctx);
  const connectionManager = require('../../utils/connectionManager')(env);
  const auth = require('../../middleware/auth')(env, ctx);
  const tenantResolver = require('../../middleware/tenantResolver')(env, ctx);
  
  // POST /api/tenants/register - Public endpoint for new tenant registration
  router.post('/register', express.json(), async (req, res) => {
    try {
      const { 
        tenantName, 
        subdomain, 
        adminEmail, 
        adminPassword,
        contactEmail,
        features
      } = req.body;
      
      // Validate required fields
      if (!tenantName || !subdomain || !adminEmail || !adminPassword) {
        return res.status(400).json({
          status: 400,
          message: 'Missing required fields',
          required: ['tenantName', 'subdomain', 'adminEmail', 'adminPassword']
        });
      }
      
      // Validate email
      if (!validator.isEmail(adminEmail)) {
        return res.status(400).json({
          status: 400,
          message: 'Invalid admin email address'
        });
      }
      
      // Validate subdomain format
      if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(subdomain)) {
        return res.status(400).json({
          status: 400,
          message: 'Invalid subdomain. Use only lowercase letters, numbers, and hyphens'
        });
      }
      
      // Validate password strength
      if (adminPassword.length < 8) {
        return res.status(400).json({
          status: 400,
          message: 'Password must be at least 8 characters long'
        });
      }
      
      // Create tenant
      const tenant = await tenantModel.create({
        tenantName,
        subdomain,
        contactEmail: contactEmail || adminEmail,
        features: features || ['core']
      });
      
      // Create tenant database
      await connectionManager.createTenantDatabase(tenant);
      
      // Create admin user
      const adminUser = await userModel.create({
        tenantId: tenant.tenantId,
        email: adminEmail,
        password: adminPassword,
        role: userModel.ROLES.ADMIN,
        profile: {
          displayName: 'Administrator',
          units: 'mg/dl'
        }
      });
      
      // Generate tokens for immediate login
      const tokens = auth.generateToken(adminUser, tenant);
      
      res.status(201).json({
        message: 'Tenant created successfully',
        tenant: {
          tenantId: tenant.tenantId,
          tenantName: tenant.tenantName,
          subdomain: tenant.subdomain,
          url: `https://${tenant.subdomain}.${env.BASE_DOMAIN || 'nightscout.com'}`
        },
        admin: {
          userId: adminUser.userId,
          email: adminUser.email,
          role: adminUser.role
        },
        auth: tokens
      });
    } catch (err) {
      console.error('Tenant registration error:', err);
      
      if (err.message === 'Subdomain already exists') {
        return res.status(409).json({
          status: 409,
          message: 'Subdomain already taken',
          error: 'Please choose a different subdomain'
        });
      }
      
      res.status(500).json({
        status: 500,
        message: 'Failed to create tenant',
        error: err.message
      });
    }
  });
  
  // All routes below require authentication and tenant context
  router.use(tenantResolver);
  router.use(auth.authenticate);
  
  // GET /api/tenants/current - Get current tenant info
  router.get('/current', async (req, res) => {
    try {
      const userCount = await userModel.countByTenant(req.tenant.tenantId);
      
      res.json({
        tenant: {
          tenantId: req.tenant.tenantId,
          tenantName: req.tenant.tenantName,
          subdomain: req.tenant.subdomain,
          createdAt: req.tenant.createdAt,
          features: req.tenant.features,
          settings: req.tenant.settings
        },
        stats: {
          userCount: userCount,
          maxUsers: req.tenant.maxUsers
        }
      });
    } catch (err) {
      res.status(500).json({
        status: 500,
        message: 'Failed to get tenant info',
        error: err.message
      });
    }
  });
  
  // PUT /api/tenants/current - Update current tenant (admin only)
  router.put('/current', auth.authorize('admin'), express.json(), async (req, res) => {
    try {
      const updates = _.pick(req.body, ['tenantName', 'contactEmail', 'settings']);
      
      const success = await tenantModel.update(req.tenant.tenantId, updates);
      if (success) {
        const updated = await tenantModel.findById(req.tenant.tenantId);
        res.json({
          message: 'Tenant updated successfully',
          tenant: _.omit(updated, ['_id', 'databaseName'])
        });
      } else {
        res.status(400).json({
          status: 400,
          message: 'Failed to update tenant'
        });
      }
    } catch (err) {
      res.status(500).json({
        status: 500,
        message: 'Failed to update tenant',
        error: err.message
      });
    }
  });
  
  // GET /api/tenants/users - List users in tenant (admin only)
  router.get('/users', auth.authorize('admin'), async (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 100;
      const skip = parseInt(req.query.skip) || 0;
      
      const users = await userModel.listByTenant(req.tenant.tenantId, limit, skip);
      const total = await userModel.countByTenant(req.tenant.tenantId);
      
      res.json({
        users: users,
        pagination: {
          limit: limit,
          skip: skip,
          total: total
        }
      });
    } catch (err) {
      res.status(500).json({
        status: 500,
        message: 'Failed to list users',
        error: err.message
      });
    }
  });
  
  // POST /api/tenants/users - Create new user (admin only)
  router.post('/users', auth.authorize('admin'), express.json(), async (req, res) => {
    try {
      const { email, password, role, profile } = req.body;
      
      // Validate required fields
      if (!email || !password) {
        return res.status(400).json({
          status: 400,
          message: 'Email and password required'
        });
      }
      
      // Validate email
      if (!validator.isEmail(email)) {
        return res.status(400).json({
          status: 400,
          message: 'Invalid email address'
        });
      }
      
      // Validate password
      if (password.length < 8) {
        return res.status(400).json({
          status: 400,
          message: 'Password must be at least 8 characters long'
        });
      }
      
      // Check user limit
      const userCount = await userModel.countByTenant(req.tenant.tenantId);
      if (userCount >= req.tenant.maxUsers) {
        return res.status(403).json({
          status: 403,
          message: 'User limit reached',
          error: `Maximum ${req.tenant.maxUsers} users allowed for this tenant`
        });
      }
      
      // Create user
      const user = await userModel.create({
        tenantId: req.tenant.tenantId,
        email,
        password,
        role: role || userModel.ROLES.VIEWER,
        profile: profile || {}
      });
      
      res.status(201).json({
        message: 'User created successfully',
        user: user
      });
    } catch (err) {
      if (err.message === 'Email already exists for this tenant') {
        return res.status(409).json({
          status: 409,
          message: 'Email already in use',
          error: 'A user with this email already exists'
        });
      }
      
      res.status(500).json({
        status: 500,
        message: 'Failed to create user',
        error: err.message
      });
    }
  });
  
  // PUT /api/tenants/users/:userId - Update user (admin only)
  router.put('/users/:userId', auth.authorize('admin'), express.json(), async (req, res) => {
    try {
      const { userId } = req.params;
      const updates = _.pick(req.body, ['role', 'profile', 'isActive', 'permissions']);
      
      // Verify user belongs to tenant
      const user = await userModel.findById(userId);
      if (!user || user.tenantId !== req.tenant.tenantId) {
        return res.status(404).json({
          status: 404,
          message: 'User not found'
        });
      }
      
      // Prevent demoting last admin
      if (updates.role && updates.role !== 'admin' && user.role === 'admin') {
        const adminCount = await ctx.store.master.collection('users').countDocuments({
          tenantId: req.tenant.tenantId,
          role: 'admin',
          isActive: true
        });
        
        if (adminCount <= 1) {
          return res.status(400).json({
            status: 400,
            message: 'Cannot remove last admin',
            error: 'At least one admin user is required'
          });
        }
      }
      
      const success = await userModel.update(userId, updates);
      if (success) {
        const updated = await userModel.findById(userId);
        res.json({
          message: 'User updated successfully',
          user: _.omit(updated, ['passwordHash', 'resetToken', 'emailVerificationToken'])
        });
      } else {
        res.status(400).json({
          status: 400,
          message: 'Failed to update user'
        });
      }
    } catch (err) {
      res.status(500).json({
        status: 500,
        message: 'Failed to update user',
        error: err.message
      });
    }
  });
  
  // DELETE /api/tenants/users/:userId - Deactivate user (admin only)
  router.delete('/users/:userId', auth.authorize('admin'), async (req, res) => {
    try {
      const { userId } = req.params;
      
      // Verify user belongs to tenant
      const user = await userModel.findById(userId);
      if (!user || user.tenantId !== req.tenant.tenantId) {
        return res.status(404).json({
          status: 404,
          message: 'User not found'
        });
      }
      
      // Prevent deleting self
      if (user.userId === req.user.userId) {
        return res.status(400).json({
          status: 400,
          message: 'Cannot delete yourself'
        });
      }
      
      // Prevent deleting last admin
      if (user.role === 'admin') {
        const adminCount = await ctx.store.master.collection('users').countDocuments({
          tenantId: req.tenant.tenantId,
          role: 'admin',
          isActive: true
        });
        
        if (adminCount <= 1) {
          return res.status(400).json({
            status: 400,
            message: 'Cannot delete last admin',
            error: 'At least one admin user is required'
          });
        }
      }
      
      const success = await userModel.deactivate(userId);
      if (success) {
        res.json({
          message: 'User deactivated successfully'
        });
      } else {
        res.status(400).json({
          status: 400,
          message: 'Failed to deactivate user'
        });
      }
    } catch (err) {
      res.status(500).json({
        status: 500,
        message: 'Failed to deactivate user',
        error: err.message
      });
    }
  });
  
  return router;
}

module.exports = configure;
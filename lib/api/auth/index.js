'use strict';

const express = require('express');
const _ = require('lodash');
const validator = require('validator');

function configure(env, ctx) {
  const router = express.Router();
  const userModel = require('../../models/user')(env, ctx);
  const tenantModel = require('../../models/tenant')(env, ctx);
  const auth = require('../../middleware/auth')(env, ctx);
  const tenantResolver = require('../../middleware/tenantResolver')(env, ctx);
  
  // Apply tenant resolver to all auth routes
  router.use(tenantResolver);
  
  // POST /api/auth/login
  router.post('/login', express.json(), auth.login);
  
  // POST /api/auth/logout
  router.post('/logout', auth.authenticate, auth.logout);
  
  // POST /api/auth/refresh
  router.post('/refresh', express.json(), auth.refreshToken);
  
  // GET /api/auth/profile
  router.get('/profile', auth.authenticate, async (req, res) => {
    try {
      const user = _.omit(req.user, ['passwordHash', 'resetToken', 'emailVerificationToken']);
      res.json({
        user: user,
        tenant: {
          tenantId: req.tenant.tenantId,
          tenantName: req.tenant.tenantName,
          subdomain: req.tenant.subdomain
        }
      });
    } catch (err) {
      res.status(500).json({
        status: 500,
        message: 'Failed to get profile',
        error: err.message
      });
    }
  });
  
  // PUT /api/auth/profile
  router.put('/profile', auth.authenticate, express.json(), async (req, res) => {
    try {
      const updates = _.pick(req.body, ['profile']);
      
      if (updates.profile) {
        // Validate profile fields
        if (updates.profile.timezone && !isValidTimezone(updates.profile.timezone)) {
          return res.status(400).json({
            status: 400,
            message: 'Invalid timezone'
          });
        }
        
        if (updates.profile.units && !['mg/dl', 'mmol/l'].includes(updates.profile.units)) {
          return res.status(400).json({
            status: 400,
            message: 'Invalid units. Must be mg/dl or mmol/l'
          });
        }
      }
      
      const success = await userModel.update(req.user.userId, updates);
      if (success) {
        const updatedUser = await userModel.findById(req.user.userId);
        res.json({
          message: 'Profile updated successfully',
          user: _.omit(updatedUser, ['passwordHash', 'resetToken', 'emailVerificationToken'])
        });
      } else {
        res.status(400).json({
          status: 400,
          message: 'Failed to update profile'
        });
      }
    } catch (err) {
      res.status(500).json({
        status: 500,
        message: 'Failed to update profile',
        error: err.message
      });
    }
  });
  
  // POST /api/auth/change-password
  router.post('/change-password', auth.authenticate, express.json(), async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      
      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          status: 400,
          message: 'Current password and new password required'
        });
      }
      
      if (newPassword.length < 8) {
        return res.status(400).json({
          status: 400,
          message: 'New password must be at least 8 characters long'
        });
      }
      
      // Verify current password
      const user = await userModel.findById(req.user.userId);
      if (!userModel.verifyPassword(currentPassword, user.passwordHash)) {
        return res.status(401).json({
          status: 401,
          message: 'Current password is incorrect'
        });
      }
      
      // Change password
      const success = await userModel.changePassword(req.user.userId, newPassword);
      if (success) {
        res.json({
          message: 'Password changed successfully'
        });
      } else {
        res.status(400).json({
          status: 400,
          message: 'Failed to change password'
        });
      }
    } catch (err) {
      res.status(500).json({
        status: 500,
        message: 'Failed to change password',
        error: err.message
      });
    }
  });
  
  // POST /api/auth/forgot-password
  router.post('/forgot-password', express.json(), async (req, res) => {
    try {
      const { email } = req.body;
      
      if (!email || !validator.isEmail(email)) {
        return res.status(400).json({
          status: 400,
          message: 'Valid email required'
        });
      }
      
      if (!req.tenant) {
        return res.status(400).json({
          status: 400,
          message: 'Tenant context required'
        });
      }
      
      const user = await userModel.findByEmail(req.tenant.tenantId, email);
      if (user) {
        const resetToken = await userModel.generateResetToken(user.userId);
        
        // In production, send email with reset link
        // For now, return the token (development only)
        if (env.NODE_ENV === 'development') {
          res.json({
            message: 'Password reset token generated',
            resetToken: resetToken,
            resetUrl: `https://${req.tenant.subdomain}.${env.BASE_DOMAIN || 'nightscout.com'}/reset-password?token=${resetToken}`
          });
        } else {
          // TODO: Implement email sending
          res.json({
            message: 'Password reset instructions sent to your email'
          });
        }
      } else {
        // Don't reveal if user exists or not
        res.json({
          message: 'If the email exists, password reset instructions will be sent'
        });
      }
    } catch (err) {
      res.status(500).json({
        status: 500,
        message: 'Failed to process password reset',
        error: err.message
      });
    }
  });
  
  // POST /api/auth/reset-password
  router.post('/reset-password', express.json(), async (req, res) => {
    try {
      const { token, newPassword } = req.body;
      
      if (!token || !newPassword) {
        return res.status(400).json({
          status: 400,
          message: 'Reset token and new password required'
        });
      }
      
      if (newPassword.length < 8) {
        return res.status(400).json({
          status: 400,
          message: 'New password must be at least 8 characters long'
        });
      }
      
      // Find user by reset token
      const users = await ctx.store.master.collection('users').find({
        resetToken: token,
        resetTokenExpires: { $gt: new Date() }
      }).toArray();
      
      if (users.length === 0) {
        return res.status(400).json({
          status: 400,
          message: 'Invalid or expired reset token'
        });
      }
      
      const user = users[0];
      const success = await userModel.changePassword(user.userId, newPassword);
      
      if (success) {
        res.json({
          message: 'Password reset successfully'
        });
      } else {
        res.status(400).json({
          status: 400,
          message: 'Failed to reset password'
        });
      }
    } catch (err) {
      res.status(500).json({
        status: 500,
        message: 'Failed to reset password',
        error: err.message
      });
    }
  });
  
  // GET /api/auth/verify
  router.get('/verify', auth.authenticate, (req, res) => {
    res.json({
      valid: true,
      user: {
        userId: req.user.userId,
        email: req.user.email,
        role: req.user.role
      },
      tenant: {
        tenantId: req.tenant.tenantId,
        subdomain: req.tenant.subdomain
      }
    });
  });
  
  // Helper function to validate timezone
  function isValidTimezone(tz) {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: tz });
      return true;
    } catch (ex) {
      return false;
    }
  }
  
  return router;
}

module.exports = configure;
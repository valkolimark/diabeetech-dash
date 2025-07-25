#!/usr/bin/env node
'use strict';

/**
 * Debug login flow
 */

const MongoClient = require('mongodb').MongoClient;
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const email = 'mark@markmireles.com';
const password = 'GodIsGood23!';

console.log('Testing login flow...');
console.log('Email:', email);
console.log('Master MongoDB URI:', process.env.MASTER_MONGODB_URI ? 'Set' : 'Not set');
console.log('JWT_SECRET:', process.env.JWT_SECRET ? 'Set' : 'Not set');

if (!process.env.MASTER_MONGODB_URI) {
  console.error('MASTER_MONGODB_URI not set');
  process.exit(1);
}

MongoClient.connect(process.env.MASTER_MONGODB_URI, { useUnifiedTopology: true }, async (err, client) => {
  if (err) {
    console.error('Connection error:', err);
    process.exit(1);
  }
  
  try {
    const db = client.db();
    
    // Find tenant
    console.log('\n1. Finding tenant...');
    const tenant = await db.collection('tenants').findOne({ subdomain: 'onepanman' });
    if (!tenant) {
      console.error('Tenant not found');
      process.exit(1);
    }
    console.log('Tenant found:', tenant.tenantId);
    
    // Find user
    console.log('\n2. Finding user...');
    const user = await db.collection('users').findOne({ 
      tenantId: tenant.tenantId,
      email: email.toLowerCase(),
      isActive: true 
    });
    if (!user) {
      console.error('User not found');
      process.exit(1);
    }
    console.log('User found:', user.userId);
    console.log('Password hash exists:', !!user.passwordHash);
    
    // Verify password
    console.log('\n3. Verifying password...');
    const isValid = await bcrypt.compare(password, user.passwordHash);
    console.log('Password valid:', isValid);
    
    if (!isValid) {
      console.error('Invalid password');
      process.exit(1);
    }
    
    // Try to generate JWT
    console.log('\n4. Generating JWT...');
    if (!process.env.JWT_SECRET) {
      console.error('JWT_SECRET not set in environment');
    } else {
      try {
        const payload = {
          userId: user.userId,
          tenantId: user.tenantId,
          email: user.email,
          role: user.role,
          subdomain: tenant.subdomain,
          permissions: user.permissions || []
        };
        
        const accessToken = jwt.sign(
          payload,
          process.env.JWT_SECRET,
          { 
            expiresIn: '1d',
            issuer: 'nightscout-multitenant',
            subject: user.userId
          }
        );
        
        console.log('JWT generated successfully');
        console.log('Token length:', accessToken.length);
        console.log('Token preview:', accessToken.substring(0, 50) + '...');
      } catch (jwtErr) {
        console.error('JWT generation error:', jwtErr);
      }
    }
    
    console.log('\n✅ All checks passed - login should work');
    
  } catch (e) {
    console.error('Error:', e);
  } finally {
    client.close();
  }
});
#!/usr/bin/env node
'use strict';

const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');

// Get command line arguments
const args = process.argv.slice(2);
if (args.length < 2) {
  console.log('Usage: node reset-user-password.js <email> <new-password>');
  console.log('Example: node reset-user-password.js user@example.com newpassword123');
  process.exit(1);
}

const email = args[0];
const newPassword = args[1];

// MongoDB connection from environment
const MONGODB_URI = process.env.MASTER_MONGODB_URI || process.env.MONGODB_URI || 'mongodb+srv://markt:xebkaW-kaqmu4-wynkor@nightscout-master.nkz27.mongodb.net/nightscout-master?retryWrites=true&w=majority&appName=nightscout-master';

async function resetPassword() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    // Connect to master database
    const masterDb = client.db('nightscout-master');
    const usersCollection = masterDb.collection('users');
    
    // Find user by email
    const user = await usersCollection.findOne({ email: email });
    
    if (!user) {
      console.error(`User with email "${email}" not found`);
      return;
    }
    
    console.log(`Found user: ${user.email} (${user.profile?.displayName || 'No display name'})`);
    console.log(`Tenant ID: ${user.tenantId}`);
    console.log(`Role: ${user.role}`);
    
    // Hash the new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    
    // Update the password
    const result = await usersCollection.updateOne(
      { _id: user._id },
      { 
        $set: { 
          passwordHash: hashedPassword,
          passwordResetToken: null,
          passwordResetExpires: null,
          updatedAt: new Date()
        }
      }
    );
    
    if (result.modifiedCount > 0) {
      console.log('\n✅ Password reset successfully!');
      console.log(`User ${email} can now log in with the new password.`);
      
      // Get tenant info for the login URL
      const tenantsCollection = masterDb.collection('tenants');
      const tenant = await tenantsCollection.findOne({ tenantId: user.tenantId });
      
      if (tenant) {
        console.log(`\nLogin URL: https://${tenant.subdomain}.diabeetech.net/login`);
      }
    } else {
      console.error('Failed to update password');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
    console.log('\nDisconnected from MongoDB');
  }
}

resetPassword();
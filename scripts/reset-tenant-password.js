#!/usr/bin/env node
'use strict';

const bcrypt = require('bcryptjs');
const { MongoClient } = require('mongodb');
const nodemailer = require('nodemailer');

async function resetPassword() {
  const MASTER_DB_URI = process.env.MASTER_MONGODB_URI;
  const subdomain = process.argv[2];
  
  if (!subdomain) {
    console.log('Usage: node reset-tenant-password.js <subdomain>');
    console.log('Example: node reset-tenant-password.js clinic1');
    process.exit(1);
  }
  
  const client = new MongoClient(MASTER_DB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });
  
  try {
    await client.connect();
    const db = client.db();
    
    // Find tenant
    const tenant = await db.collection('tenants').findOne({ subdomain });
    if (!tenant) {
      console.error(`Tenant '${subdomain}' not found`);
      process.exit(1);
    }
    
    // Find admin user
    const adminUser = await db.collection('users').findOne({ 
      tenantId: tenant.tenantId, 
      role: 'admin' 
    });
    
    if (!adminUser) {
      console.error(`No admin user found for tenant '${subdomain}'`);
      process.exit(1);
    }
    
    // Generate new password
    const newPassword = generateSecurePassword();
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // Update password
    await db.collection('users').updateOne(
      { _id: adminUser._id },
      { 
        $set: { 
          password: hashedPassword,
          updatedAt: new Date()
        }
      }
    );
    
    console.log('\n✅ Password reset successful!');
    console.log('==========================');
    console.log(`Tenant: ${tenant.name}`);
    console.log(`URL: https://${tenant.subdomain}.diabeetech.net`);
    console.log(`Admin Email: ${adminUser.email}`);
    console.log(`New Password: ${newPassword}`);
    console.log('\n⚠️  Save this password securely!');
    
    // Send email if configured
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      const transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: parseInt(process.env.EMAIL_PORT),
        secure: process.env.EMAIL_SECURE === 'true',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS
        }
      });
      
      try {
        await transporter.sendMail({
          from: process.env.EMAIL_FROM,
          to: 'mark@p5400.com',
          subject: `Password Reset - ${tenant.name}`,
          html: `
            <h2>Password Reset for ${tenant.name}</h2>
            <p>The admin password has been reset.</p>
            <ul>
              <li><strong>URL:</strong> <a href="https://${tenant.subdomain}.diabeetech.net">https://${tenant.subdomain}.diabeetech.net</a></li>
              <li><strong>Admin Email:</strong> ${adminUser.email}</li>
              <li><strong>New Password:</strong> <code>${newPassword}</code></li>
            </ul>
            <p>Please change this password after logging in.</p>
          `
        });
        console.log('\n📧 Password reset email sent to mark@p5400.com');
      } catch (error) {
        console.log('\n⚠️  Could not send email:', error.message);
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

function generateSecurePassword() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < 16; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

if (require.main === module) {
  resetPassword().catch(console.error);
}
#!/usr/bin/env node
'use strict';

const MongoClient = require('mongodb').MongoClient;
const bcrypt = require('bcryptjs');

const uri = process.env.MONGODB_URI;
const email = process.argv[2] || 'mark@markmireles.com';
const newPassword = process.argv[3] || 'GodIsGood23!';

if (!uri) {
  console.error('MONGODB_URI environment variable not set');
  process.exit(1);
}

console.log('Connecting to MongoDB to reset user password...');
console.log('Email:', email);

MongoClient.connect(uri, { useUnifiedTopology: true }, async (err, client) => {
  if (err) {
    console.error('Connection error:', err);
    process.exit(1);
  }
  
  try {
    const db = client.db();
    
    // Find the user first
    const user = await db.collection('users').findOne({ email: email });
    if (!user) {
      console.error('User not found:', email);
      process.exit(1);
    }
    
    console.log('Found user:', user.userId);
    
    // Hash the new password
    const passwordHash = await bcrypt.hash(newPassword, 10);
    
    // Update the password
    const result = await db.collection('users').updateOne(
      { email: email },
      { 
        $set: { 
          passwordHash: passwordHash,
          updatedAt: new Date()
        }
      }
    );
    
    console.log('Password update result:', JSON.stringify(result));
    console.log('Password reset successfully for:', email);
    console.log('New password:', newPassword);
    
  } catch (e) {
    console.error('Error:', e);
  } finally {
    client.close();
  }
});
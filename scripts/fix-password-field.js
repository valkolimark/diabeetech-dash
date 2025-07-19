#!/usr/bin/env node
'use strict';

const { MongoClient } = require('mongodb');

async function fixPasswordField() {
  const MASTER_DB_URI = process.env.MASTER_MONGODB_URI;
  
  if (!MASTER_DB_URI) {
    console.error('MASTER_MONGODB_URI not set');
    process.exit(1);
  }

  const client = new MongoClient(MASTER_DB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });

  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db();
    const usersCollection = db.collection('users');
    
    // Get all users
    const users = await usersCollection.find({}).toArray();
    console.log(`Found ${users.length} users`);
    
    // Update each user - rename 'password' to 'passwordHash'
    for (const user of users) {
      if (user.password && !user.passwordHash) {
        console.log(`Updating user ${user.email}: renaming 'password' to 'passwordHash'`);
        
        await usersCollection.updateOne(
          { _id: user._id },
          { 
            $set: { 
              passwordHash: user.password,
              updatedAt: new Date()
            },
            $unset: { password: "" }
          }
        );
      } else if (user.passwordHash) {
        console.log(`User ${user.email} already has passwordHash field`);
      } else {
        console.log(`WARNING: User ${user.email} has no password field!`);
      }
    }
    
    console.log('\n✅ All users updated successfully!');
    
    // Verify the updates
    const updatedUsers = await usersCollection.find({}).toArray();
    console.log('\nVerification:');
    updatedUsers.forEach(user => {
      console.log(`- ${user.email}: has passwordHash: ${!!user.passwordHash}, has password: ${!!user.password}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

if (require.main === module) {
  fixPasswordField().catch(console.error);
}
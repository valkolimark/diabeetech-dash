const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config();

async function debugUserIds() {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_CONNECTION || process.env.MONGOLAB_URI;
  
  if (!mongoUri) {
    console.error('No MongoDB URI found in environment');
    return;
  }

  const client = new MongoClient(mongoUri, { useUnifiedTopology: true });
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db();
    
    // Find the admin@clinic1.diabeetech.com user
    console.log('\nSearching for admin@clinic1.diabeetech.com...');
    
    // Try with email
    const userByEmail = await db.collection('users').findOne({ 
      email: 'admin@clinic1.diabeetech.com' 
    });
    
    if (userByEmail) {
      console.log('Found user by email:');
      console.log('- _id:', userByEmail._id);
      console.log('- _id type:', typeof userByEmail._id);
      console.log('- _id constructor:', userByEmail._id.constructor.name);
      console.log('- Is ObjectId?', userByEmail._id instanceof ObjectId);
      
      // Try to find by ID as string
      const userByStringId = await db.collection('users').findOne({ 
        _id: '687bc88d31b7ed0002cdf18b' 
      });
      console.log('\nFind by string ID:', userByStringId ? 'FOUND' : 'NOT FOUND');
      
      // Try to find by ObjectId
      try {
        const userByObjectId = await db.collection('users').findOne({ 
          _id: new ObjectId('687bc88d31b7ed0002cdf18b') 
        });
        console.log('Find by ObjectId:', userByObjectId ? 'FOUND' : 'NOT FOUND');
      } catch (e) {
        console.log('ObjectId creation error:', e.message);
      }
      
      // Try with the actual _id value
      const userByActualId = await db.collection('users').findOne({ 
        _id: userByEmail._id 
      });
      console.log('Find by actual _id:', userByActualId ? 'FOUND' : 'NOT FOUND');
    } else {
      console.log('User not found by email');
    }
    
    // List first 5 users to see ID format
    console.log('\n\nFirst 5 users in database:');
    const users = await db.collection('users').find({}).limit(5).toArray();
    users.forEach((user, i) => {
      console.log(`\nUser ${i + 1}:`);
      console.log('- email:', user.email);
      console.log('- _id:', user._id);
      console.log('- _id type:', typeof user._id);
      console.log('- _id constructor:', user._id.constructor.name);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
    console.log('\nDatabase connection closed');
  }
}

debugUserIds();
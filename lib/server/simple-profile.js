'use strict';

var express = require('express');
var _ = require('lodash');

function simpleProfile() {
  var profile = express.Router();

  // Main profile page - server rendered
  profile.get('/', async function(req, res) {
    try {
      // Check if we have database context
      if (!req.ctx || !req.ctx.store || !req.ctx.store.db) {
        console.error('Missing database context in profile editor');
        return res.status(500).json({ error: 'Database context not available' });
      }

      // Load profile from tenant's database
      const profileCollection = req.ctx.store.db.collection('profile');
      const profiles = await profileCollection.find({}).sort({ startDate: -1 }).toArray();
      
      // Get the most recent profile or create default
      let currentProfile = profiles.length > 0 ? profiles[0] : null;
      
      res.render('sprofileindex.html', {
        locals: {
          profile: currentProfile,
          profiles: profiles,
          tenant: req.ctx.tenant,
          units: req.ctx.settings && req.ctx.settings.units || 'mg/dl'
        }
      });
    } catch (err) {
      console.error('Error loading profile:', err);
      res.status(500).json({ error: 'Failed to load profile' });
    }
  });

  // Get current profile
  profile.get('/api/current', async function(req, res) {
    try {
      const profileCollection = req.ctx.store.db.collection('profile');
      const profiles = await profileCollection.find({}).sort({ startDate: -1 }).limit(1).toArray();
      
      if (profiles.length > 0) {
        res.json(profiles[0]);
      } else {
        res.json(null);
      }
    } catch (err) {
      console.error('Error loading current profile:', err);
      res.status(500).json({ error: 'Failed to load profile' });
    }
  });

  // List all profiles
  profile.get('/api/list', async function(req, res) {
    try {
      const profileCollection = req.ctx.store.db.collection('profile');
      const profiles = await profileCollection.find({}).sort({ startDate: -1 }).toArray();
      res.json(profiles);
    } catch (err) {
      console.error('Error listing profiles:', err);
      res.status(500).json({ error: 'Failed to list profiles' });
    }
  });

  // Save/update profile
  profile.post('/api/save', async function(req, res) {
    try {
      const profileData = req.body;
      const profileCollection = req.ctx.store.db.collection('profile');
      
      // Ensure we have a created_at timestamp
      if (!profileData.created_at) {
        profileData.created_at = new Date().toISOString();
      }
      
      // Ensure we have a startDate
      if (!profileData.startDate) {
        profileData.startDate = new Date().toISOString();
      }
      
      // If updating existing profile
      if (profileData._id) {
        const { ObjectId } = require('mongodb');
        const id = profileData._id;
        delete profileData._id;
        
        // Check if ID is a valid ObjectId format
        let query;
        if (ObjectId.isValid(id) && id.length === 24) {
          query = { _id: new ObjectId(id) };
        } else {
          // Handle legacy string IDs
          query = { _id: id };
        }
        
        const result = await profileCollection.updateOne(
          query,
          { $set: profileData },
          { upsert: true }
        );
        
        res.json({ success: true, _id: id });
      } else {
        // Insert new profile
        const result = await profileCollection.insertOne(profileData);
        res.json({ success: true, _id: result.insertedId });
      }
      
      // Emit data-received event to update the system
      if (req.ctx.bus) {
        req.ctx.bus.emit('data-received');
      }
    } catch (err) {
      console.error('Error saving profile:', err);
      res.status(500).json({ error: 'Failed to save profile' });
    }
  });

  // Delete profile
  profile.delete('/api/delete/:id', async function(req, res) {
    try {
      const { ObjectId } = require('mongodb');
      const profileCollection = req.ctx.store.db.collection('profile');
      const id = req.params.id;
      
      // Check if ID is a valid ObjectId format
      let query;
      if (ObjectId.isValid(id) && id.length === 24) {
        query = { _id: new ObjectId(id) };
      } else {
        // Handle legacy string IDs
        query = { _id: id };
      }
      
      await profileCollection.deleteOne(query);
      
      res.json({ success: true });
      
      // Emit data-received event
      if (req.ctx.bus) {
        req.ctx.bus.emit('data-received');
      }
    } catch (err) {
      console.error('Error deleting profile:', err);
      res.status(500).json({ error: 'Failed to delete profile' });
    }
  });

  return profile;
}

module.exports = simpleProfile;
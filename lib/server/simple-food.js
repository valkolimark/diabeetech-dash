'use strict';

var express = require('express');
var _ = require('lodash');

function simpleFood() {
  var food = express.Router();
  var path = require('path');

  // Main food editor page - server rendered
  food.get('/', async function(req, res) {
    console.log('Food editor accessed by tenant:', req.tenant ? req.tenant.subdomain : 'unknown');
    
    try {
      // Check if ctx exists
      if (!req.ctx || !req.ctx.store || !req.ctx.store.db) {
        console.error('Food editor: Missing context or database connection');
        console.error('req.ctx:', req.ctx);
        console.error('req.tenant:', req.tenant);
        return res.status(500).send('Database connection error');
      }
      
      const foodCollection = req.ctx.store.db.collection('food');
      
      // Get all food items for initial display
      const foods = await foodCollection.find({ type: 'food' }).sort({ name: 1 }).toArray();
      const quickpicks = await foodCollection.find({ type: 'quickpick' }).sort({ position: 1 }).toArray();
      
      // Get unique categories and subcategories
      const categories = {};
      foods.forEach(f => {
        if (f.category) {
          if (!categories[f.category]) {
            categories[f.category] = new Set();
          }
          if (f.subcategory) {
            categories[f.category].add(f.subcategory);
          }
        }
      });
      
      // Convert sets to arrays for template
      Object.keys(categories).forEach(cat => {
        categories[cat] = Array.from(categories[cat]);
      });
      
      res.render('sfoodindex.html', {
        locals: {
          title: 'Food Editor',
          tenant: req.ctx.tenant || { subdomain: 'unknown' },
          foods: JSON.stringify(foods),
          quickpicks: JSON.stringify(quickpicks),
          categories: JSON.stringify(categories)
        }
      });
    } catch (err) {
      console.error('Error loading food editor:', err);
      res.status(500).send('Error loading food editor');
    }
  });

  // API Routes for food management
  // These will be called by both the UI and external API clients
  
  // Get all food items (API endpoint)
  food.get('/api/list', async function(req, res) {
    try {
      const foodCollection = req.ctx.store.db.collection('food');
      const foods = await foodCollection.find({}).sort({ name: 1 }).toArray();
      res.json(foods);
    } catch (err) {
      console.error('Error fetching food items:', err);
      res.status(500).json({ error: 'Failed to fetch food items' });
    }
  });

  // Get food by ID (API endpoint)
  food.get('/api/item/:id', async function(req, res) {
    try {
      const ObjectID = require('mongodb').ObjectID;
      const foodId = new ObjectID(req.params.id);
      
      const foodCollection = req.ctx.store.db.collection('food');
      const food = await foodCollection.findOne({ _id: foodId });
      
      if (!food) {
        return res.status(404).json({ error: 'Food item not found' });
      }
      
      res.json(food);
    } catch (err) {
      console.error('Error fetching food item:', err);
      res.status(500).json({ error: 'Failed to fetch food item' });
    }
  });

  // Create new food item (API endpoint)
  food.post('/api/create', async function(req, res) {
    try {
      const foodData = req.body;
      
      // Validate required fields
      if (!foodData.name) {
        return res.status(400).json({ error: 'Name is required' });
      }
      
      // Set defaults
      foodData.type = foodData.type || 'food';
      foodData.created_at = new Date().toISOString();
      foodData.carbs = parseInt(foodData.carbs) || 0;
      foodData.fat = parseInt(foodData.fat) || 0;
      foodData.protein = parseInt(foodData.protein) || 0;
      foodData.energy = parseInt(foodData.energy) || 0;
      foodData.gi = parseInt(foodData.gi) || 2;
      foodData.portion = parseInt(foodData.portion) || 0;
      foodData.unit = foodData.unit || 'g';
      
      const foodCollection = req.ctx.store.db.collection('food');
      const result = await foodCollection.insertOne(foodData);
      
      res.json({ 
        success: true, 
        _id: result.insertedId,
        item: { ...foodData, _id: result.insertedId }
      });
    } catch (err) {
      console.error('Error creating food item:', err);
      res.status(500).json({ error: 'Failed to create food item' });
    }
  });

  // Update food item (API endpoint)
  food.put('/api/update/:id', async function(req, res) {
    try {
      const ObjectID = require('mongodb').ObjectID;
      const foodId = new ObjectID(req.params.id);
      const foodData = req.body;
      delete foodData._id; // Remove _id from update data
      
      // Parse numeric fields
      if (foodData.carbs !== undefined) foodData.carbs = parseInt(foodData.carbs) || 0;
      if (foodData.fat !== undefined) foodData.fat = parseInt(foodData.fat) || 0;
      if (foodData.protein !== undefined) foodData.protein = parseInt(foodData.protein) || 0;
      if (foodData.energy !== undefined) foodData.energy = parseInt(foodData.energy) || 0;
      if (foodData.gi !== undefined) foodData.gi = parseInt(foodData.gi) || 2;
      if (foodData.portion !== undefined) foodData.portion = parseInt(foodData.portion) || 0;
      
      foodData.updated_at = new Date().toISOString();
      
      const foodCollection = req.ctx.store.db.collection('food');
      const result = await foodCollection.updateOne(
        { _id: foodId },
        { $set: foodData }
      );
      
      if (result.matchedCount === 0) {
        return res.status(404).json({ error: 'Food item not found' });
      }
      
      res.json({ success: true, modifiedCount: result.modifiedCount });
    } catch (err) {
      console.error('Error updating food item:', err);
      res.status(500).json({ error: 'Failed to update food item' });
    }
  });

  // Delete food item (API endpoint)
  food.delete('/api/delete/:id', async function(req, res) {
    try {
      const ObjectID = require('mongodb').ObjectID;
      const foodId = new ObjectID(req.params.id);
      
      const foodCollection = req.ctx.store.db.collection('food');
      const result = await foodCollection.deleteOne({ _id: foodId });
      
      if (result.deletedCount === 0) {
        return res.status(404).json({ error: 'Food item not found' });
      }
      
      res.json({ success: true });
    } catch (err) {
      console.error('Error deleting food item:', err);
      res.status(500).json({ error: 'Failed to delete food item' });
    }
  });

  // Search foods (API endpoint)
  food.get('/api/search', async function(req, res) {
    try {
      const query = { type: 'food' };
      
      if (req.query.name) {
        query.name = { $regex: req.query.name, $options: 'i' };
      }
      
      if (req.query.category && req.query.category !== '') {
        query.category = req.query.category;
      }
      
      if (req.query.subcategory && req.query.subcategory !== '') {
        query.subcategory = req.query.subcategory;
      }
      
      const foodCollection = req.ctx.store.db.collection('food');
      const foods = await foodCollection.find(query).sort({ name: 1 }).toArray();
      res.json(foods);
    } catch (err) {
      console.error('Error searching foods:', err);
      res.status(500).json({ error: 'Failed to search foods' });
    }
  });

  // Quick pick specific endpoints
  food.get('/api/quickpicks', async function(req, res) {
    try {
      const foodCollection = req.ctx.store.db.collection('food');
      const quickpicks = await foodCollection.find({ 
        type: 'quickpick'
      }).sort({ position: 1 }).toArray();
      res.json(quickpicks);
    } catch (err) {
      console.error('Error fetching quickpicks:', err);
      res.status(500).json({ error: 'Failed to fetch quickpicks' });
    }
  });

  // Create quickpick
  food.post('/api/quickpick/create', async function(req, res) {
    try {
      const quickpickData = req.body;
      
      // Set defaults
      quickpickData.type = 'quickpick';
      quickpickData.created_at = new Date().toISOString();
      quickpickData.foods = quickpickData.foods || [];
      quickpickData.carbs = quickpickData.carbs || 0;
      quickpickData.hidden = quickpickData.hidden || false;
      quickpickData.hideafteruse = quickpickData.hideafteruse !== false;
      quickpickData.position = quickpickData.position || 99999;
      
      const foodCollection = req.ctx.store.db.collection('food');
      const result = await foodCollection.insertOne(quickpickData);
      
      res.json({ 
        success: true, 
        _id: result.insertedId,
        item: { ...quickpickData, _id: result.insertedId }
      });
    } catch (err) {
      console.error('Error creating quickpick:', err);
      res.status(500).json({ error: 'Failed to create quickpick' });
    }
  });

  // Update quickpick
  food.put('/api/quickpick/update/:id', async function(req, res) {
    try {
      const ObjectID = require('mongodb').ObjectID;
      const quickpickId = new ObjectID(req.params.id);
      const quickpickData = req.body;
      delete quickpickData._id;
      
      quickpickData.updated_at = new Date().toISOString();
      
      const foodCollection = req.ctx.store.db.collection('food');
      const result = await foodCollection.updateOne(
        { _id: quickpickId, type: 'quickpick' },
        { $set: quickpickData }
      );
      
      if (result.matchedCount === 0) {
        return res.status(404).json({ error: 'Quickpick not found' });
      }
      
      res.json({ success: true });
    } catch (err) {
      console.error('Error updating quickpick:', err);
      res.status(500).json({ error: 'Failed to update quickpick' });
    }
  });

  // Get categories
  food.get('/api/categories', async function(req, res) {
    try {
      const foodCollection = req.ctx.store.db.collection('food');
      const foods = await foodCollection.find({ type: 'food' }).toArray();
      
      const categories = {};
      foods.forEach(f => {
        if (f.category) {
          if (!categories[f.category]) {
            categories[f.category] = [];
          }
          if (f.subcategory && !categories[f.category].includes(f.subcategory)) {
            categories[f.category].push(f.subcategory);
          }
        }
      });
      
      res.json(categories);
    } catch (err) {
      console.error('Error fetching categories:', err);
      res.status(500).json({ error: 'Failed to fetch categories' });
    }
  });

  return food;
}

module.exports = simpleFood;
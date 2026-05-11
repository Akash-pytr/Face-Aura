const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Record = require('../models/Record');
const { auth, JWT_SECRET } = require('../middleware/auth');

// --- AUTHENTICATION ROUTES ---

// @route POST /api/auth/signup
// @desc Register a new user
router.post('/auth/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Please provide name, email, and password' });
    }

    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ error: 'User already exists with this email' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    user = new User({
      name,
      email,
      password: hashedPassword
    });

    await user.save();

    // Create JWT payload
    const payload = { id: user._id };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });

    res.json({ token, user: { _id: user._id, name: user.name, email: user.email } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error during signup' });
  }
});

// @route POST /api/auth/login
// @desc Authenticate user & get token
router.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Please provide email and password' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: 'Invalid Credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid Credentials' });
    }

    const payload = { id: user._id };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });

    res.json({ token, user: { _id: user._id, name: user.name, email: user.email } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error during login' });
  }
});

// @route GET /api/auth/me
// @desc Get current user data based on token
router.get('/auth/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// --- RECORD ROUTES (PROTECTED) ---

// Save or update daily record
router.post('/records', auth, async (req, res) => {
  try {
    // Force userId to be the authenticated user's ID
    const userId = req.user.id;
    const { date, timestamp, brightnessScore, emotion, skinConditions, recommendations } = req.body;
    
    if (!date) {
      return res.status(400).json({ error: 'Missing date field' });
    }

    let record = await Record.findOne({ userId, date });
    
    if (record) {
      const oldRecos = record.recommendations;
      
      const updatedRecommendations = recommendations.map(newCat => {
        const oldCat = oldRecos.find(c => c.category === newCat.category);
        if (oldCat) {
          const updatedItems = newCat.items.map(newItem => {
            const oldItem = oldCat.items.find(i => i.text === newItem.text);
            return {
              text: newItem.text,
              done: oldItem ? oldItem.done : false
            };
          });
          return { category: newCat.category, items: updatedItems };
        }
        return newCat;
      });

      record.timestamp = timestamp;
      record.brightnessScore = brightnessScore;
      record.emotion = emotion;
      record.skinConditions = skinConditions;
      record.recommendations = updatedRecommendations;

      await record.save();
    } else {
      record = new Record({
        userId,
        date,
        timestamp,
        brightnessScore,
        emotion,
        skinConditions,
        recommendations
      });
      await record.save();
    }

    res.json(record);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all records for logged-in user
router.get('/records', auth, async (req, res) => {
  try {
    // Only fetch records for the authenticated user
    const records = await Record.find({ userId: req.user.id }).sort({ timestamp: -1 });
    res.json(records);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Update checklist item
router.put('/records/:recordId/checklist', auth, async (req, res) => {
  try {
    const { category, text, done } = req.body;
    // Also verify the record belongs to the user
    const record = await Record.findOne({ _id: req.params.recordId, userId: req.user.id });
    
    if (!record) return res.status(404).json({ error: 'Record not found or unauthorized' });

    let updated = false;
    for (let cat of record.recommendations) {
      if (cat.category === category) {
        for (let item of cat.items) {
          if (item.text === text) {
            item.done = done;
            updated = true;
            break;
          }
        }
      }
      if (updated) break;
    }

    if (updated) {
      await record.save();
      res.json(record);
    } else {
      res.status(404).json({ error: 'Item not found in checklist' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

const mongoose = require('mongoose');

const recordSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  date: {
    type: String, // YYYY-MM-DD
    required: true,
  },
  timestamp: {
    type: Number,
    required: true,
  },
  brightnessScore: {
    type: Number,
    required: true,
  },
  emotion: {
    dominant: String,
    scores: {
      type: Map,
      of: Number
    }
  },
  skinConditions: [
    {
      name: String,
      icon: String,
      level: String, // good, warning, alert
      detail: String
    }
  ],
  recommendations: [
    {
      category: String,
      items: [
        {
          text: String,
          done: { type: Boolean, default: false }
        }
      ]
    }
  ]
});

// Ensure a user only has one record per date
recordSchema.index({ userId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Record', recordSchema);

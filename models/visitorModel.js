const mongoose = require('mongoose');

const visitorSchema = mongoose.Schema({
  ipAddress: {
    type: String,
    required: true,
    unique: true,
  },
  userAgent: {
    type: String,
    default: null,
  },
  riskScore: {
    type: Number,
    default: 0,
  },
  riskLevel: {
    type: String,
    default: 'unknown',
  },
  referrer: {
    type: String,
    default: null,
  },
  visits: {
    type: Number,
    default: 1,
  },
  pages: {
    type: [String], // Visited pages ke URLs ko store karne ke liye array of strings
    default: [],
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: null,
  },
});

// Middleware to update the updatedAt field when visitor document is updated
visitorSchema.pre('save', function (next) {
  if (!this.isNew) {
    this.updatedAt = Date.now();
  }
  next();
});

const Visitor = mongoose.model('Visitor', visitorSchema);

module.exports = Visitor;
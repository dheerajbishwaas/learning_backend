const mongoose = require('mongoose');

const userSchema = mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  username: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  status: {
    type: Number,
    enum: [0, 1],  // 0 for inactive, 1 for active
    default: 1,    // Default to active
  },
  role: {
    type: String,
    enum: [1, 2, 3],  // Predefined roles ['admin', 'user', 'moderator']
    default: 'user',  // Default role is 'user'
  },
  ipAddress: {
    type: String,
    default: '',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: null,  // Default to null, will be updated later
  },
});

// Middleware to update the updatedAt field when user document is updated
userSchema.pre('save', function(next) {
  if (this.isModified()) {
    this.updatedAt = Date.now();  // Only set `updatedAt` when modified
  }
  next();
});

const User = mongoose.model('User', userSchema);

module.exports = User;
const mongoose = require('mongoose');

const feedSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  url: {
    type: String,
    required: true,
    trim: true
  },
  enabled: {
    type: Boolean,
    default: true
  }
});

const jobSettingsSchema = new mongoose.Schema({
  isEnabled: {
    type: Boolean,
    default: true
  },
  feeds: [feedSchema]
}, {
  timestamps: true
});

const JobSettings = mongoose.model('JobSettings', jobSettingsSchema);

module.exports = JobSettings;

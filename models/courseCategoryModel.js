const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Define the schema for the course category
const courseCategorySchema = new Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  icon: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'inactive'], // only active or inactive allowed
    default: 'active'
  }
}, {
  timestamps: true
});

// Create the model
const CourseCategory = mongoose.model('CourseCategory', courseCategorySchema);

module.exports = CourseCategory;

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Define schema for the course
const courseSchema = new Schema({
  courseName: {
    type: String,
    required: true,
    trim: true
  },
  courseType: {
    type: String,
    enum: ['single', 'multi'],
    required: true,
    default: 'single'
  },
  description: {
    type: String,
    required: true
  },
  youtubeLink: {
    type: String,
    required: function () {
      return this.courseType === 'single';
    }
  },
  videoCredits: {
    type: String,
    required: function () {
      return this.courseType === 'single';
    }
  },
  status: {
    type: String,
    enum: ['draft', 'published', 'disabled'],
    default: 'draft'
  },
  metaTitle: {
    type: String,
    maxlength: 60
  },
  metaDescription: {
    type: String,
    maxlength: 160
  },
  categories: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CourseCategory'
  }],
  chapters: [{
    title: String,
    youtubeLink: String,
    description: String,
    credits: String
  }]
}, {
  timestamps: true
});

// Create the model
const Course = mongoose.model('Course', courseSchema);

module.exports = Course;
const mongoose = require('mongoose');

const discussionMessageSchema = new mongoose.Schema({
  course_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true,
    index: true,
  },
  chapter_id: {
    type: String,
    required: true,
    trim: true,
    index: true,
  },
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  message: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000,
  },
}, {
  timestamps: {
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
});

discussionMessageSchema.index({ course_id: 1, chapter_id: 1, created_at: 1 });

const DiscussionMessage = mongoose.model('DiscussionMessage', discussionMessageSchema);

module.exports = DiscussionMessage;

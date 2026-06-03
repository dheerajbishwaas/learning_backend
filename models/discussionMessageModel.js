const mongoose = require('mongoose');

const discussionMessageSchema = new mongoose.Schema({
  course_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    index: true,
  },
  chapter_id: {
    type: String,
    trim: true,
    index: true,
  },
  blog_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Blog',
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
  is_read: {
    type: Boolean,
    default: false,
    index: true,
  },
  read_at: {
    type: Date,
    default: null,
  },
}, {
  timestamps: {
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
});

discussionMessageSchema.index({ course_id: 1, chapter_id: 1, created_at: 1 });
discussionMessageSchema.index({ blog_id: 1, created_at: 1 });
discussionMessageSchema.index({ is_read: 1, created_at: -1 });

discussionMessageSchema.pre('validate', function(next) {
  if ((!this.course_id || !this.chapter_id) && !this.blog_id) {
    next(new Error('A discussion message must be linked to either a course chapter or a blog.'));
  } else {
    next();
  }
});

const DiscussionMessage = mongoose.model('DiscussionMessage', discussionMessageSchema);

module.exports = DiscussionMessage;

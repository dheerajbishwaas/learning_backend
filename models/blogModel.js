const mongoose = require('mongoose');

const blogSchema = new mongoose.Schema({
    id: {
        type: String,
        required: true,
        unique: true
    },
    slug: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    title: {
        type: String,
        required: true,
        trim: true
    },
    excerpt: {
        type: String
    },
    content: {
        type: String
    },
    author: {
        type: String
    },
    date: {
        type: String // Storing as String to match "Oct 24, 2025" or similar formats from mock
    },
    readTime: {
        type: String
    },
    image: {
        type: String
    },
    tags: [String]
}, {
    timestamps: true
});

const Blog = mongoose.model('Blog', blogSchema);

module.exports = Blog;

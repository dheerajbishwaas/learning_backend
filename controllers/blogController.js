const Blog = require('../models/blogModel');
const path = require('path');
const { uploadFileToFTP } = require('../middleware/upload');

// Create a new blog
const createBlog = async (req, res) => {
    try {
        const { id, slug, title, excerpt, content, author, date, readTime, tags } = req.body;
        // Parse tags if it comes as a stringified array (common in form-data)
        let parsedTags = tags;
        if (typeof tags === 'string') {
            try {
                parsedTags = JSON.parse(tags);
            } catch (e) {
                // If not JSON, assume single tag or comma separated
                parsedTags = tags.split(',').map(t => t.trim());
            }
        }

        // Validation - Basic checks
        if (!id || !slug || !title) {
            return res.status(400).json({ message: 'ID, Slug, and Title are required' });
        }

        const existingBlog = await Blog.findOne({ $or: [{ id }, { slug }] });
        if (existingBlog) {
            return res.status(400).json({ message: 'Blog with this ID or Slug already exists' });
        }

        let image = req.body.image || ''; // Allow string URL fallback
        if (req.file) {
            const ext = path.extname(req.file.originalname);
            const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
            // Upload to 'blogs' folder
            image = await uploadFileToFTP(req.file.buffer, filename, 'blogs');
        }

        const newBlog = new Blog({
            id,
            slug,
            title,
            excerpt,
            content,
            author,
            date,
            readTime,
            image,
            tags: parsedTags
        });

        await newBlog.save();
        res.status(201).json({ message: 'Blog created successfully', data: newBlog });

    } catch (error) {
        console.error('Error in createBlog:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Get all blogs
const getAllBlogs = async (req, res) => {
    try {
        const blogs = await Blog.find().sort({ createdAt: -1 });
        res.status(200).json({ success: true, count: blogs.length, data: blogs });
    } catch (error) {
        console.error('Error in getAllBlogs:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

// Get single blog by slug
const getBlogBySlug = async (req, res) => {
    try {
        const { slug } = req.params;
        const blog = await Blog.findOne({ slug });

        if (!blog) {
            return res.status(404).json({ message: 'Blog not found' });
        }

        res.status(200).json({ success: true, data: blog });
    } catch (error) {
        console.error('Error in getBlogBySlug:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

// Update blog
const updateBlog = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        const blog = await Blog.findOne({ id });

        if (!blog) {
            return res.status(404).json({ message: 'Blog not found' });
        }

        if (updates.slug && updates.slug !== blog.slug) {
            const existingSlug = await Blog.findOne({ slug: updates.slug });
            if (existingSlug) return res.status(400).json({ message: 'Slug already in use' });
        }

        // Handle File Upload
        if (req.file) {
            const ext = path.extname(req.file.originalname);
            const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
            const uploadedImagePath = await uploadFileToFTP(req.file.buffer, filename, 'blogs');
            updates.image = uploadedImagePath;
        }

        // Handle Tags Parsing if present in updates
        if (updates.tags && typeof updates.tags === 'string') {
            try {
                updates.tags = JSON.parse(updates.tags);
            } catch (e) {
                updates.tags = updates.tags.split(',').map(t => t.trim());
            }
        }

        Object.assign(blog, updates);
        await blog.save();

        res.status(200).json({ message: 'Blog updated successfully', data: blog });

    } catch (error) {
        console.error('Error in updateBlog:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Delete blog
const deleteBlog = async (req, res) => {
    try {
        const { id } = req.params;
        const blog = await Blog.findOneAndDelete({ id });

        if (!blog) {
            return res.status(404).json({ message: 'Blog not found' });
        }

        res.status(200).json({ message: 'Blog deleted successfully' });
    } catch (error) {
        console.error('Error in deleteBlog:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

const Settings = require('../models/settingsModel');
const { generateBlogPost } = require('../services/geminiService');

// Generate Blog with AI
const generateBlog = async (req, res) => {
    try {
        const { topic } = req.body;
        if (!topic) {
            return res.status(400).json({ message: 'Topic is required' });
        }

        // Get API Key from Settings
        const settings = await Settings.findOne();
        if (!settings || !settings.geminiApiKey) {
            return res.status(500).json({ message: 'Gemini API Key is not configured in settings' });
        }

        const blogData = await generateBlogPost(topic, settings.geminiApiKey);

        // Add a random ID as this is a preview/pre-fill
        blogData.id = Date.now().toString();

        res.status(200).json({ success: true, data: blogData });

    } catch (error) {
        console.error('Error in generateBlog:', error);
        res.status(500).json({
            message: 'Failed to generate blog post',
            error: error.message,
            details: error.response?.data || 'No additional details'
        });
    }
};

module.exports = {
    createBlog,
    getAllBlogs,
    getBlogBySlug,
    updateBlog,
    deleteBlog,
    generateBlog
};

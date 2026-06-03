const mongoose = require('mongoose');
const Course = require('../models/courseModel');
const Blog = require('../models/blogModel');
const DiscussionMessage = require('../models/discussionMessageModel');

const validateChapterReference = async (courseId, chapterId, blogId) => {
  if (blogId) {
    if (!mongoose.Types.ObjectId.isValid(blogId)) {
      return { valid: false, status: 400, message: 'Invalid blog_id' };
    }
    const blog = await Blog.findById(blogId).select('_id title slug');
    if (!blog) {
      return { valid: false, status: 404, message: 'Blog not found' };
    }
    return { valid: true, blog };
  }

  if (!mongoose.Types.ObjectId.isValid(courseId)) {
    return { valid: false, status: 400, message: 'Invalid course_id' };
  }

  if (!chapterId || typeof chapterId !== 'string') {
    return { valid: false, status: 400, message: 'chapter_id is required when course_id is provided' };
  }

  const course = await Course.findById(courseId).select('courseType chapters');
  if (!course) {
    return { valid: false, status: 404, message: 'Course not found' };
  }

  if (course.courseType === 'multi') {
    const chapterExists = course.chapters.some((chapter) => chapter._id.toString() === chapterId);
    if (!chapterExists) {
      return { valid: false, status: 400, message: 'Invalid chapter_id for this course' };
    }
  } else if (course._id.toString() !== chapterId) {
    return { valid: false, status: 400, message: 'Invalid chapter_id for this course' };
  }

  return { valid: true, course };
};

const getChapterMessages = async (req, res) => {
  try {
    const { course_id, chapter_id, blog_id, before } = req.query;
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);
    const validation = await validateChapterReference(course_id, chapter_id, blog_id);

    if (!validation.valid) {
      return res.status(validation.status).json({ success: false, message: validation.message });
    }

    const filter = blog_id ? { blog_id } : { course_id, chapter_id };
    if (before) {
      const beforeDate = new Date(before);
      if (!Number.isNaN(beforeDate.getTime())) {
        filter.created_at = { $lt: beforeDate };
      }
    }

    const messages = await DiscussionMessage.find(filter)
      .populate('user_id', 'name username')
      .sort({ created_at: -1 })
      .limit(limit + 1)
      .lean();

    const hasMore = messages.length > limit;
    const pageMessages = messages.slice(0, limit).reverse();

    return res.status(200).json({
      success: true,
      data: pageMessages.map((item) => ({
        _id: item._id,
        course_id: item.course_id,
        chapter_id: item.chapter_id,
        blog_id: item.blog_id,
        user_id: item.user_id?._id,
        senderName: item.user_id?.name || item.user_id?.username || 'Student',
        message: item.message,
        created_at: item.created_at,
        updated_at: item.updated_at,
      })),
      hasMore,
      nextBefore: pageMessages[0]?.created_at || null,
    });
  } catch (error) {
    console.error('Error in getChapterMessages:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const createChapterMessage = async (req, res) => {
  try {
    const { course_id, chapter_id, blog_id, message } = req.body;
    const cleanMessage = typeof message === 'string' ? message.trim() : '';

    if (!cleanMessage) {
      return res.status(400).json({ success: false, message: 'Message is required' });
    }

    if (cleanMessage.length > 1000) {
      return res.status(400).json({ success: false, message: 'Message cannot exceed 1000 characters' });
    }

    const validation = await validateChapterReference(course_id, chapter_id, blog_id);
    if (!validation.valid) {
      return res.status(validation.status).json({ success: false, message: validation.message });
    }

    const discussionMessage = await DiscussionMessage.create({
      course_id: blog_id ? undefined : course_id,
      chapter_id: blog_id ? undefined : chapter_id,
      blog_id,
      user_id: req.user._id,
      message: cleanMessage,
    });

    await discussionMessage.populate('user_id', 'name username');

    return res.status(201).json({
      success: true,
      data: {
        _id: discussionMessage._id,
        course_id: discussionMessage.course_id,
        chapter_id: discussionMessage.chapter_id,
        blog_id: discussionMessage.blog_id,
        user_id: discussionMessage.user_id?._id,
        senderName: discussionMessage.user_id?.name || discussionMessage.user_id?.username || 'Student',
        message: discussionMessage.message,
        created_at: discussionMessage.created_at,
        updated_at: discussionMessage.updated_at,
      },
    });
  } catch (error) {
    console.error('Error in createChapterMessage:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const getAdminMessages = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const status = req.query.status || 'unread';
    const skip = (page - 1) * limit;
    const filter = {};

    if (status === 'read') {
      filter.is_read = true;
    } else if (status === 'unread') {
      filter.is_read = false;
    }

    const [messages, total] = await Promise.all([
      DiscussionMessage.find(filter)
        .populate('user_id', 'name username email role')
        .populate('course_id', 'courseName courseSlug courseType chapters')
        .populate('blog_id', 'title slug')
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      DiscussionMessage.countDocuments(filter),
    ]);

    const data = messages.map((item) => {
      const course = item.course_id;
      const chapter = course?.courseType === 'multi'
        ? course.chapters?.find((chapterItem) => chapterItem._id.toString() === item.chapter_id)
        : null;

      const blog = item.blog_id;

      return {
        _id: item._id,
        course_id: course?._id || item.course_id,
        courseName: blog ? blog.title : (course?.courseName || 'Deleted course'),
        courseSlug: blog ? `/blogs/${blog.slug}` : (course?.courseSlug || ''),
        chapter_id: item.chapter_id,
        blog_id: blog?._id,
        chapterTitle: blog ? 'Blog Discussion' : (chapter?.title || course?.courseName || 'Course discussion'),
        user_id: item.user_id?._id,
        senderName: item.user_id?.name || item.user_id?.username || 'Student',
        senderEmail: item.user_id?.email || '',
        senderRole: item.user_id?.role || '',
        message: item.message,
        is_read: !!item.is_read,
        read_at: item.read_at,
        created_at: item.created_at,
        updated_at: item.updated_at,
      };
    });

    return res.status(200).json({
      success: true,
      data,
      total,
      page,
      limit,
      status,
    });
  } catch (error) {
    console.error('Error in getAdminMessages:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const markMessageRead = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid message id' });
    }

    const message = await DiscussionMessage.findByIdAndUpdate(
      id,
      {
        is_read: true,
        read_at: new Date(),
      },
      { new: true }
    );

    if (!message) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }

    return res.status(200).json({ success: true, data: message });
  } catch (error) {
    console.error('Error in markMessageRead:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

module.exports = { getChapterMessages, createChapterMessage, getAdminMessages, markMessageRead };

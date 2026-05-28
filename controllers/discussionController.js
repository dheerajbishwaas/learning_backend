const mongoose = require('mongoose');
const Course = require('../models/courseModel');
const DiscussionMessage = require('../models/discussionMessageModel');

const validateChapterReference = async (courseId, chapterId) => {
  if (!mongoose.Types.ObjectId.isValid(courseId)) {
    return { valid: false, status: 400, message: 'Invalid course_id' };
  }

  if (!chapterId || typeof chapterId !== 'string') {
    return { valid: false, status: 400, message: 'chapter_id is required' };
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
    const { course_id, chapter_id } = req.query;
    const validation = await validateChapterReference(course_id, chapter_id);

    if (!validation.valid) {
      return res.status(validation.status).json({ success: false, message: validation.message });
    }

    const messages = await DiscussionMessage.find({ course_id, chapter_id })
      .populate('user_id', 'name username')
      .sort({ created_at: 1 })
      .limit(100)
      .lean();

    return res.status(200).json({
      success: true,
      data: messages.map((item) => ({
        _id: item._id,
        course_id: item.course_id,
        chapter_id: item.chapter_id,
        user_id: item.user_id?._id,
        senderName: item.user_id?.name || item.user_id?.username || 'Student',
        message: item.message,
        created_at: item.created_at,
        updated_at: item.updated_at,
      })),
    });
  } catch (error) {
    console.error('Error in getChapterMessages:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const createChapterMessage = async (req, res) => {
  try {
    const { course_id, chapter_id, message } = req.body;
    const cleanMessage = typeof message === 'string' ? message.trim() : '';

    if (!cleanMessage) {
      return res.status(400).json({ success: false, message: 'Message is required' });
    }

    if (cleanMessage.length > 1000) {
      return res.status(400).json({ success: false, message: 'Message cannot exceed 1000 characters' });
    }

    const validation = await validateChapterReference(course_id, chapter_id);
    if (!validation.valid) {
      return res.status(validation.status).json({ success: false, message: validation.message });
    }

    const discussionMessage = await DiscussionMessage.create({
      course_id,
      chapter_id,
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

module.exports = { getChapterMessages, createChapterMessage };

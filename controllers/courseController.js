const Course = require('../models/courseModel');
const mongoose = require('mongoose');

const createCourse = async (req, res) => {
  try {
    const {
      courseName,
      courseType,
      description,
      youtubeLink,
      videoCredits,
      status,
      metaTitle,
      metaDescription,
      categories,
      chapters
    } = req.body;

    // Validation
    if (!courseName || !courseType || !description) {
      return res.status(400).json({ message: 'Required fields missing' });
    }

    if (courseType === 'single') {
      if (!youtubeLink || !videoCredits) {
        return res.status(400).json({ message: 'youtubeLink and videoCredits are required for single type course' });
      }
    }

    if (courseType === 'multi') {
      if (!chapters || !Array.isArray(chapters) || chapters.length === 0) {
        return res.status(400).json({ message: 'At least one chapter is required for multi type course' });
      }
    }

    // Create Course
    const newCourse = new Course({
      courseName,
      courseType,
      description,
      youtubeLink: courseType === 'single' ? youtubeLink : undefined,
      videoCredits: courseType === 'single' ? videoCredits : undefined,
      status,
      metaTitle,
      metaDescription,
      categories,
      chapters: courseType === 'multi' ? chapters : []
    });

    await newCourse.save();

    return res.status(201).json({
      message: 'Course created successfully',
      data: newCourse
    });

  } catch (error) {
    console.error('Error in createCourse:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

const getPaginatedCourses = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const skip = (page - 1) * limit;

    // Fetch data
    const [courses, total] = await Promise.all([
      Course.find().skip(skip).limit(limit).sort({ createdAt: -1 }),
      Course.countDocuments()
    ]);

    res.status(200).json({
      success: true,
      data: courses,
      total,
      page,
      limit
    });
  } catch (err) {
    console.error('Error in getPaginatedCourses:', err);
    res.status(500).json({
      success: false,
      message: 'Server Error',
    });
  }
};


const updateCourse = async (req, res) => {
  try {
    const courseId = req.params.id;
    const {
      courseName,
      courseType,
      description,
      youtubeLink,
      videoCredits,
      status,
      metaTitle,
      metaDescription,
      categories,
      chapters
    } = req.body;

    // Validation
    if (!courseName || !courseType || !description) {
      return res.status(400).json({ message: 'Required fields missing' });
    }

    if (courseType === 'single') {
      if (!youtubeLink || !videoCredits) {
        return res.status(400).json({ message: 'youtubeLink and videoCredits are required for single type course' });
      }
    }

    if (courseType === 'multi') {
      if (!chapters || !Array.isArray(chapters) || chapters.length === 0) {
        return res.status(400).json({ message: 'At least one chapter is required for multi type course' });
      }
    }

    // Find and Update
    const updatedCourse = await Course.findByIdAndUpdate(
      courseId,
      {
        courseName,
        courseType,
        description,
        youtubeLink: courseType === 'single' ? youtubeLink : undefined,
        videoCredits: courseType === 'single' ? videoCredits : undefined,
        status,
        metaTitle,
        metaDescription,
        categories,
        chapters: courseType === 'multi' ? chapters : []
      },
      { new: true, runValidators: true }
    );

    if (!updatedCourse) {
      return res.status(404).json({ message: 'Course not found' });
    }

    return res.status(200).json({
      message: 'Course updated successfully',
      data: updatedCourse
    });

  } catch (error) {
    console.error('Error in updateCourse:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

const getCourseById = async (req, res) => {
  try {
    const courseId = req.params.id;

    const course = await Course.findById(courseId);

    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    return res.status(200).json({
      message: 'Course fetched successfully',
      data: course
    });

  } catch (error) {
    console.error('Error in getCourseById:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

const deleteCourseById = async (req, res) => {
  try {
    const courseId = req.params.id;

    // Find and delete the course
    const deletedCourse = await Course.findByIdAndDelete(courseId);

    if (!deletedCourse) {
      return res.status(404).json({ message: 'Course not found' });
    }

    return res.status(200).json({
      message: 'Course deleted successfully',
      data: deletedCourse
    });

  } catch (error) {
    console.error('Error in deleteCourseById:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};


module.exports = {createCourse,getPaginatedCourses,updateCourse,getCourseById,deleteCourseById};

const Course = require('../models/courseModel');

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

module.exports = { createCourse };

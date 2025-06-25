const Course = require('../models/courseModel');
const CourseCategory = require('../models/courseCategoryModel');
const mongoose = require('mongoose');
const { google } = require('googleapis');

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
      courseSlug,
      chapters
    } = req.body;

    // Validation
    if (!courseName || !courseType || !description) {
      return res.status(400).json({ message: 'Required fields missing' });
    }

    // Slug uniqueness check
    const existingCourse = await Course.findOne({ courseSlug });
    if (existingCourse) {
      return res.status(409).json({ message: 'Course slug already exists. Please choose a unique slug.' });
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
      courseSlug,
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
    const search = req.query.search || '';

    const skip = (page - 1) * limit;

    // Build search filter for multiple fields
    const searchFilter = search
      ? {
          $or: [
            { courseName: { $regex: search, $options: 'i' } },
            { description: { $regex: search, $options: 'i' } },
            { videoCredits: { $regex: search, $options: 'i' } },
            { metaTitle: { $regex: search, $options: 'i' } },
            { metaDescription: { $regex: search, $options: 'i' } },
            { 'chapters.title': { $regex: search, $options: 'i' } }
          ]
        }
      : {};

    const [courses, total] = await Promise.all([
      Course.find(searchFilter).skip(skip).limit(limit).sort({ createdAt: -1 }),
      Course.countDocuments(searchFilter)
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
      chapters,
      courseSlug
    } = req.body;

    // Validation
    if (!courseName || !courseType || !description) {
      return res.status(400).json({ message: 'Required fields missing' });
    }

    // Check for unique courseSlug (excluding current course)
    const existingSlug = await Course.findOne({
      courseSlug,
      _id: { $ne: courseId }
    });

    if (existingSlug) {
      return res.status(400).json({ message: 'Course slug already exists. Please choose a different one.' });
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
        courseSlug,
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

const getCourse = async (req, res) => {
  try {
    const { id } = req.params;

    let course;

    // Check if 'id' is a valid ObjectId (fetch by _id)
    if (mongoose.Types.ObjectId.isValid(id)) {
      course = await Course.findById(id)
        .populate('categories', 'name')
        .select(
          'courseName courseType description youtubeLink videoCredits categories chapters status metaTitle metaDescription courseSlug'
        );
    }

    // If not found by ID, or not a valid ObjectId, try finding by courseSlug
    if (!course) {
      course = await Course.findOne({
        courseSlug: { $regex: `^${id}$`, $options: 'i' } // case-insensitive exact match
      })
        .populate('categories', 'name')
        .select(
          'courseName courseType description youtubeLink videoCredits categories chapters status metaTitle metaDescription courseSlug'
        );
    }


    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }

    // Format categories to only show names
    const formattedCourse = {
      ...course.toObject(),
      categories: course.categories.map(cat => cat.name)
    };

    res.json({
      success: true,
      data: formattedCourse
    });

  } catch (error) {
    console.error('Error fetching course by ID or slug:', error);
    res.status(500).json({ success: false, message: 'Error fetching course details' });
  }
};

const youtube = google.youtube({
  version: 'v3',
  auth: process.env.GOOGLE_API_KEY
});

const importCourse = async (req, res) => {
  try {
    const { channelId, playlistIds, categoryIds, courseName, description } = req.body;
    console.log(req.body);
    if (!channelId || !playlistIds?.length || !categoryIds?.length || !courseName || !description) {
      return res.status(400).json({ message: 'channelId, playlistIds, categoryIds, courseName, and description are required.' });
    }

    // Validate that all categories exist
    const categories = await CourseCategory.find({ _id: { $in: categoryIds } });
    if (categories.length !== categoryIds.length) {
      return res.status(400).json({ message: 'Some category IDs are invalid.' });
    }

    const chapters = [];

    for (const playlistId of playlistIds) {
      let nextPageToken = null;

      do {
        const resY = await youtube.playlistItems.list({
          part: 'snippet',
          playlistId,
          maxResults: 50,
          pageToken: nextPageToken
        });

        const items = resY.data.items || [];
        nextPageToken = resY.data.nextPageToken;

        items.forEach(item => {
          const snip = item.snippet;
          chapters.push({
            title: snip.title,
            youtubeLink: `https://www.youtube.com/watch?v=${snip.resourceId.videoId}`,
            description: snip.description,
            credits: snip.videoOwnerChannelTitle
          });
        });
      } while (nextPageToken);
    }

    const course = new Course({
      courseName,
      courseType: 'multi',
      description,
      courseSlug: courseName.toLowerCase().replace(/\s+/g, '-'),
      categories: categoryIds,
      chapters
    });
    
    await course.save();

    res.json({ message: 'Course imported and saved.', course });
  } catch (err) {
    console.error('importCourse error:', err);
    res.status(500).json({ message: 'Internal server error.' });
  }
};

module.exports = {importCourse, getCourse, createCourse,getPaginatedCourses,updateCourse,getCourseById,deleteCourseById};

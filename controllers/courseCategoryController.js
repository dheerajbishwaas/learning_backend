const CourseCategory = require('../models/courseCategoryModel');
const Course = require('../models/courseModel');
const mongoose = require('mongoose');
// Create a new Course Category
const path = require('path');
const { uploadFileToFTP } = require('../middleware/upload'); // FTP helper function

exports.createCategory = async (req, res) => {
  try {
    const { name, description, status } = req.body;

    // Check if category already exists
    const existingCategory = await CourseCategory.findOne({ name });
    if (existingCategory) {
      return res.status(400).json({ message: 'Category already exists' });
    }

    let icon = '';
    if (req.file) {
      const ext = path.extname(req.file.originalname);
      const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;

      // Upload to FTP and get public path
      icon = await uploadFileToFTP(req.file.buffer, filename);
    }

    const category = new CourseCategory({
      name,
      description,
      icon, 
      status
    });

    await category.save();

    res.status(201).json({ message: 'Category created successfully', category });
  } catch (error) {
    console.error('Error creating category:', error);
    res.status(500).json({ message: 'Server error while creating category' });
  }
};

exports.updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, status } = req.body;

    let icon = '';
    if (req.file) {
      const ext = path.extname(req.file.originalname);
      const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;

      // Upload to FTP and get the public path
      icon = await uploadFileToFTP(req.file.buffer, filename);
    }

    let updateData = { name, description, status };
    if (icon) {
      updateData.icon = icon;
    }

    const updatedCategory = await CourseCategory.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!updatedCategory) {
      return res.status(404).json({ message: 'Category not found' });
    }

    res.status(200).json({
      message: 'Category updated successfully',
      category: updatedCategory,
    });
  } catch (error) {
    console.error('Error updating category:', error);
    res.status(500).json({ message: 'Server error while updating category' });
  }
};
// Delete a Course Category
exports.deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if the category is being used by any courses or records
    const categoryInUse = await Course.findOne({ categories: id });

    if (categoryInUse) {
      return res.status(400).json({
        message: 'This category is currently in use by one or more courses and cannot be deleted.'
      });
    }

    const deletedCategory = await CourseCategory.findByIdAndDelete(id);

    if (!deletedCategory) {
      return res.status(404).json({ message: 'Category not found' });
    }

    res.status(200).json({ message: 'Category deleted successfully' });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({ message: 'Server error while deleting category' });
  }
};

// Get all active Course Categories
exports.getAllCategory = async (req, res) => {
  try {
    const categories = await CourseCategory.find({ status: 'active' }).sort({ value: 1 }); // Only active
    res.status(200).json({
      success: true,
      data: categories
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching categories'
    });
  }
};

// Categories API
exports.getAllCategorys = async (req, res) => {
  try {
    const search = req.query.search || '';
    const categories = await CourseCategory.find({
      name: { $regex: search, $options: 'i' },
      status: 'active',
    }).select('id name icon').sort({ name: 1 });

    res.json({ success: true, data: categories });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

exports.getPaginatedCourse = async (req, res) => {
  try {
    const { search = '', cat_id, limit = 9, page = 1 } = req.query;
    const query = {};

    if (search) {
      query.courseName = { $regex: search, $options: 'i' };
    }

    if (cat_id) {
      if (!mongoose.Types.ObjectId.isValid(cat_id)) {
        return res.status(400).json({ success: false, message: 'Invalid category ID' });
      }
      query.categories = new mongoose.Types.ObjectId(cat_id);
    }

    const skip = (Number(page) - 1) * Number(limit);

    const courses = await Course.find(query)
      .populate('categories', 'name')
      .skip(skip)
      .limit(Number(limit))
      .select('courseName description categories');

    const total = await Course.countDocuments(query);

    res.json({
      success: true,
      data: courses,
      total,
      currentPage: Number(page),
      totalPages: Math.ceil(total / limit)
    });

  } catch (error) {
    console.error('Error fetching courses:', error);
    res.status(500).json({ success: false, message: 'Error fetching courses' });
  }
};


exports.getPaginatedCourseCategories = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';
    const skip = (page - 1) * limit;

    const query = {};

    if (search) {
      query.name = { $regex: search, $options: 'i' }; // case-insensitive search
    }

    const [categories, total] = await Promise.all([
      CourseCategory.find(query)
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 }),
      CourseCategory.countDocuments(query)
    ]);

    res.status(200).json({
      success: true,
      data: categories,
      total,
      page,
      limit
    });
  } catch (err) {
    console.error('Error in getPaginatedCourseCategories:', err);
    res.status(500).json({
      success: false,
      message: 'Server Error',
    });
  }
};


exports.getCourseCategoryById = async (req, res) => {
  try {
    const categoryId = req.params.id;

    const category = await CourseCategory.findById(categoryId);

    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    return res.status(200).json({
      message: 'Category fetched successfully',
      data: category
    });

  } catch (error) {
    console.error('Error in getCourseCategoryById:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
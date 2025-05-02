const CourseCategory = require('../models/courseCategoryModel');
const Course = require('../models/courseModel');
// Create a new Course Category
exports.createCategory = async (req, res) => {
  try {
    const { name, description, status } = req.body;

    // Check if category already exists
    const existingCategory = await CourseCategory.findOne({ name });
    if (existingCategory) {
      return res.status(400).json({ message: 'Category already exists' });
    }

    const category = new CourseCategory({
      name,
      description,
      status // optional: if not sent, default "active" will be used
    });

    await category.save();

    res.status(201).json({ message: 'Category created successfully', category });
  } catch (error) {
    console.error('Error creating category:', error);
    res.status(500).json({ message: 'Server error while creating category' });
  }
};

// Update an existing Course Category
exports.updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, status } = req.body;

    const updatedCategory = await CourseCategory.findByIdAndUpdate(
      id,
      { name, description, status },
      { new: true, runValidators: true }
    );

    if (!updatedCategory) {
      return res.status(404).json({ message: 'Category not found' });
    }

    res.status(200).json({ message: 'Category updated successfully', category: updatedCategory });
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

exports.getPaginatedCourseCategories = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const [categories, total] = await Promise.all([
      CourseCategory.find().skip(skip).limit(limit).sort({ createdAt: -1 }),
      CourseCategory.countDocuments()
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
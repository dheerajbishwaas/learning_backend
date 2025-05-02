const express = require('express');
const router = express.Router();
const courseCategoryController = require('../controllers/courseCategoryController');
const {verifyTokenAndRole} = require('../middleware/authMiddleware');

router.post('/categories', verifyTokenAndRole([1]), courseCategoryController.createCategory);
router.put('/categories/:id', verifyTokenAndRole([1]), courseCategoryController.updateCategory);
router.delete('/categories/:id', verifyTokenAndRole([1]), courseCategoryController.deleteCategory);
router.get('/categories/getAllCategory', courseCategoryController.getAllCategory);
router.get('/categories/list', courseCategoryController.getPaginatedCourseCategories);
router.get('/categories/:id', courseCategoryController.getCourseCategoryById);

module.exports = router;
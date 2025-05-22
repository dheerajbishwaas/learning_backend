const express = require('express');
const router = express.Router();
const courseCategoryController = require('../controllers/courseCategoryController');
const {verifyTokenAndRole} = require('../middleware/authMiddleware');
const upload = require('../middleware/upload'); // <--- Import the upload middleware

router.post('/categories',verifyTokenAndRole([1]), upload.uploadToMemory.single('icon'),courseCategoryController.createCategory);
router.put('/categories/:id', verifyTokenAndRole([1]),upload.uploadToMemory.single('icon'), courseCategoryController.updateCategory);
router.delete('/categories/:id', verifyTokenAndRole([1]), courseCategoryController.deleteCategory);
router.get('/categories/getAllCategory', courseCategoryController.getAllCategory);
router.get('/categories/getAllCategorys', courseCategoryController.getAllCategorys);
router.get('/categories/list', courseCategoryController.getPaginatedCourseCategories);
router.get('/categories/:id', courseCategoryController.getCourseCategoryById);
router.get('/all',courseCategoryController.getPaginatedCourse);
module.exports = router;
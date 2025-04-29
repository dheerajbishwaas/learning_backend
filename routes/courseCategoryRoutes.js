const express = require('express');
const router = express.Router();
const courseCategoryController = require('../controllers/courseCategoryController');
const {verifyTokenAndRole} = require('../middleware/authMiddleware');

router.post('/categories', verifyTokenAndRole([1]), courseCategoryController.createCategory);
router.put('/categories/:id', verifyTokenAndRole([1]), courseCategoryController.updateCategory);
router.delete('/categories/:id', verifyTokenAndRole([1]), courseCategoryController.deleteCategory);

module.exports = router;
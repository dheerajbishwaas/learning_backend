const express = require('express');
const router = express.Router();
const { createCourse,getPaginatedCourses } = require('../controllers/courseController');
const { verifyTokenAndRole } = require('../middleware/authMiddleware');

router.post('/create',verifyTokenAndRole([1]), createCourse);
router.get('/list',verifyTokenAndRole([1]), getPaginatedCourses);
module.exports = router;

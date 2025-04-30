const express = require('express');
const router = express.Router();
const { createCourse } = require('../controllers/courseController');
const { verifyTokenAndRole } = require('../middleware/authMiddleware');

router.post('/create',verifyTokenAndRole([1]), createCourse);

module.exports = router;

const express = require('express');
const router = express.Router();
const { importCourse,getCourse,getPaginatedCourse,createCourse,getPaginatedCourses,getCourseById,updateCourse,deleteCourseById} = require('../controllers/courseController');
const { verifyTokenAndRole } = require('../middleware/authMiddleware');

router.post('/create',verifyTokenAndRole([1]), createCourse);
router.post('/importCourse',verifyTokenAndRole([1]),importCourse);
router.get('/getCourseById/:id',verifyTokenAndRole([1]), getCourseById);
router.get('/getbyid/:id', getCourse);
router.put('/update/:id',verifyTokenAndRole([1]), updateCourse);
router.get('/list', getPaginatedCourses);
router.delete('/:id', deleteCourseById);

module.exports = router;

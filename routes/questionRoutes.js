const express = require('express');
const router = express.Router();
const { generateQuestions } = require('../controllers/questionController');

const { verifyTokenAndRole } = require('../middleware/authMiddleware');

router.post('/generate', verifyTokenAndRole([1, 2, 3]), generateQuestions);

module.exports = router;

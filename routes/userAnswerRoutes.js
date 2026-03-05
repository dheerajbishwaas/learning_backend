const express = require('express');
const router = express.Router();
const { verifyTokenAndRole } = require('../middleware/authMiddleware');
const { storeUserAnswer } = require('../controllers/userAnswerController');

router.post('/store', verifyTokenAndRole([1, 2, 3]), storeUserAnswer);

module.exports = router;

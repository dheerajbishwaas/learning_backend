const express = require('express');
const router = express.Router();
const { getChapterMessages, createChapterMessage } = require('../controllers/discussionController');
const { verifyTokenAndRole } = require('../middleware/authMiddleware');

router.get('/messages', getChapterMessages);
router.post('/messages', verifyTokenAndRole([1, 2, 3]), createChapterMessage);

module.exports = router;

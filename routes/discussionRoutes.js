const express = require('express');
const router = express.Router();
const { getChapterMessages, createChapterMessage, getAdminMessages, markMessageRead } = require('../controllers/discussionController');
const { verifyTokenAndRole } = require('../middleware/authMiddleware');

router.get('/admin/messages', verifyTokenAndRole([1]), getAdminMessages);
router.patch('/admin/messages/:id/read', verifyTokenAndRole([1]), markMessageRead);
router.get('/messages', getChapterMessages);
router.post('/messages', verifyTokenAndRole([1, 2, 3]), createChapterMessage);

module.exports = router;

const express = require('express');
const router = express.Router();
const { getQuestionByGroupId, getUsersByGroupScore, getRecentGroupsWithUserCount } = require('../controllers/questionController');
const { verifyTokenAndRole } = require('../middleware/authMiddleware');

// Public API (no authentication required)
router.get('/recent_groups_with_user_count_public', getRecentGroupsWithUserCount);

// Private APIs (authentication required)
router.get('/question_by_group_id', verifyTokenAndRole([1, 2, 3]), getQuestionByGroupId);
router.get('/users_by_group_score', verifyTokenAndRole([1, 2, 3]), getUsersByGroupScore);
router.get('/recent_groups_with_user_count', verifyTokenAndRole([1, 2, 3]), getRecentGroupsWithUserCount);

module.exports = router;

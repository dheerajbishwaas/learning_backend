const express = require('express');
const router = express.Router();
const { verifyTokenAndRole, verifyTokenOptional } = require('../middleware/authMiddleware');
const { storeUserAnswer, getWeeklyTopLeaderboard, getRecentBattles } = require('../controllers/userAnswerController');

router.post('/store', verifyTokenAndRole([1, 2, 3]), storeUserAnswer);
router.get('/leaderboard/current-week', verifyTokenOptional, getWeeklyTopLeaderboard);
router.get('/leaderboard/recent-battles', getRecentBattles);

module.exports = router;

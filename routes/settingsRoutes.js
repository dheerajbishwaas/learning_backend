const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const { verifyTokenAndRole } = require('../middleware/authMiddleware');

// GET /api/settings - Get current settings (admin only)
router.get('/', verifyTokenAndRole([1]), settingsController.getSettings);

// PUT /api/settings - Update settings (admin only)
router.put('/', verifyTokenAndRole([1]), settingsController.updateSettings);

module.exports = router;

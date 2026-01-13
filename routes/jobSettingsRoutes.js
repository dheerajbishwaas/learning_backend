const express = require('express');
const router = express.Router();
const {
    createJobSettings,
    getJobSettings,
    updateJobSettings,
    addFeed,
    updateFeed,
    deleteFeed
} = require('../controllers/jobSettingsController');
const { verifyTokenAndRole } = require('../middleware/authMiddleware');

// Public or Authenticated User Route (Read Only)
// Depending on requirement, this might need to be open to public if the frontend jobs page is public
router.get('/', getJobSettings);

// Admin Only Routes
router.post('/create', verifyTokenAndRole([1]), createJobSettings);
router.put('/update', verifyTokenAndRole([1]), updateJobSettings);
router.post('/feed', verifyTokenAndRole([1]), addFeed);
router.put('/feed/:feedId', verifyTokenAndRole([1]), updateFeed);
router.delete('/feed/:feedId', verifyTokenAndRole([1]), deleteFeed);

module.exports = router;

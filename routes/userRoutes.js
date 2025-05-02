const express = require('express');
const { verifyTokenAndRole } = require('../middleware/authMiddleware');  // Import the middleware
const router = express.Router();

const { getAllUsers,logIn,userCreate,logout } = require('../controllers/userController');

router.get('/', getAllUsers);
router.post('/login', logIn);
router.post('/logout', logout);
router.post('/create', userCreate);

router.get('/dashboard', verifyTokenAndRole([1]), (req, res) => {  // Only accessible by admin (role 1)
    res.json({ message: 'Welcome Admin!' });
});

module.exports = router;
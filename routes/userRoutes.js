const express = require('express');
const { verifyTokenAndRole } = require('../middleware/authMiddleware');  // Import the middleware
const router = express.Router();

const {getAllCategory,googlAuth,googleAuthCallback,contactus,getAllUsers,logIn,userCreate,logout,getPaginatedUsers,getUserById,userUpdate} = require('../controllers/userController');

router.get('/',getUserById);
router.get('/google',googlAuth);
router.get('/google/callback',googleAuthCallback);
router.get('/getuser/:userId', verifyTokenAndRole([1,2]),getUserById);
router.post('/login', logIn);
router.post('/logout', logout);
router.post('/create', userCreate);
router.put('/:userId', verifyTokenAndRole([1,2]), userUpdate);
router.get('/getPaginatedUsers', verifyTokenAndRole([1]), getPaginatedUsers);
router.post('/contact', contactus);


router.get('/dashboard', verifyTokenAndRole([1]), (req, res) => {  // Only accessible by admin (role 1)
    res.json({ message: 'Welcome Admin!' });
});

module.exports = router;

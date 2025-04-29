const jwt = require('jsonwebtoken');
const User = require('../models/userModel'); 

const verifyTokenAndRole = (allowedRoles) => {
  return async (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];  // Extract token from Authorization header
    console.log('JWT_SECRET:', process.env.JWT_SECRET);

    if (!token) {
      return res.status(403).json({ message: 'Access denied, no token provided' });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);  // Decode JWT token using secret
      const user = await User.findById(decoded.userId);  // Get user info from DB

      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Check if the user's role is included in allowedRoles
      if (!allowedRoles.includes(user.role)) {
        return res.status(403).json({ message: 'Forbidden, you do not have the required role' });
      }

      req.user = user;  // Attach user data to the request object
      next();  // Proceed to the next middleware or route handler

    } catch (error) {
      return res.status(401).json({ message: 'Invalid token' });
    }
  };
};

module.exports = { verifyTokenAndRole };

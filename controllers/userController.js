const cookie = require('cookie');
const User = require('../models/userModel');
const bcrypt = require('bcrypt');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');
dotenv.config();

const getAllUsers = async (req, res) => {
  try {
    const users = await User.find();

    res.status(200).json({'msg':'Hello it wor '});
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


const userCreate = async (req, res) => {
  try {
    const { name, email, username, password, role } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(400).json({ message: 'Email or Username already exists' });
    }

    // Hash Password
    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      name,
      email,
      username,
      password: hashedPassword,
      role: role || 'user',
    });

    await newUser.save();

    res.status(201).json({ message: 'User created successfully', user: newUser });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }

};

const logIn = async (req, res) => {
  try {
    const { username, password } = req.body;

    // Check if user exists by username
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(400).json({ message: 'Invalid Username or Password' });
    }

    // Match password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid Username or Password' });
    }

    // Check if status is active
    if (user.status !== 1) {
      return res.status(403).json({ message: 'Account is inactive. Contact Admin.' });
    }

    // Create JWT Token
    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '1d' } // Token valid for 7 days
    );
    res.setHeader('Set-Cookie', cookie.serialize('token', token, {
      httpOnly: true,
      secure: false, // Set secure flag in production only
      sameSite: 'strict',
      maxAge: 60 * 60 * 24, // 1 day
      path: '/',
    }));
    res.status(200).json({
      message: 'Login Successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        username: user.username,
        role: user.role
      }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

const logout = async (req, res) => {
  try {
    // Clear the token cookie for the current user
    res.clearCookie('token', {
      httpOnly: true, // Cookie will be sent only to the server
      secure: true,  // Set to true in production (use HTTPS)
      sameSite: 'None',
      path: '/', // Path of the cookie
    });

    res.status(200).json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

module.exports = { getAllUsers , logIn, userCreate,logout};
const cookie = require('cookie');
const User = require('../models/userModel');
const bcrypt = require('bcrypt');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');
const nodemailer = require("nodemailer");
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
    // Get IP address from headers or connection
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    const newUser = new User({
      name,
      email,
      username,
      password: hashedPassword,
      role: role || 'user',
      ipAddress: ip,
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

    res.setHeader('Set-Cookie', [
      `token=${token}; Secure; SameSite=None; Path=/; Max-Age=86400; Domain=${(process.env.FRONTEND_URL)}`
    ]);

    res.cookie('token', token, {
      httpOnly: false, // Middleware ke liye accessible hona chahiye
      secure: true,    // HTTPS ke liye
      sameSite: 'None',
      maxAge: 24 * 60 * 60 * 1000, // 1 din
      path: '/',
    });

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
      sameSite: 'none',
      path: '/', // Path of the cookie
    });

    res.status(200).json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

const getPaginatedUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;  // Page number (default: 1)
    const limit = parseInt(req.query.limit) || 10;  // Limit per page (default: 10)

    const skip = (page - 1) * limit;  // Calculate the number of records to skip

    // Get the current user ID from the request (assumes the user is authenticated)
    const currentUserId = req.user._id;

    // Fetch user data excluding the current user
    const [users, total] = await Promise.all([
      User.find({ _id: { $ne: currentUserId } })  // Exclude current user
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 }),  // Sort by createdAt (descending)
      User.countDocuments({ _id: { $ne: currentUserId } })  // Total count excluding current user
    ]);

    res.status(200).json({
      success: true,
      data: users,
      total,  // Total count of users excluding the current user
      page,   // Current page number
      limit,  // Records per page
    });
  } catch (err) {
    console.error('Error in getPaginatedUsers:', err);
    res.status(500).json({
      success: false,
      message: 'Server Error',
    });
  }
};

const userUpdate = async (req, res) => {
  try {
    const { userId } = req.params; // User ID to update
    const { name, email, username, password, role } = req.body;

    // Check if email or username already exists (except for the current user)
    const existingUser = await User.findOne({
      $and: [
        { _id: { $ne: userId } },  // Exclude current user
        { $or: [{ email }, { username }] }  // Check if email or username exists
      ]
    });

    if (existingUser) {
      return res.status(400).json({ message: 'Email or Username already exists' });
    }

    // Find the user by ID and update
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Hash password if it is provided in the update
    if (password) {
      user.password = await bcrypt.hash(password, 10);
    }

    // Update user fields
    user.name = name || user.name;
    user.email = email || user.email;
    user.username = username || user.username;
    user.role = role || user.role;

    await user.save();

    res.status(200).json({ message: 'User updated successfully', user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

const getUserById = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId).select('-password'); // hide password

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json({ success: true, user });
  } catch (error) {
    console.error('Error in getUserById:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const contactus = async (req, res) => {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const { name, email, message } = req.body;

  // Step 1: Transporter setup (Gmail SMTP)
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: process.env.SMTP_AUTH, // true for port 465
    auth: {
      user: process.env.SMTP_UNAME, // Gmail address
      pass: process.env.SMTP_PASSWORD,  // App password
    },
  });

  // Step 2: Mail Options
  const mailOptions = {
    from: `"${name}" <${email}>`, // Sender info
    to: process.env.ADMIN_MAIL, // 👈 Jis email par mail receive karni hai
    subject: "New Contact Form Submission",
    html: `
      <p><strong>Name:</strong> ${name}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Message:</strong><br/>${message}</p>
      <p><strong>User IP:</strong><br/>${ip}</p>
    `,
  };

  // Step 3: Send mail
  try {
    await transporter.sendMail(mailOptions);
    res.status(200).json({ success: true, message: "Message sent successfully!" });
  } catch (error) {
    console.error("Email error:", error);
    res.status(500).json({ success: false, message: "Something went wrong!" });
  }
};

module.exports = { contactus,getAllUsers , logIn, userCreate,logout,getPaginatedUsers ,userUpdate,getUserById };

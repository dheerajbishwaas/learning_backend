const cookie = require('cookie');
const Visitor = require('../models/visitorModel');
const User = require('../models/userModel');
const bcrypt = require('bcrypt');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');
const nodemailer = require("nodemailer");
const axios = require('axios');
const crypto = require('crypto');

dotenv.config();

const getAllUsers = async (req, res) => {
  try {
    const users = await User.find();

    res.status(200).json({ 'msg': 'Hello it wor ' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const googlAuth = async (req, res) => {
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${process.env.GOOGLE_CLIENT_ID}` +
    `&redirect_uri=${process.env.FRONTEND_URL}/auth/google-callback` +
    `&response_type=code` +
    `&scope=profile email` +
    `&access_type=offline` +
    `&prompt=consent`;
  res.redirect(authUrl);
}


const googleAuthCallback = async (req, res) => {
  const { code } = req.query;

  try {
    // 1. Exchange authorization code for access token
    const { data: tokenData } = await axios.post('https://oauth2.googleapis.com/token', {
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      code,
      redirect_uri: `${process.env.FRONTEND_URL}/auth/google-callback`,
      grant_type: 'authorization_code',
    });

    // 2. Get user profile using access token
    const { data: profile } = await axios.get(
      'https://www.googleapis.com/oauth2/v1/userinfo?alt=json',
      { headers: { Authorization: `Bearer ${tokenData.access_token}` } }
    );

    // 3. Check if user already exists
    let user = await User.findOne({ email: profile.email });

    if (!user) {
      const hashedPassword = await bcrypt.hash(profile.id, 10); // use Google ID as dummy password
      const forwarded = req.headers['x-forwarded-for'];
      const ip = forwarded ? forwarded.split(',')[0].trim() : req.socket.remoteAddress;


      user = new User({
        name: profile.name,
        email: profile.email,
        username: profile.email,
        googleId: profile.id,
        password: hashedPassword,
        role: '2', // standard user
        status: 1,
        ipAddress: ip,
      });

      await user.save();
    }

    // 4. Account status check
    if (user.status !== 1) {
      return res.status(403).json({ message: 'Account is inactive. Contact Admin.' });
    }

    // 5. Generate JWT token
    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.setHeader('Set-Cookie', [
      `token=${token}; Secure; SameSite=None; Path=/; Max-Age=86400; Domain=${(process.env.FRONTEND_URL)}`
    ]);

    res.cookie('token', token, {
      httpOnly: false,
      secure: true,
      sameSite: 'None',
      maxAge: 24 * 60 * 60 * 1000, // 1 din
      path: '/',
    });

    // 6. Send token and user info for client-side storage
    return res.status(200).json({
      message: 'Google login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        username: user.username,
        role: user.role,
      },
    });

  } catch (err) {
    console.error('Google Auth Error:', err);
    res.status(400).json({
      success: false,
      message: 'Google authentication failed',
    });
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
    const forwarded = req.headers['x-forwarded-for'];
    const ip = forwarded ? forwarded.split(',')[0].trim() : req.socket.remoteAddress;


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
    const page = parseInt(req.query.page) || 1;       // Page number
    const limit = parseInt(req.query.limit) || 10;    // Rows per page
    const search = req.query.search || '';            // Search term (optional)
    const skip = (page - 1) * limit;

    const currentUserId = req.user._id;

    // Build search filter (case-insensitive partial match)
    const searchFilter = search
      ? {
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { username: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
        ],
      }
      : {};

    // Combine filters: exclude current user + search filter
    const filter = {
      _id: { $ne: currentUserId },
      ...searchFilter,
    };

    // Fetch users and total count in parallel
    const [users, total] = await Promise.all([
      User.find(filter)
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 }),
      User.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: users,
      total,
      page,
      limit,
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

const forgotPassword = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ success: false, message: 'Email is required' });
  }

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ success: false, message: 'Email does not exist' });
    }

    // Generate secure token and expiry time (15 min)
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = Date.now() + 15 * 60 * 1000; // 15 minutes

    // Save token and expiry in DB
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = resetTokenExpiry;
    await user.save();

    // Send reset link email
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: process.env.SMTP_AUTH === 'true',
      auth: {
        user: process.env.SMTP_UNAME,
        pass: process.env.SMTP_PASSWORD,
      },
    });

    const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`;

    const mailOptions = {
      from: `"Support Team" <${process.env.SMTP_UNAME}>`,
      to: email,
      subject: 'Reset Your Password',
      html: `
        <p>Hi ${user.name || ''},</p>
        <p>You requested to reset your password.</p>
        <p><a href="${resetLink}" target="_blank">Click here to reset</a></p>
        <p>This link will expire in 15 minutes.</p>
        <br/>
        <p>If you didn’t request this, you can ignore this email.</p>
        <p>Thanks,<br/>Tutohub Team</p>
      `,
    };

    await transporter.sendMail(mailOptions);

    return res.status(200).json({
      success: true,
      message: 'Reset link has been sent to your email.',
    });
  } catch (err) {
    console.error('Forgot password error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to send reset email. Please try again.',
    });
  }
};

const resetPassword = async (req, res) => {
  const { email, token, password } = req.body;

  if (!email || !token || !password) {
    return res.status(400).json({ success: false, message: 'All fields are required.' });
  }

  try {
    const user = await User.findOne({
      email,
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid or expired reset link.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    user.password = hashedPassword;
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    await user.save();

    // Nodemailer transporter setup (env vars se)
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: process.env.SMTP_AUTH === 'true',
      auth: {
        user: process.env.SMTP_UNAME,
        pass: process.env.SMTP_PASSWORD,
      },
    });

    // Mail content for user
    const mailOptions = {
      from: `"TutoHub" <${process.env.SMTP_UNAME}>`, // From aapka email hi hoga
      to: email,
      subject: 'Your Password Has Been Reset',
      html: `
        <p>Hello,</p>
        <p>Your password has been successfully reset.</p>
        <p>If you did not perform this action, please contact us immediately or reset your password again <a href="${process.env.FRONTEND_URL}/forgot-password">Click here</a>.</p>
        <br/>
        <p>Thank you,<br/>TutoHub Support Team</p>
      `,
    };

    await transporter.sendMail(mailOptions);

    return res.status(200).json({ success: true, message: 'Password has been successfully reset.' });
  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({ success: false, message: 'Unable to reset password.' });
  }
};


const feedback = async (req, res) => {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const { feedback, feedbackType, email, pageUrl } = req.body;

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
    from: `"${email}" <${email}>`,
    to: process.env.ADMIN_MAIL,
    subject: "Feedback Form Submission",
    html: `
      <p><strong>FeedbackType:</strong> ${feedbackType}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Feedback:</strong><br/>${feedback}</p>
      <p><strong>User IP:</strong><br/>${ip}</p>
      <p><strong>PageUrl:</strong><br/>${pageUrl}</p>
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

const visitorTrack = async (req, res) => {
    try {
        const forwarded = req.headers['x-forwarded-for'];
        const ipAddress = forwarded ? forwarded.split(',')[0].trim() : req.socket.remoteAddress;
        const { userAgent, referrer, pageUrl } = req.body; // Expecting these from the POST body

        let visitor = await Visitor.findOne({ ipAddress: ipAddress });

        if (visitor) {
            visitor.visits += 1;
            if (pageUrl && !visitor.pages.includes(pageUrl)) {
                visitor.pages.push(pageUrl);
            }
            await visitor.save();
            res.status(200).json({ message: 'Visitor updated', visitor });
        } else {
            const newVisitor = new Visitor({
                ipAddress: ipAddress,
                userAgent: userAgent,
                referrer: referrer,
                visits: 1,
                pages: pageUrl ? [pageUrl] : [],
            });
            await newVisitor.save();
            res.status(201).json({ message: 'New visitor logged', visitor: newVisitor });
        }
    } catch (error) {
        console.error('Error logging manual visit:', error);
        res.status(500).json({ message: 'Failed to log visit', error: error.message });
    }
}

module.exports = { visitorTrack, feedback, resetPassword, forgotPassword, googleAuthCallback, googlAuth, contactus, getAllUsers, logIn, userCreate, logout, getPaginatedUsers, userUpdate, getUserById };
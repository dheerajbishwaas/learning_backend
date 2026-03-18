const express = require('express');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const userRoutes = require('./routes/userRoutes');
const productRoutes = require('./routes/productRoutes');
const courseCategoryRoutes = require('./routes/courseCategoryRoutes');
const courseRoutes = require('./routes/courseRoute');
const cors = require('cors');
const path = require('path');

// Load environment variables
dotenv.config();
const allowedOrigins = process.env.FRONTEND_URLS.split(',');

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(cors({ origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }, credentials: true }));  // Allow all origins (for development)

// Serve static files from the uploads folder
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/job-settings', require('./routes/jobSettingsRoutes'));
app.use('/api/blogs', require('./routes/blogRoutes'));
app.use('/api/settings', require('./routes/settingsRoutes'));
app.use('/api', require('./routes/questionByGroupRoutes'));
app.use('/api/user-answers', require('./routes/userAnswerRoutes'));

const courseRouter = express.Router();
courseRouter.use('/', courseRoutes);
courseRouter.use('/', courseCategoryRoutes);
app.use('/api/course', courseRouter);

app.use('/api/questions', require('./routes/questionRoutes'));


// Database connection 
require('./config/dbConfig');

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

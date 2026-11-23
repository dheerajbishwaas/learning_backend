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
const allowedOrigins = (process.env.FRONTEND_URLS || '')
  .split(',')
  .map(origin => origin.trim().toLowerCase().replace(/\/$/, ''));

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);

    const cleanOrigin = origin.toLowerCase().replace(/\/$/, '');

    if (allowedOrigins.includes(cleanOrigin) || allowedOrigins.includes('*')) {
      callback(null, true);
    } else {
      console.log("Blocked:", cleanOrigin);
      callback(null, true); // 👈 TEMP allow all (debug)
      // callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Guest-Token', 'X-Requested-With', 'Accept']
}));
app.options('*', cors());
// Serve static files from the uploads folder
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/job-settings', require('./routes/jobSettingsRoutes'));
app.use('/api/blogs', require('./routes/blogRoutes'));
app.use('/api/settings', require('./routes/settingsRoutes'));
app.use('/api/discussions', require('./routes/discussionRoutes'));
app.use('/api', require('./routes/questionByGroupRoutes'));
app.use('/api/user-answers', require('./routes/userAnswerRoutes'));

const courseRouter = express.Router();
courseRouter.use('/', courseRoutes);
courseRouter.use('/', courseCategoryRoutes);
app.use('/api/course', courseRouter);

app.use('/api/questions', require('./routes/questionRoutes'));

// PDF Assistant module routes
app.use('/api/pdf', require('./modules/pdf-assistant/routes/pdfRoutes'));

// Initialize background worker and cleanup scheduler for PDF Assistant
if (process.env.PDF_WORKER_MODE !== 'separate') {
  const queueService = require('./modules/pdf-assistant/services/queueService');
  const cleanupService = require('./modules/pdf-assistant/services/cleanupService');
  queueService.startWorker();
  cleanupService.startScheduler();
}

// Database connection 
require('./config/dbConfig');

// Start server
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Graceful shutdown handling
function gracefulShutdown(signal) {
  console.log(`Received ${signal}. Shutting down gracefully...`);
  if (process.env.PDF_WORKER_MODE !== 'separate') {
    try {
      const queueService = require('./modules/pdf-assistant/services/queueService');
      const cleanupService = require('./modules/pdf-assistant/services/cleanupService');
      queueService.stopWorker();
      cleanupService.stopScheduler();
    } catch (e) {
      console.error('Error stopping PDF services:', e);
    }
  }
  server.close(() => {
    mongoose.connection.close(false, () => {
      console.log('Server closed and MongoDB connection disconnected.');
      process.exit(0);
    });
  });
  setTimeout(() => {
    console.error('Force shutdown after timeout.');
    process.exit(1);
  }, 10000).unref();
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

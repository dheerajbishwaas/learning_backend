const express = require('express');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const userRoutes = require('./routes/userRoutes');
const productRoutes = require('./routes/productRoutes');
const courseCategoryRoutes = require('./routes/courseCategoryRoutes');
const courseRoutes = require('./routes/courseRoute');
const cors = require('cors');

// Load environment variables
dotenv.config();

const app = express();

// Middleware
app.use(express.json());
app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));  // Allow all origins (for development)

// Routes
app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);

const courseRouter = express.Router();
courseRouter.use('/', courseRoutes);
courseRouter.use('/', courseCategoryRoutes);
app.use('/api/course', courseRouter);


// Database connection 
require('./config/dbConfig');

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
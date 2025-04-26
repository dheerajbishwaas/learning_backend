const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();
console.log(process.env.DB_URI);
mongoose.connect(process.env.DB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Database connected successfully'))
  .catch(err => console.log('Database connection error: ', err));
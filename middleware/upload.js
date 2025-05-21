// middleware/upload.js
const multer = require('multer');
const fs = require('fs');
const path = require('path');

// Define category upload path
const categoryUploadPath = path.join(__dirname, '../uploads/category');

// Create the folder if it doesn't exist
if (!fs.existsSync(categoryUploadPath)) {
  fs.mkdirSync(categoryUploadPath, { recursive: true });
}

// Multer storage config
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, categoryUploadPath);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1e9) + ext;
    cb(null, uniqueName);
  }
});

// Only allow image uploads
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

const upload = multer({ storage, fileFilter });

module.exports = upload;

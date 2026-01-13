// middleware/upload.js
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { Client } = require('basic-ftp');
const { PassThrough } = require('stream');
require('dotenv').config();

// Define category upload path (local fallback)
const categoryUploadPath = path.join(__dirname, '../uploads/category');

if (!fs.existsSync(categoryUploadPath)) {
  fs.mkdirSync(categoryUploadPath, { recursive: true });
}

// Multer memory storage for FTP upload
const memoryStorage = multer.memoryStorage();

// Multer disk storage for local upload
const diskStorage = multer.diskStorage({
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

const jsonFileFilter = (req, file, cb) => {
  if (file.mimetype === 'application/json') {
    cb(null, true);
  } else {
    cb(new Error('Only JSON files are allowed!'), false);
  }
};

// Upload middleware with switch
const uploadToLocal = multer({ storage: diskStorage, fileFilter });
const uploadToMemory = multer({ storage: memoryStorage, fileFilter });
const uploadJson = multer({ storage: memoryStorage, fileFilter: jsonFileFilter });

// FTP upload function
async function uploadFileToFTP(buffer, filename, folderName = 'category') {
  const client = new Client();

  try {
    await client.access({
      host: process.env.FTP_HOST,
      user: process.env.FTP_USER,
      password: process.env.FTP_PASSWORD,
      secure: false,
    });

    const uploadPath = process.env.FTP_UPLOAD_PATH
      ? `${process.env.FTP_UPLOAD_PATH.replace(/\/category$/, '')}/${folderName}`
      : `/public_html/uploads/${folderName}`;

    await client.ensureDir(uploadPath);

    // Convert buffer to stream
    const bufferStream = new PassThrough();
    bufferStream.end(buffer);

    // Upload from stream
    await client.uploadFrom(bufferStream, `${uploadPath}/${filename}`);

    console.log(`File uploaded to FTP [${folderName}]:`, filename);

    await client.close();

    return `/uploads/${folderName}/${filename}`;
  } catch (err) {
    console.error('FTP Upload Error:', err.message);
    throw err;
  }
}

module.exports = {
  uploadToLocal,
  uploadToMemory,
  uploadJson,
  uploadFileToFTP
};

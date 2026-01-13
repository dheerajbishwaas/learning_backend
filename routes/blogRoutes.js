const express = require('express');
const router = express.Router();
const blogController = require('../controllers/blogController');
const upload = require('../middleware/upload');

router.post('/', upload.uploadToMemory.single('image'), blogController.createBlog);
router.get('/', blogController.getAllBlogs);
router.get('/:slug', blogController.getBlogBySlug);
// Note: The controller logic expects 'id' in params for update/delete as per my implementation
router.post('/generate', blogController.generateBlog);
router.post('/generate-blog', blogController.generateBlog);
router.post('/import', upload.uploadJson.single('file'), blogController.importBlogs);
router.put('/:id', upload.uploadToMemory.single('image'), blogController.updateBlog);
router.delete('/:id', blogController.deleteBlog);

module.exports = router;

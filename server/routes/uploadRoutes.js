const express = require('express');
const router = express.Router();
const multer = require('multer');
const { protect } = require('../middleware/authMiddleware');
const { uploadLimiter } = require('../middleware/security');
const { uploadImage, uploadProductFile } = require('../controllers/uploadController');

// Store in memory (buffer) — we upload directly to Supabase Storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB hard limit at multer level
});

// Wrap multer so its errors (oversized file, wrong field) return JSON, not HTML.
const handleSingleUpload = (req, res, next) => {
  upload.single('image')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ message: 'File size must be under 2MB' });
      }
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({ message: 'Unexpected file field. Upload the image as "image".' });
      }
      return res.status(400).json({ message: err.message || 'Upload failed' });
    }
    next();
  });
};

// Wrap multer for the product file field "file" so its errors return JSON.
const handleProductFileUpload = (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ message: 'File size must be under 2MB' });
      }
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({ message: 'Unexpected file field. Upload the file as "file".' });
      }
      return res.status(400).json({ message: err.message || 'Upload failed' });
    }
    next();
  });
};

// POST /api/upload/image?folder=profiles|covers|services
// protect first so uploadLimiter can key per-account (req.user.id).
router.post('/image', protect, uploadLimiter, handleSingleUpload, uploadImage);

// POST /api/upload/product-file
router.post('/product-file', protect, uploadLimiter, handleProductFileUpload, uploadProductFile);

module.exports = router;

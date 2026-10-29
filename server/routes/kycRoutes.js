const express = require('express');
const router = express.Router();
const multer = require('multer');
const { protect, requireHost } = require('../middleware/authMiddleware');
const { uploadLimiter } = require('../middleware/security');
const { uploadKycFile, getMyKyc, submitKyc } = require('../controllers/kycController');

// Memory buffer → uploaded straight to the private 'kyc' bucket. 5MB hard cap.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
const handleUpload = (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ message: 'File size must be under 5MB' });
      if (err.code === 'LIMIT_UNEXPECTED_FILE') return res.status(400).json({ message: 'Upload the document as "file".' });
      return res.status(400).json({ message: err.message || 'Upload failed' });
    }
    next();
  });
};

router.get('/me', protect, requireHost, getMyKyc);
router.post('/upload', protect, requireHost, uploadLimiter, handleUpload, uploadKycFile);
router.post('/', protect, requireHost, submitKyc);

module.exports = router;

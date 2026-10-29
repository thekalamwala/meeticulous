const express = require('express');
const router = express.Router();
const multer = require('multer');
const { protect } = require('../middleware/authMiddleware');
const { uploadLimiter } = require('../middleware/security');
const c = require('../controllers/supportController');

// In-memory buffer → straight to Supabase Storage. 2MB hard cap at multer level.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });
const handleImage = (req, res, next) => upload.single('image')(req, res, (err) => {
  if (err) return res.status(400).json({ message: err.code === 'LIMIT_FILE_SIZE' ? 'Image must be under 2MB' : (err.message || 'Upload failed') });
  next();
});

// Host/guest support chat. A participant only ever reaches their own thread
// (ownership is enforced in the controller).
router.get('/hours',                  protect, c.hours);
router.get('/unread',                 protect, c.unread);
router.get('/thread',                 protect, c.getMyThread);
router.get('/threads',                protect, c.listThreads);
router.post('/thread/new',            protect, c.startTopic);
router.get('/thread/:id/messages',    protect, c.getMessages);
router.post('/thread/:id/messages',   protect, c.sendMessage);
router.post('/thread/:id/attachment', protect, uploadLimiter, handleImage, c.uploadAttachment);
router.post('/thread/:id/escalate',   protect, c.escalateThread);
router.post('/thread/:id/rating',     protect, c.rateThread);
router.post('/thread/:id/read',       protect, c.markRead);

module.exports = router;

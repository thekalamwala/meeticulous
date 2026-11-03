/**
 * communityRoutes.js — /api/community. Mounted in server.js.
 * Writes: protect, communityGate, requireWrites, requireTerms, <limiter>, handler.
 * POST /terms skips requireTerms (it is how terms get accepted).
 */
const router = require('express').Router();
const { protect } = require('../middleware/authMiddleware');
const {
  communityGate, requireWrites, requireTerms, postLimiter, commentLimiter, reactionLimiter, reportLimiter,
} = require('../middleware/communityGate');
const c = require('../controllers/communityController');

const write = [protect, communityGate, requireWrites, requireTerms];

router.post('/terms', protect, communityGate, requireWrites, c.acceptTerms);

router.post('/items', ...write, postLimiter, c.createItem);
router.patch('/items/:id', ...write, c.updateItem);
router.delete('/items/:id', ...write, c.deleteItem);
router.post('/items/:id/comments', ...write, commentLimiter, c.createComment);
router.post('/items/:id/accept', ...write, c.acceptAnswer);

router.patch('/comments/:id', ...write, c.updateComment);
router.delete('/comments/:id', ...write, c.deleteComment);

router.post('/reactions', ...write, reactionLimiter, c.addReaction);
router.delete('/reactions', ...write, reactionLimiter, c.removeReaction);

router.post('/reports', ...write, reportLimiter, c.createReport);

module.exports = router;

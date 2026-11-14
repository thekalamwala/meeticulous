const express = require('express');
const router = express.Router();
const {
  createCourse, getMyCourses, updateCourse, deleteCourse,
  getCoursePublic, getCourseContent, getPurchasedCourses,
  createCourseOrder, verifyCoursePayment,
} = require('../controllers/courseController');
const { protect, requireHost } = require('../middleware/authMiddleware');
const { requireFeature } = require('../middleware/requireFeature');

// Public course page (lesson titles only — no video_url).
router.get('/p/:username/:slug', getCoursePublic);

// Buyer (logged in): purchase + watch.
router.get('/purchased', protect, getPurchasedCourses);
router.get('/:id/content', protect, getCourseContent);
router.post('/create-order', protect, requireFeature('course_purchase'), createCourseOrder);
router.post('/verify', protect, requireFeature('course_purchase'), verifyCoursePayment);

// Host CRUD. Creation is Pro-gated server-side (see courseController).
router.get('/mine/all', protect, requireHost, getMyCourses);
router.post('/', protect, requireHost, createCourse);
router.put('/:id', protect, requireHost, updateCourse);
router.delete('/:id', protect, requireHost, deleteCourse);

module.exports = router;

const express = require('express');
const router = express.Router();
const { adminLogin, adminMe, setup2fa, confirm2fa, verify2fa, changePassword } = require('../controllers/adminAuthController');
const { requireAdmin } = require('../middleware/adminMiddleware');
const { authLimiter } = require('../middleware/security');

router.post('/login', authLimiter, adminLogin);
router.post('/2fa-setup', authLimiter, setup2fa);
router.post('/2fa-confirm', authLimiter, confirm2fa);
router.post('/2fa-verify', authLimiter, verify2fa);
// Self-service password change. NOT behind requireAdmin: the forced first-login
// case (must_set_password) has no full session yet and authenticates via the
// short-lived password_change_token in the body. A logged-in admin may instead
// pass their normal Bearer session. The controller verifies the current password
// either way. Rate-limited like the other credential endpoints.
router.post('/change-password', authLimiter, changePassword);
router.get('/me', requireAdmin(), adminMe);

module.exports = router;

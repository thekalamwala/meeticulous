/**
 * adminSecurityRoutes.js — admin IP-blocking management.
 *
 * Mounted at /api/admin/security (behind adminLimiter in server.js). Every route
 * is gated by requireSuperAdmin: managing IP bans / the allowlist is high-risk and
 * restricted to the super role.
 */

const express = require('express');
const router = express.Router();
const { requireSuperAdmin } = require('../middleware/adminMiddleware');
const ctrl = require('../controllers/ipBlockController');

router.get('/blocked-ips',        requireSuperAdmin, ctrl.listBlocked);
router.post('/blocked-ips',       requireSuperAdmin, ctrl.addBlocked);
router.delete('/blocked-ips/:ip', requireSuperAdmin, ctrl.removeBlocked);

router.get('/allowlist',          requireSuperAdmin, ctrl.listAllow);
router.post('/allowlist',         requireSuperAdmin, ctrl.addAllow);
router.delete('/allowlist/:ip',   requireSuperAdmin, ctrl.removeAllow);

module.exports = router;

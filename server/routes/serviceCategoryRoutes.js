/**
 * serviceCategoryRoutes.js
 *
 * Two routers:
 *   adminRouter  — all CRUD, guarded by requireAdmin('settings.manage'),
 *                  mounted at /api/admin/service-categories
 *   publicRouter — read-only active list, unguarded,
 *                  mounted at /api/service-categories
 *
 * Guard pattern mirrors the existing admin categories routes
 * (adminRoutes.js lines 149-152).
 */

const express = require('express');
const { requireAdmin } = require('../middleware/adminMiddleware');
const { protect, requireHost } = require('../middleware/authMiddleware');
const sc = require('../controllers/serviceCategoryController');

// ── Admin router (all CRUD) ───────────────────────────────────────────────────
const adminRouter = express.Router();

adminRouter.get('/',        requireAdmin('settings.manage'), sc.listAdmin);
adminRouter.post('/',       requireAdmin('settings.manage'), sc.create);
// /reorder MUST be before /:id so Express doesn't treat "reorder" as an id param
adminRouter.put('/reorder', requireAdmin('settings.manage'), sc.reorder);
adminRouter.put('/:id',     requireAdmin('settings.manage'), sc.update);
adminRouter.delete('/:id',  requireAdmin('settings.manage'), sc.remove);

// ── Public router (picker / read-only) ───────────────────────────────────────
const publicRouter = express.Router();

publicRouter.get('/', sc.listPublic);
publicRouter.post('/suggest', protect, requireHost, sc.suggest);

module.exports = { adminRouter, publicRouter };

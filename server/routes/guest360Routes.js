/**
 * guest360Routes.js — admin "Guest 360" (read-only v1).
 * Mounted at /api/admin/guest360 (see server.js). Gated by the isolated admin
 * RBAC middleware; both reads use users.view, matching the Host 360 directory.
 *
 * The :key param is a CRM customer key ('p:<10digits>' or 'e:<email>'), URL-
 * encoded by the client. It can contain ':' / '@' — both are legal in a path
 * segment — and is decoded in the controller.
 */
const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../middleware/adminMiddleware');
const g360 = require('../controllers/guest360Controller');

router.get('/', requireAdmin('users.view'), g360.listGuests);
router.get('/:key', requireAdmin('users.view'), g360.getGuest);

// ── Phase 3 write actions (audited) ─────────────────────────────
router.get('/:key/notes',            requireAdmin('users.view'),    g360.listNotes);
router.post('/:key/notes',           requireAdmin('users.edit'),    g360.createNote);
router.delete('/:key/notes/:noteId', requireAdmin('users.edit'),    g360.deleteNote);
router.post('/:key/actions/email',   requireAdmin('email.manage'),  g360.emailGuest);
router.post('/:key/actions/suspend', requireAdmin('users.suspend'), g360.suspendGuest);

module.exports = router;

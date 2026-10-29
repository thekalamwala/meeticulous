/**
 * host360Routes.js — admin "Host 360" module (v3.80).
 * Mounted at /api/admin/host360 (see server.js). Every route is gated by the
 * isolated admin RBAC middleware (requireAdmin(permission)) — mirrors adminRoutes.
 *
 * Static sub-paths (/account-managers) are registered BEFORE '/:id' so Express
 * doesn't match them as the :id param.
 */
const express = require('express');
const router = express.Router();
const multer = require('multer');

const { requireAdmin } = require('../middleware/adminMiddleware');
const h360 = require('../controllers/host360Controller');

// Memory buffer → straight into the private 'kyc' bucket. 5MB hard cap, same as
// the host-facing KYC upload (kycRoutes).
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

// ── Host directory ─────────────────────────────────────────────
router.get('/', requireAdmin('users.view'), h360.listHosts);

// ── Account managers ───────────────────────────────────────────
// Read is users.view (list of names — needed by the Host 360 assign modal and
// list filter for ops/support); writes stay staff.manage (super-exclusive).
router.get('/account-managers',       requireAdmin('users.view'),   h360.listManagers);
router.post('/account-managers',       requireAdmin('staff.manage'), h360.createManager);
router.patch('/account-managers/:id',  requireAdmin('staff.manage'), h360.updateManager);

// ── Single-host command center ─────────────────────────────────
router.get('/:id',            requireAdmin('users.view'),    h360.getHost);
router.get('/:id/usage',      requireAdmin('users.view'),    h360.getUsage);
router.get('/:id/billing',    requireAdmin('finance.view'),  h360.getBilling);
router.get('/:id/timeline',   requireAdmin('users.view'),    h360.getTimeline);
router.get('/:id/customers',  requireAdmin('users.view'),    h360.getCustomers);
router.get('/:id/support',    requireAdmin('support.view'),  h360.getSupport);
// The tab is kyc.view-gated; the admin-uploaded paperwork inside it is filtered
// on documents.view by the controller (v3.81), so a KYC reviewer sees identity
// documents without also getting the commercial file.
router.get('/:id/documents',  requireAdmin('kyc.view'),      h360.getDocuments);
// Unmasked PAN/Aadhaar/bank. kyc.decide, not kyc.view — reading the KYC tab must
// not imply the right to de-mask it. Audited on every call (kyc.pii_revealed).
// Registered before '/:id/documents/:docId' so "reveal" isn't taken as a doc id.
router.get('/:id/documents/reveal',      requireAdmin('kyc.decide'),       h360.revealKycPii);
router.post('/:id/documents',            requireAdmin('documents.manage'), handleUpload, h360.uploadHostDocument);
router.delete('/:id/documents/:docId',   requireAdmin('documents.manage'), h360.deleteHostDocument);

// ── Admin notes ────────────────────────────────────────────────
router.get('/:id/notes',            requireAdmin('users.view'), h360.listNotes);
router.post('/:id/notes',           requireAdmin('users.edit'), h360.createNote);
router.put('/:id/notes/:noteId',    requireAdmin('users.edit'), h360.updateNote);
router.delete('/:id/notes/:noteId', requireAdmin('users.edit'), h360.deleteNote);

// ── Actions ────────────────────────────────────────────────────
router.post('/:id/actions/suspend',   requireAdmin('users.suspend'), h360.suspendHost);
router.post('/:id/actions/plan',       requireAdmin('plans.manage'),  h360.assignHostPlan);
router.post('/:id/actions/assign-am',  requireAdmin('users.edit'),    h360.assignAccountManager);
router.post('/:id/actions/email',      requireAdmin('email.manage'),  h360.emailHost);

module.exports = router;

// server/controllers/inviteAdminController.js
// Admin surface for Invite Links. Gated by the existing referrals.* permissions
// (same marketing/finance audience) — no new permission string, no admin re-login.
// ponytail: reuse referrals.* rather than mint invites.*; split later only if a
// separate gating audience ever appears.
const inviteService = require('../services/inviteService');
const safeError = (res, e) => res.status(500).json({ message: e?.message || 'Server error' });

// GET /api/admin/invite-links — list with per-slug signups.
const list = async (req, res) => {
  try { res.json(await inviteService.listLinks()); } catch (e) { safeError(res, e); }
};

// POST /api/admin/invite-links — create (slug immutable hereafter).
const create = async (req, res) => {
  try {
    const { slug, label, assigned_to, metadata } = req.body || {};
    const row = await inviteService.createLink({
      slug, label, assigned_to, metadata, created_by: req.admin?.id || null,
    });
    res.status(201).json(row);
  } catch (e) {
    if (e?.code === 'DUP')      return res.status(409).json({ message: 'Slug already exists' });
    if (e?.code === 'RESERVED') return res.status(400).json({ message: 'Slug is reserved' });
    if (e?.code === 'BAD_SLUG') return res.status(400).json({ message: 'Invalid slug (a-z 0-9 -, 2-40 chars)' });
    safeError(res, e);
  }
};

// PATCH /api/admin/invite-links/:slug — edit label/assigned_to/active/metadata only.
const update = async (req, res) => {
  try { res.json(await inviteService.updateLink(req.params.slug, req.body || {})); }
  catch (e) { safeError(res, e); }
};

module.exports = { list, create, update };

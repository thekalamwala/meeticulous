/**
 * ipBlockController.js — admin CRUD for the IP blocking system.
 *
 * Reads/writes go through lib/ipBlocklist (which keeps the in-memory cache and the
 * DB in sync). Mounted at /api/admin/security and guarded by requireSuperAdmin —
 * managing IP bans is high-risk, so it is restricted to the super role.
 *
 * IPs are validated with net.isIP (exact IPv4/IPv6 only; CIDR ranges are a future
 * enhancement — the inet column already supports them).
 */

const net = require('net');
const ipBlocklist = require('../lib/ipBlocklist');
const config = require('../config/ipBlockConfig');
const { safeError } = require('../utils/httpError');

const isActive = (row) => !row.expires_at || new Date(row.expires_at).getTime() > Date.now();
const validIp = (ip) => typeof ip === 'string' && net.isIP(ip.trim()) !== 0;
const byNewest = (a, b) => new Date(b.created_at) - new Date(a.created_at);

// GET /api/admin/security/blocked-ips
const listBlocked = async (req, res) => {
  try {
    const rows = await ipBlocklist.listBans();
    const blocked = (rows || []).filter(isActive).map((r) => ({
      ip: r.ip,
      reason: r.reason,
      source: r.source,
      created_by: r.created_by,
      created_at: r.created_at,
      expires_at: r.expires_at,
    })).sort(byNewest);
    return res.json({ blocked });
  } catch (err) { return safeError(res, err); }
};

// POST /api/admin/security/blocked-ips   body: { ip, reason?, permanent?, ttlMs? }
const addBlocked = async (req, res) => {
  try {
    const body = req.body || {};
    const ip = String(body.ip || '').trim();
    if (!validIp(ip)) return res.status(400).json({ message: 'A valid IPv4 or IPv6 address is required.' });

    const permanent = body.permanent === true || body.permanent === 'true';
    const ttlMs = permanent ? null : (Number(body.ttlMs) > 0 ? Number(body.ttlMs) : config.general.ttlMs);

    const result = await ipBlocklist.addBan(ip, {
      reason: body.reason ? String(body.reason).slice(0, 500) : 'Manually blocked by admin',
      source: 'manual',
      ttlMs,
      createdBy: req.admin && req.admin.username ? req.admin.username : null,
    });

    if (!result.ok && result.skipped === 'allowlisted') {
      return res.status(409).json({ message: 'That IP is on the allowlist. Remove it from the allowlist first.' });
    }
    if (!result.ok) return res.status(400).json({ message: result.error || 'Could not block that IP.' });
    return res.status(201).json({ message: 'IP blocked.', ip });
  } catch (err) { return safeError(res, err); }
};

// DELETE /api/admin/security/blocked-ips/:ip
const removeBlocked = async (req, res) => {
  try {
    const ip = String(req.params.ip || '').trim();
    if (!validIp(ip)) return res.status(400).json({ message: 'Invalid IP.' });
    await ipBlocklist.removeBan(ip);
    return res.json({ message: 'IP unblocked.', ip });
  } catch (err) { return safeError(res, err); }
};

// GET /api/admin/security/allowlist
const listAllow = async (req, res) => {
  try {
    const rows = await ipBlocklist.listAllow();
    const allowlist = (rows || []).map((r) => ({
      ip: r.ip,
      note: r.note,
      created_by: r.created_by,
      created_at: r.created_at,
    })).sort(byNewest);
    return res.json({ allowlist });
  } catch (err) { return safeError(res, err); }
};

// POST /api/admin/security/allowlist   body: { ip, note? }
const addAllow = async (req, res) => {
  try {
    const body = req.body || {};
    const ip = String(body.ip || '').trim();
    if (!validIp(ip)) return res.status(400).json({ message: 'A valid IPv4 or IPv6 address is required.' });
    await ipBlocklist.addAllow(ip, {
      note: body.note ? String(body.note).slice(0, 500) : null,
      createdBy: req.admin && req.admin.username ? req.admin.username : null,
    });
    return res.status(201).json({ message: 'IP allowlisted.', ip });
  } catch (err) { return safeError(res, err); }
};

// DELETE /api/admin/security/allowlist/:ip
const removeAllow = async (req, res) => {
  try {
    const ip = String(req.params.ip || '').trim();
    if (!validIp(ip)) return res.status(400).json({ message: 'Invalid IP.' });
    await ipBlocklist.removeAllow(ip);
    return res.json({ message: 'Removed from allowlist.', ip });
  } catch (err) { return safeError(res, err); }
};

module.exports = { listBlocked, addBlocked, removeBlocked, listAllow, addAllow, removeAllow };

// server/controllers/inviteController.js
// Public /invite/:slug surface: landing config + fire-and-forget visit counter.
const inviteService = require('../services/inviteService');

// GET /api/invite/:slug — landing config. Unknown/missing -> {active:false}
// (the client redirects to / — never a 404). Any error also degrades to inert.
const getConfig = async (req, res) => {
  try {
    const cfg = await inviteService.getPublicConfig(req.params.slug);
    if (!cfg) return res.json({ active: false });
    res.json({ label: cfg.label, active: cfg.active });
  } catch (_) { res.json({ active: false }); }
};

// POST /api/invite/:slug/visit — fire-and-forget, de-botted. Responds 204
// immediately; the count write never blocks or errors the client.
const visit = async (req, res) => {
  res.status(204).end();
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip;
  inviteService.recordVisit(req.params.slug, ip, req.headers['user-agent']).catch(() => {});
};

module.exports = { getConfig, visit };

// hostNudgeController — server-tracked dismissal/snooze for the dashboard
// "Next step" card. The ranked nudge itself is computed client-side from data the
// dashboard already loads (client/src/lib/hostNudges.js); the server only owns WHICH
// nudges a host has snoozed and until when, so a dismiss sticks across devices (the
// old localStorage dismissals re-nagged per browser). All access via supabaseAdmin.
const { supabaseAdmin } = require('../config/supabase');

// How long a dismiss hides each nudge before it may resurface. Conversion/activation
// nudges come back (the host's situation changes); the legacy one-time billing nudge
// effectively never does. Server-authoritative — the client just says "dismiss".
const COOLDOWN_DAYS = { upgrade: 14, share: 30, legacy: 3650 };
const DEFAULT_COOLDOWN = 14;
// `kyc` is never dismissible — money is stuck until payouts are set up, so it stays.
const DISMISSIBLE = new Set(['upgrade', 'share', 'legacy']);

// GET /api/host/nudges → { snoozed: { <key>: <iso until> } } for still-active snoozes.
const getHostNudges = async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('host_nudges')
    .select('nudge_key, snooze_until')
    .eq('host_id', req.user.id)
    .gt('snooze_until', new Date().toISOString());
  if (error) {
    console.error('getHostNudges:', error.message);
    return res.json({ snoozed: {} }); // fail soft — showing a nudge beats a broken dashboard
  }
  const snoozed = {};
  for (const r of data || []) snoozed[r.nudge_key] = r.snooze_until;
  return res.json({ snoozed });
};

// POST /api/host/nudges/:key/dismiss → snooze this nudge for its cooldown.
const dismissHostNudge = async (req, res) => {
  const key = String(req.params.key || '').toLowerCase().trim();
  if (!DISMISSIBLE.has(key)) return res.status(400).json({ message: 'This nudge cannot be dismissed.' });
  const nowIso = new Date().toISOString();
  const until = new Date(Date.now() + (COOLDOWN_DAYS[key] ?? DEFAULT_COOLDOWN) * 86400000).toISOString();
  const { error } = await supabaseAdmin
    .from('host_nudges')
    .upsert({ host_id: req.user.id, nudge_key: key, snooze_until: until, updated_at: nowIso },
            { onConflict: 'host_id,nudge_key' });
  if (error) { console.error('dismissHostNudge:', error.message); return res.status(500).json({ message: 'Could not dismiss.' }); }
  return res.json({ ok: true, snooze_until: until });
};

module.exports = { getHostNudges, dismissHostNudge, COOLDOWN_DAYS, DISMISSIBLE };

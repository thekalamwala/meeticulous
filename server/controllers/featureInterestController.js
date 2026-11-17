'use strict';

const { supabaseAdmin } = require('../config/supabase');

// Features a host can register "notify me" interest in while they're unlaunched
// (shown as "Coming to Pro" teasers). Keep in sync with the client ComingSoonTeaser.
const FEATURES = new Set(['courses', 'coupons', 'membership']);

// The table may not be applied yet (migration is held for a founder-run DB change),
// so a "missing relation" error is treated as a successful no-op — the button must
// never 500 pre-migration. Matches the project's schema-fallback convention.
// Narrow to a MISSING TABLE only — Postgres "relation ... does not exist" and
// PostgREST "could not find the table ... in the schema cache". A genuine error
// (a column drift, an FK/constraint violation) must NOT match, so it still 500s.
const isMissingTable = (msg) =>
  /relation ".*" does not exist|could not find the table/i.test(msg || '');

// POST /api/host/feature-interest { feature } → record one-click interest.
async function recordFeatureInterest(req, res) {
  const feature = String(req.body?.feature || '').toLowerCase().trim();
  if (!FEATURES.has(feature)) return res.status(400).json({ message: 'Unknown feature.' });

  try {
    const { error } = await supabaseAdmin
      .from('feature_interest')
      .upsert(
        { host_id: req.user.id, feature, created_at: new Date().toISOString() },
        { onConflict: 'host_id,feature' },
      );
    if (error && !isMissingTable(error.message)) {
      console.error('recordFeatureInterest:', error.message);
      return res.status(500).json({ message: 'Could not save your interest.' });
    }
  } catch (e) {
    // Fail soft — a demand-signal write must never block the UI.
    console.error('recordFeatureInterest:', e.message);
  }
  return res.json({ ok: true });
}

module.exports = { recordFeatureInterest, FEATURES };

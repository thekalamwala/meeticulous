// server/scripts/renameAutoUsernames.js
// One-off: rename hosts still on an OLD auto username ({email-handle}-{4 random},
// e.g. mohinidaf5-p6zi) to the readable name-based one the new generator gives
// (mohini-daf, -2/-3 on a clash). The old name stays in username_history, so
// /old (and everything under it) keeps resolving and 301s to the new one
// (edge middleware for crawlers, RenamedHostRedirect / HostProfile in the SPA).
//
//   cd server && node --env-file=.env scripts/renameAutoUsernames.js            # DRY RUN (default): read-only
//   cd server && node --env-file=.env scripts/renameAutoUsernames.js --apply    # writes — founder-approved only
//
// Scope: hosts only (guest usernames are never public URLs) whose username is
// exactly what the old generator produced from their email handle —
// `${oldBase(email)}-xxxx` or `user-xxxx`, xxxx = 4 base36 chars — and whose
// CURRENT history row is source 'auto' or 'onboarding'. 'onboarding' is included
// because onboarding pre-fills the auto name, so a host who just clicked through
// it is recorded as 'onboarding' with the random name (the live case,
// mohinidaf5-p6zi, is exactly that). A name the host CHANGED to ('user') is never
// touched, and neither is one that merely ends in 4 letters.
// --apply uses the set_onboarding_username RPC (one transaction: retire the old
// history row, insert the new one, update profiles.username).
const { supabaseAdmin } = require('../config/supabase');
const usernameService = require('../services/usernameService');
const { generateUnique } = require('../utils/usernameGenerator');
const { normalizeSlug } = require('../utils/slugNormalize');

// The OLD generator's base (kept here verbatim) — used only to recognise its output.
function oldBaseFromEmail(email) {
  const local = String(email || '').split('@')[0].split('+')[0];
  const base = normalizeSlug(local).replace(/[^a-z0-9-]/g, '').slice(0, 25).replace(/^-+|-+$/g, '');
  return base;
}

// True when `username` is exactly old-generator output for this email.
function isOldAutoUsername(username, email) {
  const m = String(username || '').match(/^(.+)-([a-z0-9]{4})$/);
  if (!m) return false;
  return m[1] === 'user' || m[1] === oldBaseFromEmail(email);
}

// Mask an email for logs: mo****@gmail.com
const mask = (e) => String(e || '').replace(/^(.{2})[^@]*/, '$1****');

async function findCandidates() {
  const { data: rows, error } = await supabaseAdmin
    .from('username_history')
    .select('user_id, username, source, is_current')
    .in('source', ['auto', 'onboarding']).eq('is_current', true);
  if (error) throw error;
  if (!rows || !rows.length) return [];
  const { data: profiles, error: pErr } = await supabaseAdmin
    .from('profiles')
    .select('id, name, email, username, role')
    .in('id', rows.map((r) => r.user_id))
    .eq('role', 'host');
  if (pErr) throw pErr;
  return (profiles || []).filter((p) => isOldAutoUsername(p.username, p.email));
}

async function currentSources(ids) {
  if (!ids.length) return [];
  const { data } = await supabaseAdmin.from('username_history').select('user_id, source').in('user_id', ids).eq('is_current', true);
  return data || [];
}

async function main() {
  const apply = process.argv.includes('--apply');
  const candidates = await findCandidates();
  console.log(`[rename-auto-usernames] ${apply ? 'APPLY' : 'DRY RUN (read-only)'}: ${candidates.length} host(s) on an old random-suffix username`);
  const sourceOf = new Map((await currentSources(candidates.map((c) => c.id))).map((r) => [r.user_id, r.source]));
  for (const p of candidates) {
    // eslint-disable-next-line no-await-in-loop
    const proposed = await generateUnique(usernameService.usernameExists, { name: p.name, email: p.email });
    console.log(`  ${p.id}  name="${p.name || ''}"  email=${mask(p.email)}  source=${sourceOf.get(p.id)}  ${p.username}  ->  ${proposed}`);
    if (!apply) continue;
    // eslint-disable-next-line no-await-in-loop
    const r = await usernameService.setOnboardingUsername(p.id, proposed);
    console.log(`    ${r && r.ok ? 'renamed' : `FAILED (${(r && r.reason) || 'unknown'})`}; /${p.username} now redirects to /${proposed}`);
  }
  if (!apply && candidates.length) console.log('Nothing written. Re-run with --apply (founder-approved) to rename.');
}

if (require.main === module) {
  main().then(() => process.exit(0)).catch((e) => { console.error('[rename-auto-usernames] failed:', e.message); process.exit(1); });
}

module.exports = { isOldAutoUsername, oldBaseFromEmail };

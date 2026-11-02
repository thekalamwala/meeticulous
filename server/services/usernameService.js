// Username resolution + change, backed by the username_history table.
// History is the source of truth; profiles.username is a denormalized cache.

const { supabaseAdmin } = require('../config/supabase');
const { generateUnique } = require('../utils/usernameGenerator');
const { normalizeSlug } = require('../utils/slugNormalize');
const { isStaticReserved } = require('../config/reservedNamespaces');
const { isBlocked } = require('../utils/adultContentFilter');

// True if a username has EVER been used (current or historical) — enforces
// global non-reuse and feeds the generator's uniqueness loop.
// Uses an exact match on the stored lower-cased value so that SQL wildcard
// characters (% and _) in the slug are treated literally. isValidSlug()
// already blocks those characters upstream; this is defence-in-depth.
async function usernameExists(slug) {
  const normalized = String(slug).toLowerCase().trim();
  const { data } = await supabaseAdmin
    .from('username_history')
    .select('id')
    .eq('username', normalized)
    .maybeSingle();
  return !!data;
}

// Returns the user_id that owns a given username (current OR historical),
// or null if the name has never been used. Used by claimSlug to distinguish
// "taken by someone else" from "taken by me — idempotent re-claim".
async function usernameOwner(slug) {
  const normalized = String(slug).toLowerCase().trim();
  const { data } = await supabaseAdmin
    .from('username_history')
    .select('user_id')
    .eq('username', normalized)
    .maybeSingle();
  return data?.user_id ?? null;
}

// Resolve a slug to its owner + the owner's CURRENT username.
// Returns null if the slug was never used.
//   { userId, currentUsername, isCurrent }
async function resolve(slug) {
  const s = String(slug || '').toLowerCase();
  if (!s) return null;

  const { data: row } = await supabaseAdmin
    .from('username_history')
    .select('user_id, is_current')
    .ilike('username', s)
    .maybeSingle();
  if (!row) {
    // History is written best-effort (see recordInitialUsername) and was never
    // backfilled for pre-v3.17 accounts — 28 of 59 live prod usernames have no
    // history row (checked 2026-07-19). History miss therefore does NOT mean
    // "never existed": fall back to profiles before saying not-found. This
    // matters since the edge middleware turns an explicit resolver 404 into a
    // real HTTP 404 for the profile URL.
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id, username')
      .ilike('username', s)
      .maybeSingle();
    if (!profile) return null;
    return { userId: profile.id, currentUsername: profile.username, isCurrent: true };
  }

  const { data: current } = await supabaseAdmin
    .from('username_history')
    .select('username')
    .eq('user_id', row.user_id)
    .eq('is_current', true)
    .maybeSingle();

  return {
    userId: row.user_id,
    currentUsername: current?.username || null,
    isCurrent: !!row.is_current,
  };
}

// Generate a unique auto username ({email-handle}-{4 random}) for a new account.
// Idempotent-ish: callers use this once at account creation. No email → "user-xxxx".
async function createInitialUsername(email) {
  return generateUnique(usernameExists, email);
}

// Record an initial/auto alias in history. Safe to call repeatedly — the global
// unique index + ON CONFLICT DO NOTHING make a duplicate a no-op. Best-effort:
// a history hiccup must NEVER break account creation, so errors are swallowed.
async function recordInitialUsername(userId, username) {
  if (!userId || !username) return;
  try {
    await supabaseAdmin
      .from('username_history')
      .upsert(
        { user_id: userId, username: String(username).toLowerCase(), is_current: true, source: 'auto' },
        { onConflict: 'username', ignoreDuplicates: true },
      );
  } catch (_) {
    // non-fatal
  }
}

// Claim a username during onboarding — replaces the throwaway auto name with
// the host's first real choice. Intentionally bypasses the change_username RPC's
// gating rules (WhatsApp gate, 2/365-day cap, 6-month gap) because:
//   a) The host hasn't had a chance to verify WhatsApp yet (that's step 5+).
//   b) This is not a "change" — it's the host's initial brand identity claim.
//      The auto name recorded by upsertProfile was a placeholder, not a choice.
//
// Delegates to the set_onboarding_username Postgres RPC (v3.32), which executes
// the retire→insert→update sequence inside a single function body (one implicit
// transaction). This eliminates the partial-failure window that existed when the
// three steps were separate Supabase client calls.
//
// The RPC raises EXCEPTION 'username_taken' on unique-index conflict; Supabase
// surfaces this as error.message containing 'username_taken'. We map that to the
// { ok: false, reason: 'taken' } contract that claimSlug already handles.
//
// Returns { ok: true, username } or { ok: false, reason, detail? }.
async function setOnboardingUsername(userId, newSlug) {
  const clean = normalizeSlug(newSlug);
  // Defense-in-depth: controllers already gate on the reserved guard, but reject
  // L1 reserved names here too so any future direct caller cannot bypass it.
  if (isStaticReserved(clean)) return { ok: false, reason: 'taken' };
  if (isBlocked(clean)) return { ok: false, reason: 'blocked' };

  const { data, error } = await supabaseAdmin.rpc('set_onboarding_username', {
    p_user_id: userId,
    p_username: clean,
  });

  if (error) {
    // The RPC raises EXCEPTION 'username_taken' on unique-index conflict.
    // Supabase wraps this as error.message = 'username_taken'.
    if (error.message && error.message.includes('username_taken')) {
      return { ok: false, reason: 'taken' };
    }
    return { ok: false, reason: 'error', detail: error.message };
  }

  // RPC returns jsonb: { ok: true, username } or { ok: false, reason }.
  return data;
}

// Atomic, race-safe change via the change_username RPC (all rule enforcement
// lives in SQL). Returns the RPC's jsonb verdict:
//   { ok: true, username } | { ok: false, reason, next_eligible? }
async function changeUsername(userId, newSlug) {
  const clean = normalizeSlug(newSlug);
  // Defense-in-depth: the RPC also enforces L2 reserved; reject L1 here so a
  // future direct caller (bypassing usernameController) cannot claim a route name.
  if (isStaticReserved(clean)) return { ok: false, reason: 'taken' };
  if (isBlocked(clean)) return { ok: false, reason: 'blocked' };
  const { data, error } = await supabaseAdmin.rpc('change_username', {
    p_user_id: userId,
    p_new: clean,
  });
  if (error) return { ok: false, reason: 'error' };
  return data;
}

module.exports = {
  usernameExists,
  usernameOwner,
  resolve,
  createInitialUsername,
  recordInitialUsername,
  setOnboardingUsername,
  changeUsername,
};

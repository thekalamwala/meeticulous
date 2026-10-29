/**
 * profileSecrets.js — server-only access to host Google OAuth tokens.
 *
 * Tokens used to live on `profiles.google_access_token / google_refresh_token`,
 * a table whose public profile row is readable via the anon Supabase API. They
 * are now stored in the server-only `profile_private` table (RLS deny-all to
 * anon/authenticated; see migration v3.23). This module only changes WHERE the
 * tokens live — they remain AES-256-GCM encrypted at rest (utils/cryptoTokens),
 * and callers still decrypt at point of use.
 *
 * Transition-safe: during the window between this code shipping and the v3.24
 * column drop, reads prefer profile_private and fall back to whatever the caller
 * already loaded from profiles.google_* (passed as `fallback`).
 */
const { supabaseAdmin } = require("../config/supabase");

const EMPTY = { google_access_token: null, google_refresh_token: null };

// Returns { google_access_token, google_refresh_token } (encrypted strings) for
// a user. Prefers profile_private; falls back to `fallback` (typically the host
// row already fetched from profiles) so this is safe before AND after v3.24.
const getGoogleTokens = async (userId, fallback = {}) => {
  if (!userId) return { ...EMPTY };
  try {
    const { data } = await supabaseAdmin
      .from("profile_private")
      .select("google_access_token, google_refresh_token")
      .eq("user_id", userId)
      .maybeSingle();
    if (data && (data.google_refresh_token || data.google_access_token)) {
      return {
        google_access_token: data.google_access_token || null,
        google_refresh_token: data.google_refresh_token || null,
      };
    }
  } catch (err) {
    // Table missing (pre-v3.23) or transient error — fall back, never fatal.
    if (!/Could not find the|does not exist|relation .* does not exist/i.test(err.message || "")) {
      console.error("profileSecrets.getGoogleTokens (falling back):", err.message);
    }
  }
  return {
    google_access_token: fallback.google_access_token ?? null,
    google_refresh_token: fallback.google_refresh_token ?? null,
  };
};

// Populate host.google_access_token / google_refresh_token from profile_private
// (mutates + returns host), preserving the contract the calendar code relies on.
// Uses the host's existing values as the fallback during the transition window.
const attachGoogleTokens = async (host) => {
  if (!host?.id) return host;
  const t = await getGoogleTokens(host.id, host);
  host.google_access_token = t.google_access_token;
  host.google_refresh_token = t.google_refresh_token;
  return host;
};

// Persist (already-encrypted) tokens for a user. Upserts profile_private.
const setGoogleTokens = async (userId, { google_access_token, google_refresh_token }) => {
  if (!userId) return;
  const { error } = await supabaseAdmin
    .from("profile_private")
    .upsert(
      {
        user_id: userId,
        google_access_token: google_access_token ?? null,
        google_refresh_token: google_refresh_token ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
  if (error) throw error;
};

module.exports = { getGoogleTokens, attachGoogleTokens, setGoogleTokens };

const { createClient } = require('@supabase/supabase-js');

// Fail fast if SUPABASE_SERVICE_ROLE_KEY is missing or is actually the anon
// key — otherwise every RLS-protected write (e.g. otp_codes) fails at
// request time with a cryptic "row-level security policy" error.
(() => {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  let role = null;
  try {
    const payload = key.split('.')[1];
    role = JSON.parse(Buffer.from(payload, 'base64').toString()).role;
  } catch (_) { /* not a JWT */ }
  // Accept either a legacy service_role JWT (role=service_role) or a new-format
  // Supabase secret key (sb_secret_...), which is the service-role equivalent for
  // projects on the new API-key regime. Still rejects anon / publishable keys.
  const isNewSecret = key.startsWith('sb_secret_');
  if (role !== 'service_role' && !isNewSecret) {
    throw new Error(
      `SUPABASE_SERVICE_ROLE_KEY is ${key ? `a "${role || 'non-JWT'}" key` : 'missing'} — ` +
      'expected the service_role key (JWT) or an sb_secret_ key from Supabase Dashboard > Settings > API.'
    );
  }
})();

// Admin client — uses service role key, bypasses RLS
// persistSession: false is critical on the server so that
// signInWithPassword calls don't pollute the client's auth state
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

// Public client — uses anon key, respects RLS
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

// Password sign-in MUST NOT run on supabaseAdmin (or any shared client):
// supabase-js stores the resulting session in memory and uses its access token
// as the Authorization header for ALL subsequent PostgREST (.from) calls on that
// client. That silently downgrades the service-role client to the signed-in
// user's role ('authenticated') for the rest of the process, so every later
// admin/service write hits RLS ("new row violates row-level security policy").
// persistSession:false does NOT prevent this (it only disables storage).
//
// This helper signs in on a DISPOSABLE anon client that is thrown away after the
// call, so the long-lived supabaseAdmin / supabase singletons are never mutated.
const signInWithPassword = async (email, password) => {
  const tmp = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  // IMPORTANT: do NOT call tmp.auth.signOut() here. signOut() hits GoTrue
  // /logout and revokes the session server-side — the very session whose
  // access/refresh tokens we just returned to the user. That made logins
  // "succeed then bounce back to /login" (getUser failed on dead session_id,
  // refresh failed on revoked refresh token). The throwaway client holds the
  // session only in memory; garbage collection is the cleanup.
  return tmp.auth.signInWithPassword({ email, password });
};

// Mint a Supabase session for a user WITHOUT a password (Google-authenticated
// vendors). Uses admin.generateLink to obtain a one-time magiclink token hash,
// then redeems it on a DISPOSABLE anon client (same poisoning rule as
// signInWithPassword above — never redeem on supabaseAdmin).
const mintSessionForEmail = async (email) => {
  const { data: linkData, error: linkError } =
    await supabaseAdmin.auth.admin.generateLink({ type: 'magiclink', email });
  if (linkError) throw linkError;
  const tokenHash = linkData?.properties?.hashed_token;
  if (!tokenHash) throw new Error('Could not generate session link');

  const tmp = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await tmp.auth.verifyOtp({ type: 'magiclink', token_hash: tokenHash });
  if (error) throw error;
  if (!data?.session) throw new Error('Session mint failed');
  return data.session;
};

module.exports = { supabase, supabaseAdmin, signInWithPassword, mintSessionForEmail };

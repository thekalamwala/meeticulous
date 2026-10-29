// Lazy Supabase client. @supabase/supabase-js is ~206 KB raw (~54 KB gzip); a
// static `createClient` at module load pulled it into the first-paint bundle on
// EVERY page — including the logged-out public homepage, which needs no auth to
// render (the AuthContext loading gate runs off localStorage + app token, not
// supabase). Dynamic-import it on first use so it stays off the critical path.
//
// Callers: `const sb = await getSupabase()` then use `sb.auth.*`. The three uses
// (onAuthStateChange listener, signOut, 401 refreshSession) all already run async
// or off first paint, so the extra await costs nothing user-visible.
let clientPromise = null;

export function getSupabase() {
  if (!clientPromise) {
    clientPromise = import('@supabase/supabase-js').then(({ createClient }) =>
      createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_ANON_KEY,
        {
          auth: {
            // Own the session so the access token refreshes in the BACKGROUND
            // (~55min) instead of only reactively on a 401 — hosts stop getting
            // logged out every hour. persistSession + the dedicated storageKey
            // let supabase-js coordinate refresh ACROSS TABS via its internal
            // lock, so two tabs can't both rotate the same refresh token and
            // trip reuse-detection (which used to revoke the whole token family
            // → hard logout). AuthContext seeds this via setSession() on boot
            // and mirrors refreshed tokens back into localStorage.user.
            autoRefreshToken: true,
            persistSession: true,
            storageKey: 'bas_sb_session',
            // We adopt tokens from the OAuth callback FRAGMENT ourselves
            // (GoogleAuthDone), so supabase must not race us parsing the URL.
            detectSessionInUrl: false,
          },
        },
      ),
    );
  }
  return clientPromise;
}

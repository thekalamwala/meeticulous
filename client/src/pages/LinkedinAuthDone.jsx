import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { getSupabase } from '../services/supabaseClient';
import { linkedinHostAuth } from '../services/api';
import Seo from '../components/common/Seo';
import PetalSpinner from '../components/common/PetalSpinner';

// Server code → host-login error. Anything unmapped is a generic linkedin_failed
// (LinkedIn-specific copy — auth_failed reads "Google sign-in failed").
const ERRORS = { 409: 'email_has_account', 503: 'linkedin_off' };

// /auth/linkedin/done — return page for the host LinkedIn door
// (AuthContext.startLinkedinHostAuth → supabase signInWithOAuth linkedin_oidc).
// The shared client uses the default implicit flow, so tokens arrive in the
// FRAGMENT (#access_token=…&refresh_token=…); a PKCE ?code= is handled too in
// case flowType ever changes. detectSessionInUrl is off, so we finish it here.
const LinkedinAuthDone = () => {
  const { adoptSession } = useAuth();
  const navigate = useNavigate();
  const ran = useRef(false);

  useEffect(() => {
    // Exactly once: a second /linkedin/host call could send a second welcome email.
    if (ran.current) return;
    ran.current = true;

    const qs = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    // Scrub code/tokens from the address bar immediately
    window.history.replaceState(null, '', '/auth/linkedin/done');

    let stash = {};
    try {
      stash = JSON.parse(sessionStorage.getItem('li_host_auth') || '{}') || {};
      sessionStorage.removeItem('li_host_auth');
    } catch { /* storage blocked / bad JSON — the server defaults intent to login */ }

    let sb = null;
    let token = null;
    (async () => {
      try {
        sb = await getSupabase();
        const oauthErrs = [qs.get('error'), qs.get('error_code'), hash.get('error'), hash.get('error_code')];
        // access_denied = the host backed out on LinkedIn's consent screen.
        if (oauthErrs.includes('access_denied')) throw Object.assign(new Error('oauth_error'), { reason: 'linkedin_cancelled' });
        if (oauthErrs.some(Boolean)) throw new Error('oauth_error');
        let refresh = null;
        const code = qs.get('code');
        if (code) {
          const { data, error } = await sb.auth.exchangeCodeForSession(code);
          if (error) throw error;
          token = data?.session?.access_token;
          refresh = data?.session?.refresh_token;
        } else {
          const at = hash.get('access_token');
          const rt = hash.get('refresh_token');
          if (!at || !rt) throw new Error('no_session');
          // Hand the hash tokens to Supabase (validates them) so the client owns
          // this session exactly like the PKCE path — a failure's signOut then
          // actually revokes it server-side instead of a local no-op.
          const { data, error } = await sb.auth.setSession({ access_token: at, refresh_token: rt });
          if (error) throw error;
          token = data?.session?.access_token;
          refresh = data?.session?.refresh_token;
        }
        if (!token || !refresh) throw new Error('no_session');

        // The server must create/upgrade the profile BEFORE adoptSession, whose
        // /auth/me needs that profile to exist.
        const { data } = await linkedinHostAuth(stash, token);
        await adoptSession({ token, refresh_token: refresh });

        const newFlag = data?.new; // '1' new host · 'upgrade' customer→host · '0' returning
        const isNew = newFlag === '1';
        const isUpgrade = newFlag === 'upgrade';
        toast.success(
          isNew ? 'Welcome to Meeticulous!'
            : isUpgrade ? "Let's set up your hosting"
            : 'Welcome back!'
        );
        // Same routing as GoogleAuthDone: /dashboard is onboarding-guarded (new or
        // upgraded hosts are routed into /vendor-register); a returning host goes
        // back to the page that asked for sign-in. Internal single-slash paths only.
        let back = null;
        try { back = sessionStorage.getItem('mt_after_host_login'); sessionStorage.removeItem('mt_after_host_login'); } catch { /* storage blocked */ }
        const resume = !isNew && !isUpgrade && /^\/(?!\/)/.test(back || '') ? back : null;
        navigate(resume || '/dashboard', { replace: true });
      } catch (e) {
        const status = e?.response?.status;
        const reason = e?.reason || ERRORS[status]
          || (status === 400 && e.response.data?.code === 'email_unverified' ? 'email_unverified' : 'linkedin_failed');
        // Never leave an orphan session for a profile-less auth user. scope:local
        // revokes only THIS session — an existing account's other devices stay signed in.
        try { await sb?.auth.signOut({ scope: 'local' }); } catch { /* best-effort */ }
        try {
          if (token && JSON.parse(localStorage.getItem('user') || 'null')?.token === token) localStorage.removeItem('user');
        } catch { /* non-fatal */ }
        navigate(`/login-as-vendor?error=${reason}`, { replace: true });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="h-[calc(100dvh-57px)] overflow-hidden flex items-center justify-center bg-cream">
      <Seo title="Signing you in — Meeticulous" robots="noindex,nofollow" />
      <div className="text-center">
        <div className="mb-4 flex justify-center"><PetalSpinner size={48} /></div>
        <p className="text-sm text-muted">Setting up your account…</p>
      </div>
    </div>
  );
};

export default LinkedinAuthDone;

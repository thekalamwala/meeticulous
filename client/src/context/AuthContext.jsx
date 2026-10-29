import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { analytics, EVENTS } from '../services/analytics';
import { registerUser, loginUser, loginUnified as apiLoginUnified, loginWithPhone as apiLoginWithPhone, verifyOtpLogin as apiVerifyOtpLogin, setUserPassword, getGoogleAuthUrl, getVendorGoogleUrl, recordInviteVisit, getMe, becomeHost as apiBecomeHost, cancelHosting as apiCancelHosting } from '../services/api';
import { readInvite, stashInvite, inviteCodeFromUrl } from '../utils/inviteStash';
import { getSupabase } from '../services/supabaseClient';

const AuthContext = createContext();

// `|| {}` hardens every consumer against a transient render outside the provider.
// Seen on mobile: in-app translation corrupts the tree (see utils/domTranslateGuard.js),
// React remounts a page detached from AuthProvider, and a bare useContext() returns
// undefined — destructuring it (e.g. Home's `{ startVendorGoogleAuth }`) then throws
// into the RouteErrorBoundary. Empty object degrades that to a harmless no-op.
export const useAuth = () => useContext(AuthContext) || {};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  // Active dashboard mode for dual-capability accounts (Hosting vs Traveling).
  // Persisted so a host returns to the space they last used. First load with no
  // saved pref: hosts default to 'hosting' (so existing hosts aren't dropped into
  // guest space), everyone else 'traveling'. (Unified identity — Phase 1/2.)
  const [mode, setModeState] = useState(() => {
    const saved = localStorage.getItem('bas_active_mode');
    if (saved) return saved;
    try {
      const u = JSON.parse(localStorage.getItem('user') || 'null');
      return u?.is_host ? 'hosting' : 'traveling';
    } catch { return 'traveling'; }
  });
  const setMode = (m) => { setModeState(m); localStorage.setItem('bas_active_mode', m); };
  const wasIdentified = useRef(false);

  // Link analytics events to the known user via the central bus. One watcher covers
  // every login path (password, phone, OTP, Google, register) plus refresh-rehydrate.
  // The bus fans identity to all active adapters (PostHog gets email + fields; GA4
  // ignores props; Clarity uses name/role/plan). reset() fires ONLY on the logout
  // transition (identified -> null), never for a plain anonymous visitor — otherwise
  // the anon distinct_id would churn on every page load and break anonymous funnels.
  // distinct_id MUST match what the backend sends later (posthog-node) so events
  // join on one person.
  useEffect(() => {
    const id = user?.id || user?._id;
    if (id) {
      analytics.identify(String(id), {
        email: user.email,
        name: user.name,
        role: user.role,
        plan: user.plan,
      });
      wasIdentified.current = true;
    } else if (wasIdentified.current) {
      analytics.reset();
      wasIdentified.current = false;
    }
  }, [user?.id, user?._id]);

  useEffect(() => {
    // Refer & Earn: stash a ?ref=<username> from the landing URL so it survives the
    // Google-OAuth signup round-trip. Consumed once the visitor becomes a host
    // (App.jsx useReferralCapture). Only set — never overwrite an existing pending ref.
    try {
      const ref = new URLSearchParams(window.location.search).get('ref');
      if (ref && !localStorage.getItem('bas_ref')) localStorage.setItem('bas_ref', ref.slice(0, 40));
      // Cold-call tracked link (?i=CX12): log the visit on the lead + keep the code for signup.
      const code = inviteCodeFromUrl(window.location.search);
      if (code) { stashInvite(code); recordInviteVisit(code).catch(() => {}); }
    } catch { /* non-fatal */ }

    const stored = localStorage.getItem('user');
    if (!stored) { setLoading(false); return; }

    const parsed = JSON.parse(stored);
    setUser(parsed); // set immediately so routes don't flash to login

    // Refresh from server if we have a token — keeps plan, profile fields, username up to date
    if (parsed?.token) {
      getMe()
        .then(({ data: fresh }) => {
          const merged = { ...parsed, ...fresh };
          localStorage.setItem('user', JSON.stringify(merged));
          setUser(merged);
        })
        .catch(() => { /* token expired or server down — keep cached data */ })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }

    // Session lifecycle. Supabase is dynamic-imported, so this runs once the
    // client resolves (after first paint). `cancelled` guards against the effect
    // cleanup running before the import settles.
    let subscription = null;
    let cancelled = false;
    getSupabase().then((sb) => {
      if (cancelled) return;

      // Hand our stored tokens to supabase so IT owns the refresh loop: the
      // access token now refreshes silently in the background (~55min) and
      // across tabs, instead of only reactively on a 401. If the access token
      // is already expired but the refresh token is still valid, setSession
      // refreshes immediately and emits TOKEN_REFRESHED below — recovering the
      // "reopened the tab after idling past an hour" case with no logout.
      if (parsed?.token && parsed?.refresh_token) {
        sb.auth.setSession({
          access_token: parsed.token,
          refresh_token: parsed.refresh_token,
        }).catch(() => { /* invalid/expired refresh token — 401 interceptor handles logout */ });
      }

      subscription = sb.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT') {
          localStorage.removeItem('user');
          setUser(null);
          return;
        }
        // Background/cross-tab refresh landed — mirror the fresh tokens into
        // localStorage.user (the shape api.js reads for the Bearer header) and
        // into React state. Merge onto the LATEST stored profile, not the stale
        // boot-time closure, so a concurrent getMe() write isn't clobbered.
        if ((event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') && session) {
          try {
            const current = JSON.parse(localStorage.getItem('user') || 'null');
            if (!current) return; // logged out meanwhile — don't resurrect
            const merged = {
              ...current,
              token: session.access_token,
              refresh_token: session.refresh_token,
            };
            localStorage.setItem('user', JSON.stringify(merged));
            setUser(merged);
          } catch { /* non-fatal */ }
        }
      }).data.subscription;
    });

    return () => { cancelled = true; subscription?.unsubscribe(); };
  }, []);

  const login = async (email, password) => {
    const { data } = await loginUser({ email, password });
    localStorage.setItem('user', JSON.stringify(data));
    setUser(data);
    return data;
  };

  // Unified login door (Phase B): one field accepts email OR phone. Throws on
  // 401/409 (caller inspects err.response to branch to OTP / "set password").
  const loginUnified = async (identifier, password) => {
    const { data } = await apiLoginUnified({ identifier, password });
    localStorage.setItem('user', JSON.stringify(data));
    setUser(data);
    return data;
  };

  // Phone-primary user login. Throws on 401/404/409 (caller inspects
  // err.response to branch to OTP / "set password").
  const loginWithPhone = async (phone, password) => {
    const { data } = await apiLoginWithPhone({ phone, password });
    localStorage.setItem('user', JSON.stringify(data));
    setUser(data);
    return data;
  };

  // Phone OTP login. The server returns a fully serialized profile WITH session
  // tokens, so we can persist it directly (no /me round-trip needed).
  const loginWithOtp = async (phone, otp) => {
    const { data } = await apiVerifyOtpLogin({ phone, otp });
    localStorage.setItem('user', JSON.stringify(data));
    setUser(data);
    return data;
  };

  // Set a real password for the logged-in user (flips password_set server-side).
  const setPassword = async (password) => {
    await setUserPassword({ password });
    updateUser({ password_set: true });
  };

  const registerAsUser = async (name, email, password) => {
    const { data } = await registerUser({ name, email, password });
    localStorage.setItem('user', JSON.stringify(data));
    setUser(data);
    return data;
  };

  const connectGoogleCalendar = async () => {
    const { data } = await getGoogleAuthUrl();
    window.location.href = data.url;
  };

  // Vendor Google auth: signup/login with one consent screen (identity +
  // calendar). The callback lands on /auth/google/done with session tokens.
  const startVendorGoogleAuth = async (intent = 'login') => {
    // signup_started = the TRUE top of the signup funnel: the host clicked
    // "Continue with Google" to CREATE an account. Fire before the redirect so the
    // drop-off at Google's own screen is captured. Login clicks aren't signups, so
    // only intent==='signup' fires it. (Previously this fired on the slug-claim step,
    // i.e. AFTER OAuth already succeeded — missing every pre-OAuth abandon.)
    if (intent === 'signup') analytics.track(EVENTS.SIGNUP_STARTED, {});
    // A live invite stash rides along; the server stamps it only on a brand-new profile.
    const { data } = await getVendorGoogleUrl(intent, readInvite() || undefined);
    window.location.href = data.url;
  };

  // Adopt a session minted server-side (Google vendor auth): store tokens,
  // hydrate the profile via /auth/me, persist the merged shape.
  const adoptSession = async ({ token, refresh_token }) => {
    // Token must be in storage before getMe (api reads it for auth), but if
    // hydration fails we must NOT leave a half-authenticated {token}-only ghost
    // session behind — roll it back so the caller's catch can nudge to sign in.
    localStorage.setItem('user', JSON.stringify({ token, refresh_token }));
    try {
      const { data: fresh } = await getMe();
      const merged = { ...fresh, token, refresh_token };
      localStorage.setItem('user', JSON.stringify(merged));
      setUser(merged);
      // Entering via the vendor Google door as a host → be in hosting mode, so
      // a freshly-onboarded host never lands in guest space.
      if (merged.is_host) setMode('hosting');
      return merged;
    } catch (e) {
      localStorage.removeItem('user');
      throw e;
    }
  };

  // Unified identity: add hosting capability to the CURRENT account, flip to
  // hosting mode, and return the updated profile (with onboarding seed) so the
  // caller can route into the existing onboarding steps.
  const becomeHost = async () => {
    const { data } = await apiBecomeHost();
    updateUser(data);
    setMode('hosting');
    return data;
  };

  // Reverse an in-progress hosting upgrade (the un-become-host door). Demotes
  // the current account back to a pure guest and drops it into traveling mode,
  // so a guest who backed out of onboarding is no longer forced into
  // /vendor-register on every login. Server refuses this for a completed host.
  const cancelHosting = async () => {
    const { data } = await apiCancelHosting();
    updateUser(data);
    setMode('traveling');
    return data;
  };

  const logout = async (opts = {}) => {
    // Route by capability BEFORE clearing: a host always lands back on the
    // host login door (never the generic guest /login); everyone else → home.
    // `opts.to` overrides this — used by the dual-login switch, where the
    // destination is the door being switched INTO, not the capability of the
    // session being left.
    const wasHost = user?.is_host === true || user?.role === 'host' || user?.role === 'superadmin';
    await (await getSupabase()).auth.signOut();
    localStorage.removeItem('user');
    setUser(null);
    window.location.assign(opts.to || (wasHost ? '/login-as-vendor' : '/'));
  };

  const updateUser = (updatedData) => {
    const newUser = { ...user, ...updatedData };
    localStorage.setItem('user', JSON.stringify(newUser));
    setUser(newUser);
  };

  return (
    <AuthContext.Provider value={{
      user, loading, login, loginUnified,
      mode, setMode,
      loginWithPhone, loginWithOtp, setPassword,
      registerAsUser,
      connectGoogleCalendar,
      startVendorGoogleAuth, adoptSession,
      becomeHost, cancelHosting,
      logout, updateUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

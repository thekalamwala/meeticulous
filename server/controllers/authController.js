const { supabaseAdmin, signInWithPassword, mintSessionForEmail } = require("../config/supabase");
const { safeError } = require('../utils/httpError');
const {
  getAuthUrl,
  getTokensFromCode,
  getCalendarTimezone,
  revokeToken,
  oauth2Client,
} = require("../config/google");
const { google } = require("googleapis");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { encrypt: encryptToken, decrypt: decryptToken } = require("../utils/cryptoTokens");
const profileSecrets = require("../utils/profileSecrets");
const planService = require("../services/planService");
const inviteService = require("../services/inviteService");
const { SAFETY_KEYS } = require("../config/featureRegistry");

// Meeticulous is India-first: a Google Calendar left on its default UTC is not
// a real location signal, and seeding it makes the host's slots render in UTC so
// guests see times that look hours in the past ("old times" bug). Treat UTC/GMT
// (or no value) as "no signal" and fall back to the platform default IST; a
// genuine non-UTC Google timezone is still honoured for hosts truly elsewhere.
const normalizeSeedTimezone = (googleTz) =>
  (!googleTz || /^(Etc\/)?(UTC|GMT)$/i.test(googleTz)) ? "Asia/Kolkata" : googleTz;

// Invite-link attribution: stamp only in the brand-new-profile branch (caller
// guarantees profileId was just created). Existing accounts never reach here.
// No-ops when state carries no slug or the slug is unknown (service-validated).
// Never writes a referrals row — attribution and payout are separate axes.
async function maybeStampInvite(profileId, statePayload) {
  const slug = statePayload?.invite;
  if (!slug) return;
  await inviteService.stampInviteSlug(profileId, slug);
}

// HMAC secret for the OAuth `state` parameter (CSRF protection on the Google
// round-trip). Dedicated env var preferred; service-role key is a safe,
// always-present fallback (server-side only, never sent to the browser).
// SECURITY (audit L1): dedicated env preferred; otherwise derive a
// PURPOSE-SEPARATED key from the service-role key rather than using the raw key
// itself, so the OAuth-state HMAC can never double as / reveal another secret.
// State tokens are short-lived (15 min), so the derived fallback can't break
// anything beyond in-flight OAuth round-trips.
const OAUTH_STATE_SECRET =
  process.env.OAUTH_STATE_SECRET ||
  crypto.createHmac('sha256', process.env.SUPABASE_SERVICE_ROLE_KEY || 'dev-oauth-state')
    .update('oauth-state-v1').digest('hex');
if (process.env.NODE_ENV === 'production' && !process.env.OAUTH_STATE_SECRET) {
  console.warn('[security] OAUTH_STATE_SECRET not set — using a derived fallback. Set a dedicated OAUTH_STATE_SECRET in production.');
}
const sendEmail = require("../utils/sendEmail");
const otpStore = require("../utils/otpStore");
const guestGrant = require("../utils/bookingGrant");
const { sendOtpNotification } = require("../utils/notify");
const NotificationEngine = require("../services/notificationEngine");
const { runInBackground } = require("../utils/background");
const usernameService = require("../services/usernameService");
const featureFlags = require("../services/featureFlags");
const { trackServer } = require("../utils/trackServer");
const { isReserved } = require("../utils/reservedUsernames");
const { normalizeSlug } = require("../utils/slugNormalize");

// ─── Per-account login lockout constants ───────────────────────────────────
const LOGIN_MAX_FAILED = 5;
const LOGIN_LOCK_MS = 15 * 60 * 1000;

// Shared per-account lockout helpers — deduped across login / loginWithPhone /
// loginUnified (Phase C). `profile` only needs id, failed_login_count and
// login_locked_until.
const lockoutActive = (profile) => {
  const until = profile?.login_locked_until;
  if (until && new Date(until).getTime() > Date.now()) {
    return { locked: true, mins: Math.ceil((new Date(until).getTime() - Date.now()) / 60000) };
  }
  return { locked: false, mins: 0 };
};
const recordLoginFailure = async (profile) => {
  const failed = (profile.failed_login_count || 0) + 1;
  const patch = { failed_login_count: failed };
  if (failed >= LOGIN_MAX_FAILED) {
    patch.login_locked_until = new Date(Date.now() + LOGIN_LOCK_MS).toISOString();
  }
  await supabaseAdmin.from('profiles').update(patch).eq('id', profile.id);
};
const resetLoginCounters = async (id) => {
  await supabaseAdmin.from('profiles')
    .update({ failed_login_count: 0, login_locked_until: null }).eq('id', id);
};

// ─── Profile slug helpers (inline to avoid circular deps) ──────────────────
const slugifyUsername = (text) =>
  text.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/[\s_]+/g, '-').replace(/--+/g, '-').slice(0, 60);

const uniqueProfileSlug = async (base, excludeId = null) => {
  let slug = base;
  let i = 2;
  while (true) {
    let q = supabaseAdmin.from('profiles').select('id').eq('username', slug);
    if (excludeId) q = q.neq('id', excludeId);
    const { data } = await q.maybeSingle();
    if (!data) return slug;
    slug = `${base}-${i++}`;
  }
};

// Serialise a DB profile row into the shape stored in localStorage / returned by all auth endpoints.
// Always include plan so the frontend can gate plan-based features.
// ASYNC: resolves the caller's plan to derive `bypasses_flags` — the Supreme
// (bypasses_kill_switches) hint the client uses to keep gated UI visible even
// when an admin kill-switch is off. Fails SAFE to false on any lookup error.
const serializeProfile = async (profile, session) => {
  let bypasses_flags = false;
  try {
    const plan = await planService.getPlan(planService.resolveVendorPlan(profile));
    bypasses_flags = !!plan?.bypasses_kill_switches;
  } catch (_) { /* fail-safe: no bypass hint, server still enforces */ }
  // Interim fee-only mode: the host UI uses this to hide the service-price field
  // (paid listings are disabled until Razorpay Route). Fail-safe true. Cached 60s.
  // Per-host: a paid-enabled pilot host sees paid mode (price field unlocked) even
  // while the platform is globally fee-only. Fail-safe true.
  let fee_only_mode = true;
  try {
    const { feeOnlyForHost } = require('../services/paidMode');
    fee_only_mode = await feeOnlyForHost(profile.id);
  } catch (_) { /* fail-safe: default to fee-only */ }
  return {
  _id:                      profile.id,
  id:                       profile.id,
  name:                     profile.name,
  email:                    profile.email,
  phone:                    profile.phone || null,
  // Private, owner-only — this serializer is for the account's own session, never the
  // public profile (getHostProfile uses its own explicit selects). Used for the
  // birthday greeting (v3.138).
  date_of_birth:            profile.date_of_birth || null,
  password_set:             !!profile.password_set,
  role:                     profile.role,
  // is_host: new capability flag (v3.34). role is the auto-mirrored shim until
  // the Phase 4 cleanup; both are returned during the transition.
  is_host:                  !!profile.is_host,
  plan:                     profile.plan || 'free',
  plan_expires_at:          profile.plan_expires_at || null,
  billing_cadence:          profile.billing_cadence || null,
  subscription_status:      profile.subscription_status || null,
  current_period_end:       profile.current_period_end || null,
  // True only when a real Razorpay mandate exists. Legacy one-time annual
  // vendors are 'active' from the v3.8 backfill but carry NO mandate — the UI
  // uses this to avoid showing them a bogus "auto-renew on / cancel" control.
  has_payment_mandate:      !!profile.razorpay_subscription_id,
  username:                 profile.username || null,
  bio:                      profile.bio || '',
  tagline:                  profile.tagline || '',
  profession:               profile.profession || '',
  location:                 profile.location || '',
  map_link:                 profile.map_link || '',
  profile_image:            profile.profile_image || '',
  cover_image:              profile.cover_image || '',
  social_links:             profile.social_links || {},
  theme_color:              profile.theme_color || null,
  google_calendar_connected:!!profile.google_calendar_connected,
  is_verified:              !!profile.is_verified,
  whatsapp_verified:        !!profile.whatsapp_verified,
  whatsapp_number:          profile.whatsapp_number || null,
  // LinkedIn ownership verified (Supabase linkedin_oidc identity link → v3.170).
  // Derived from the stamp column; undefined pre-migration → false (schema-safe).
  linkedin_verified:        !!profile.linkedin_verified_at,
  badges:                   profile.badges || [],
  // Supreme kill-switch bypass hint + the never-bypassable denylist, so the
  // client's useFeature() can mirror the server's requireFeature() decision.
  bypasses_flags,
  safety_keys:              SAFETY_KEYS,
  fee_only_mode,
  ...(session ? { token: session.access_token, refresh_token: session.refresh_token } : {}),
  };
};

const upsertProfile = async ({ id, name, email, role, username, first_name, last_name, avatar }) => {
  // Resolve the username. This upsert runs on every login (e.g. Google), so we
  // must NEVER regenerate over an existing one. Order: caller-supplied → the
  // row's current username (preserve it) → a fresh permanent username for a
  // brand-new account ({email-handle}-{4 random}), recorded as 'auto' in history.
  let slug = username;
  if (!slug) {
    const { data: existing } = await supabaseAdmin
      .from("profiles").select("username").eq("id", id).maybeSingle();
    slug = existing?.username || await usernameService.createInitialUsername(email);
  }

  const payload = {
    id,
    name,
    email: email.toLowerCase().trim(),
    role,
    username: slug,
    updated_at: new Date().toISOString(),
    // name-split fields: only written when provided (never clobber with undefined)
    ...(first_name !== undefined ? { first_name } : {}),
    ...(last_name  !== undefined ? { last_name  } : {}),
    // avatar maps to profile_image; only written when truthy (never null an existing photo)
    ...(avatar ? { profile_image: avatar } : {}),
  };

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .upsert(payload, { onConflict: "id" })
    .select("*")
    .single();

  if (error) throw error;
  await usernameService.recordInitialUsername(id, slug);
  return data;
};

// Ensure a guest profile (and its underlying auth user) exists for an email.
// Idempotent and resilient: handles the "auth user already exists but the
// profiles row is missing" case that previously made verify-otp return 404.
// Returns the profile row, or null if it genuinely can't be created (callers
// treat null as a guest with no linked account — the booking still works).
const ensureGuestProfile = async (email, name = "Guest") => {
  const normalizedEmail = (email || "").toLowerCase().trim();
  if (!normalizedEmail) return null;
  const guestName = name || "Guest";

  // 1. Profile already exists → done.
  const { data: existing } = await supabaseAdmin
    .from("profiles")
    .select("id, name, email, role, username")
    .eq("email", normalizedEmail)
    .maybeSingle();
  if (existing) return existing;

  // 2. Resolve (or create) the underlying auth user id.
  let userId = null;
  const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
    email: normalizedEmail,
    password: `tmp_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    email_confirm: true,
    user_metadata: { name: guestName },
  });
  if (!createErr && created?.user?.id) {
    userId = created.user.id;
  } else {
    // Auth user already exists (e.g. orphaned by an earlier attempt). Resolve
    // its id via generateLink, which returns the user object without sending mail.
    try {
      const { data: linkData } = await supabaseAdmin.auth.admin.generateLink({
        type: "magiclink",
        email: normalizedEmail,
      });
      userId = linkData?.user?.id || null;
    } catch (_) {
      userId = null;
    }
  }
  if (!userId) return null;

  // 3. Create the profile row (or fetch it if it raced into existence).
  try {
    const profile = await upsertProfile({ id: userId, name: guestName, email: normalizedEmail, role: "guest" });
    // Brand-new guest account → welcome note from the founder. This is the single
    // create chokepoint every OTP path (send-otp + verify-otp) routes through and
    // the early "existing" return above means it fires exactly once, at creation.
    // Phone-only guests (no email) never reach here — ensureGuestProfile returns
    // null before this. Awaited in a try/catch (mirrors the Google host
    // VENDOR_WELCOME path) rather than backgrounded: the engine only QUEUES the
    // email, so the added cost is ~one insert on a guest's FIRST OTP; a
    // background send would leave a promise racing Jest teardown (CI-only flake).
    try {
      await require("../services/notificationEngine").send({
        event: "GUEST_WELCOME",
        data: {
          email: normalizedEmail,
          name: profile.name,
          emailUser: { name: profile.name, email: normalizedEmail, username: profile.username },
          emailData: { first_name: profile.first_name || (profile.name || "").split(" ")[0] || "there" },
          recipientUserId: profile.id,
        },
      });
    } catch (e) {
      console.error("ensureGuestProfile: GUEST_WELCOME send error (non-fatal):", e.message);
    }
    return profile;
  } catch (_) {
    const { data: again } = await supabaseAdmin
      .from("profiles")
      .select("id, name, email, role, username")
      .eq("id", userId)
      .maybeSingle();
    return again || null;
  }
};

// Add the hosting capability to an EXISTING account and seed onboarding state
// (idempotent). Returns the updated profile row. Shared by becomeHost (logged-in
// self-serve) and the Google vendor-auth upgrade path (a customer who signs in
// via "Be a Sloth" / vendor-login) so both routes flip is_host + seed onboarding
// identically. Never resets a host who already finished onboarding.
const enableHostingForProfile = async (profileId) => {
  const { data: profile, error } = await supabaseAdmin
    .from("profiles")
    .select("id, username, is_host, onboarding_slug, onboarding_step_completed, onboarding_completed")
    .eq("id", profileId)
    .single();
  if (error || !profile) throw new Error("Profile not found");

  const patch = { is_host: true, updated_at: new Date().toISOString() };
  // Seed onboarding only when it hasn't been completed — never reset a host who
  // is mid-flow or already live.
  if (!profile.onboarding_completed) {
    if (!profile.onboarding_slug) patch.onboarding_slug = profile.username || null;
    if (!profile.onboarding_step_completed || profile.onboarding_step_completed < 1) {
      patch.onboarding_step_completed = 1;
    }
    patch.onboarding_completed = false;
  }

  let { data: updated, error: upErr } = await supabaseAdmin
    .from("profiles").update(patch).eq("id", profileId).select("*").single();
  // Schema fallback: pre-onboarding DBs lack the onboarding_* columns — retry
  // with just the capability flip so the upgrade still works.
  if (upErr && /Could not find the|column.*does not exist/i.test(upErr.message || "")) {
    ({ data: updated, error: upErr } = await supabaseAdmin
      .from("profiles")
      .update({ is_host: true, updated_at: new Date().toISOString() })
      .eq("id", profileId).select("*").single());
  }
  if (upErr || !updated) throw upErr || new Error("Could not enable hosting");

  // New-host alert: fire once, only on the false→true transition (a returning
  // host re-signing in already has is_host=true, so this stays quiet). Key is
  // per-profile so distinct signups are never collapsed by the throttle.
  if (!profile.is_host) {
    const base = process.env.CLIENT_URL || 'https://bookasloth.com';
    require('../utils/adminAlert').adminAlert({
      key: `new_host:${profileId}`,
      subject: `New host signup: ${updated.name || updated.username || updated.email || profileId}`,
      lines: [
        `Name: ${updated.name || '—'}`,
        `Username: ${updated.username || '—'}`,
        `Email: ${updated.email || '—'}`,
        `Phone: ${updated.phone || '—'}`,
      ],
      link: `${base}/admin/host360/${profileId}`,
    });
  }
  return updated;
};

// ============================================
// VENDOR REGISTRATION (with Google Calendar)
// ============================================

// POST /api/auth/register/vendor
const registerVendor = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ message: 'Name, email and password are required' });

    // One account per email (unified model). If an account already exists the
    // user logs in rather than re-registering.
    const { data: existing } = await supabaseAdmin
      .from('profiles').select('id, role').eq('email', email.toLowerCase().trim()).maybeSingle();
    if (existing) {
      return res.status(409).json({ message: 'An account with this email already exists. Please log in.' });
    }

    // Create user in Supabase Auth
    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name },
      });

    if (authError) return res.status(400).json({ message: authError.message });

    const profile = await upsertProfile({
      id: authData.user.id,
      name,
      email: authData.user.email || email,
      role: "host",
    });

    // Brand-new host (email/password path) → same VENDOR_WELCOME the Google host
    // path sends. This door is effectively unused in prod (host login is Google-only)
    // but closing the gap keeps every host-signup route consistent. Awaited in a
    // try/catch, mirroring the Google host path (line ~632).
    try {
      await require("../services/notificationEngine").send({
        event: "VENDOR_WELCOME",
        data: {
          email: profile.email,
          name: profile.name,
          emailUser: { name: profile.name, email: profile.email, username: profile.username },
          emailData: { first_name: profile.first_name || (profile.name || "").split(" ")[0] || "there" },
          recipientUserId: profile.id,
        },
      });
    } catch (e) {
      console.error("registerVendor: VENDOR_WELCOME send error (non-fatal):", e.message);
    }

    // Sign in to get session (disposable client — never poisons supabaseAdmin)
    const { data: signInData, error: signInError } =
      await signInWithPassword(email, password);
    if (signInError)
      return res.status(500).json({ message: signInError.message });

    res.status(201).json(await serializeProfile(profile, signInData.session));
  } catch (error) {
    safeError(res, error);
  }
};

// GET /api/auth/google — legacy flow: a LOGGED-IN vendor connects their
// calendar from the dashboard/onboarding. Returns the consent URL.
// State is signed so the callback can verify origin (CSRF) and knows which
// vendor to attach the tokens to (no more email-collision risk).
const googleAuth = (req, res) => {
  const state = jwt.sign(
    { flow: "calendar_connect", uid: req.user.id },
    OAUTH_STATE_SECRET,
    { expiresIn: "15m" },
  );
  // Explicit calendar (re)connect from the dashboard → force consent so Google
  // reissues a fresh refresh token with the current (narrow) scopes.
  const url = getAuthUrl(state, { prompt: "consent" });
  res.json({ url });
};

// GET /api/auth/google/vendor?intent=signup|login — PUBLIC vendor auth entry.
// One consent screen requests identity + full calendar scopes; the callback
// creates or logs in the vendor. No password ever exists for these accounts.
const googleVendorAuth = (req, res) => {
  const intent = req.query.intent === "signup" ? "signup" : "login";
  // Invite-link lead-source: carried through the signed OAuth state so the
  // callback can stamp it race-free on a brand-new host (see maybeStampInvite).
  const invite = req.query.invite
    ? String(req.query.invite).trim().toLowerCase().slice(0, 40)
    : undefined;
  // Marketing attribution — carried through the signed OAuth state so the
  // callback can stamp UTM/source on the brand-new host lead (CRM Phase 2b).
  const att = require("../services/crm/attributionInput").cleanAttribution(req.query || {});
  const state = jwt.sign(
    { flow: "vendor_auth", intent, ...(invite ? { invite } : {}), ...(att ? { att } : {}) },
    OAUTH_STATE_SECRET,
    { expiresIn: "15m" },
  );
  // Never force the consent prompt on the public vendor flow — for signup OR login.
  // Google shows consent to a GENUINELY new user on their first grant anyway (it's
  // required) and still returns a refresh token then. An already-registered account
  // that picks the same Google email — even via the "signup" button — has already
  // granted, so Google skips consent and the callback just logs them in. This is
  // why a registered user is no longer forced to re-check the calendar boxes.
  // (Explicit calendar reconnect from the dashboard still forces consent — see
  // googleAuth — because that path deliberately reissues a fresh refresh token.)
  res.json({ url: getAuthUrl(state) });
};

// Seed onboarding state for a brand-new Google vendor. Step 1 = Google identity
// confirmed. The next step (2) is slug claim, handled by the authed claim-slug
// endpoint. onboarding_slug is pre-seeded with the auto-generated username so
// the client can resume before they pick a custom slug. calendar_skipped=true
// because they connected Google OAuth here. Schema-guarded: if the onboarding
// columns don't exist (pre-onboarding DB) the vendor lands on dashboard — no crash.
const markGoogleVendorOnboarding = async (profileId, username) => {
  try {
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({
        onboarding_slug: username,
        onboarding_step_completed: 1, // step 1 = Google identity done; next = claim slug
        onboarding_completed: false,
        calendar_skipped: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", profileId);
    if (error && !/Could not find the|column.*does not exist/i.test(error.message)) {
      console.error("markGoogleVendorOnboarding error (non-fatal):", error.message);
    }
  } catch (e) {
    console.error("markGoogleVendorOnboarding threw (non-fatal):", e.message);
  }
};

// Shared: exchange code, fetch Google identity. Returns { tokens, googleUser }.
const exchangeGoogleCode = async (code) => {
  const tokens = await getTokensFromCode(code);
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI,
  );
  auth.setCredentials(tokens);
  const oauth2 = google.oauth2({ version: "v2", auth });
  const { data: googleUser } = await oauth2.userinfo.get();
  return { tokens, googleUser };
};

// Persist Google tokens (+ google_id when the column exists) on a profile and
// best-effort seed the vendor's timezone from their Google Calendar settings.
const attachGoogleToProfile = async (profileId, tokens, googleUser) => {
  // Tokens are encrypted at rest (AES-256-GCM). Reads decrypt at point of use
  // in availabilityService + bookingController.
  const encAccess = encryptToken(tokens.access_token);
  const encRefresh = encryptToken(tokens.refresh_token);
  // profiles stores only the connected flag now — the OAuth tokens live solely
  // in the server-only profile_private table (profiles.google_* is dropped in
  // v3.24, and was never anon-readable). Encrypted at rest (AES-256-GCM).
  // Retire the PREVIOUS refresh token before storing the new one.
  //
  // Hosts who consented before we narrowed scopes hold a grant that still
  // includes the removed full `auth/calendar` scope. Overwriting our stored copy
  // does not touch that grant — Google keeps serving the "remove risky access"
  // warning until the old token is actually revoked at the OAuth endpoint.
  // Google's remediation guidance is revoke-then-reconsent. We only revoke when
  // Google issued a REPLACEMENT refresh token this round (the guard below) — which
  // only happens on a consent-prompted flow (signup / calendar reconnect), never
  // on a plain returning-host login. So the narrow-scope token replaces the legacy
  // grant exactly when a fresh one exists, and returning logins are left untouched.
  //
  // Revoking a refresh token invalidates that token and the access tokens
  // derived from it, not the separate token we are about to persist. Worst case
  // (Google widens revocation to the whole grant) the host lands on the existing
  // google_calendar_connected=false reconnect path — recoverable, not data loss.
  // Best-effort: never let this block the login it is attached to.
  try {
    const prior = await profileSecrets.getGoogleTokens(profileId);
    const priorRefresh = decryptToken(prior.google_refresh_token);
    // Only when Google actually issued a replacement — revoking without one
    // would leave the host with no working refresh token at all.
    if (priorRefresh && tokens.refresh_token && priorRefresh !== tokens.refresh_token) {
      await revokeToken(priorRefresh);
    }
  } catch (e) {
    console.error("legacy Google token revoke (non-fatal):", e.message);
  }

  // Tokens are persisted ONLY to profile_private (RLS deny-all to anon/auth).
  // Write them BEFORE flipping google_calendar_connected: if this fails we must
  // NOT advertise the calendar as connected — no tokens means every later
  // availability/booking calendar call silently fails with no reconnect signal
  // for the host. Non-fatal so a transient failure never blocks the login.
  let tokensStored = false;
  try {
    await profileSecrets.setGoogleTokens(profileId, {
      google_access_token: encAccess,
      google_refresh_token: encRefresh,
    });
    tokensStored = true;
  } catch (e) {
    console.error("profile_private token write (non-fatal):", e.message);
  }

  // Flag calendar connected ONLY when the tokens actually landed. google_id
  // (identity mapping) is written either way. On a token-write failure the host
  // stays google_calendar_connected=false → the existing reconnect path, not a
  // silently-broken "connected" state.
  const base = {
    google_calendar_connected: tokensStored,
    updated_at: new Date().toISOString(),
  };
  let { error } = await supabaseAdmin
    .from("profiles")
    .update({ ...base, google_id: googleUser.id || null })
    .eq("id", profileId);
  // Pre-v2.5 DB without google_id — retry without it (schema fallback pattern)
  if (error && /Could not find the|column.*does not exist/i.test(error.message)) {
    ({ error } = await supabaseAdmin.from("profiles").update(base).eq("id", profileId));
  }
  if (error) throw error;

  // Timezone: only seed if the vendor has no availability row yet (never
  // overwrite a timezone the vendor chose in the dashboard).
  try {
    const { data: avail } = await supabaseAdmin
      .from("availability").select("host_id").eq("host_id", profileId).maybeSingle();
    if (!avail) {
      const googleTz = await getCalendarTimezone(tokens.access_token, tokens.refresh_token);
      const tz = normalizeSeedTimezone(googleTz);
      await supabaseAdmin.from("availability").upsert(
        { host_id: profileId, timezone: tz, updated_at: new Date().toISOString() },
        { onConflict: "host_id" },
      );
    }
  } catch (tzErr) {
    console.error("google timezone seed (non-fatal):", tzErr.message);
  }
};

// GET /api/auth/google/callback — single callback for BOTH flows, branched on
// the signed state param. Invalid/missing state on a vendor-auth attempt is
// rejected (CSRF); legacy state attaches tokens to the vendor in the state.
// Instantly reconcile a host's automatic badges (award/revoke) right after an
// event that changes their attributes — e.g. a Google login (has_google_identity)
// or a LinkedIn verify (linkedin_verified). The periodic engine run reconciles
// everyone; this just removes the wait so the host sees the badge immediately.
// Scoped to one vendor, best-effort, never blocks the request.
const reconcileBadges = (profileId) => {
  if (!profileId) return;
  require("../services/badgeEngine")
    .evaluate({ vendorIds: [profileId] })
    .catch((e) => console.error("reconcileBadges (non-fatal):", e.message));
};

const googleCallback = async (req, res) => {
  const clientUrl = process.env.CLIENT_URL || "";
  // Tracked outside the try so the catch can route failures to the right place:
  // a vendor-auth user is NOT logged in, so bouncing them to /dashboard is a
  // dead-end — they must land back on /login-as-vendor.
  let isVendorAuthFlow = false;
  try {
    const { code, state } = req.query;
    if (!code) return res.status(400).json({ message: "No code provided" });

    let statePayload = null;
    if (state) {
      try {
        statePayload = jwt.verify(state, OAUTH_STATE_SECRET);
      } catch (_) {
        return res.redirect(`${clientUrl}/login-as-vendor?error=invalid_state`);
      }
    }
    isVendorAuthFlow = statePayload?.flow === "vendor_auth";

    const { tokens, googleUser } = await exchangeGoogleCode(code);
    const googleEmail = (googleUser.email || "").toLowerCase().trim();
    if (!googleEmail) {
      return res.redirect(`${clientUrl}/login-as-vendor?error=no_email`);
    }

    // ── Flow A: vendor signup/login via Google ──────────────────────────────
    if (statePayload?.flow === "vendor_auth") {
      const { data: existing } = await supabaseAdmin
        .from("profiles").select("id, role, is_host, email, google_calendar_connected").eq("email", googleEmail).maybeSingle();

      let profileId = existing?.id || null;
      // Unified identity: an existing CUSTOMER signing in via "Be a Sloth" /
      // vendor-login is no longer a dead-end. Attach hosting to their SAME
      // account (flip is_host + seed onboarding) — exactly what becomeHost does,
      // but in-flow. Superadmin is excluded (the role↔is_host trigger forces it
      // to is_host=false; never clobber that capability).
      let upgraded = false;
      if (profileId && !existing.is_host && existing.role !== "superadmin") {
        await enableHostingForProfile(profileId);
        upgraded = true;
      }

      if (!profileId) {
        // Auto-create the vendor: auth user (no usable password) + host profile
        const { data: created, error: createErr } =
          await supabaseAdmin.auth.admin.createUser({
            email: googleEmail,
            password: `goog_${Date.now()}_${Math.random().toString(36).slice(2)}`,
            email_confirm: true,
            user_metadata: { name: googleUser.name || googleEmail.split("@")[0] },
          });
        if (createErr || !created?.user?.id) {
          console.error("google vendor create error:", createErr?.message);
          return res.redirect(`${clientUrl}/login-as-vendor?error=create_failed`);
        }
        const profile = await upsertProfile({
          id: created.user.id,
          name: googleUser.name || googleEmail.split("@")[0],
          email: googleEmail,
          role: "host",
          first_name: googleUser.given_name || null,
          last_name:  googleUser.family_name || null,
          avatar:     googleUser.picture     || null,
        });
        profileId = profile.id;

        // Drop the new Google vendor into onboarding at step 1 (Google identity
        // confirmed). Next step (2) is slug claim via the authed claim-slug
        // endpoint. calendar_skipped=true because they connected via Google here.
        await markGoogleVendorOnboarding(profileId, profile.username);

        // Invite-link attribution — new host ONLY, write-once, never a referrals row.
        await maybeStampInvite(profileId, statePayload);

        // Acquisition conversion: brand-new host account created. Server-side so
        // the signup survives ad-blockers; fans out to GA4 (sign_up) + Meta
        // (CompleteRegistration). Fire-and-forget — never blocks the redirect.
        trackServer(profileId, "user_registered", { method: "google", role: "host" }, { email: googleEmail, req });
        // A brand-new host is also a Lead for the host-acquisition funnel (fuels
        // Meta lookalike audiences). Same moment, separate standard event.
        trackServer(profileId, "lead_captured", { method: "google", role: "host" }, { email: googleEmail, req });

        // Welcome the brand-new host — one email nudging them to finish setup +
        // publish. Reuses the existing VENDOR_WELCOME template (Tithi);
        // NotificationEngine never throws and routes to the vendor shell.
        await require("../services/notificationEngine").send({
          event: "VENDOR_WELCOME",
          data: {
            email: googleEmail,
            name: profile.name,
            emailUser: { name: profile.name, email: googleEmail, username: profile.username },
            emailData: { first_name: profile.first_name || (profile.name || "").split(" ")[0] || "there" },
            recipientUserId: profileId,
          },
        });

        // Real-time CRM: brand-new host becomes a lead immediately (source
        // host_signup), so Sales sees signups live instead of waiting on the
        // manual backfill script. Never throws / never blocks the signup.
        await require("../services/crm/leadService").safeUpsertLead(
          { name: profile.name, email: googleEmail, profile_id: profileId },
          { source: "host_signup", createdBy: "signup", attribution: statePayload?.att }
        );
      }

      // Re-attach Google tokens only when there's something to (re)store: a
      // brand-new host, a customer upgrading to host, an existing host who isn't
      // calendar-connected, or Google actually issued a fresh token this round.
      // A returning, already-connected host on a plain login (prompt omitted →
      // usually no new refresh token) skips the revoke/re-write/timezone churn and
      // just gets a session — no repeated "calendar access" dance.
      const needsAttach =
        !existing || upgraded || !existing.google_calendar_connected || !!tokens.refresh_token;
      if (needsAttach) {
        await attachGoogleToProfile(profileId, tokens, googleUser);
      }

      // This host authenticated via Google → has_google_identity is now true.
      // Kick a scoped badge reconcile so the "Google Verified" automatic badge is
      // awarded immediately (best-effort; never blocks the session mint below).
      reconcileBadges(profileId);

      // Mint a Supabase session without a password (magiclink redeem on a
      // disposable client). Tokens travel in the URL FRAGMENT — never logged.
      // UX rec: by this point the profile is already created/upgraded. If the
      // session mint fails here, the account IS ready — route to a "you're set up,
      // please sign in" message, not a generic "Google sign-in failed" dead-end.
      let session;
      try {
        session = await mintSessionForEmail(googleEmail);
      } catch (mintErr) {
        console.error("google mint failed (account ready):", mintErr.message);
        return res.redirect(`${clientUrl}/login-as-vendor?error=signin_needed`);
      }
      // new=1 brand-new vendor · new=upgrade existing customer just gained
      // hosting · new=0 returning host. The client routes new!=0 through
      // onboarding (ProtectedRoute does the slug-based redirect either way).
      const newFlag = !existing ? "1" : (upgraded ? "upgrade" : "0");
      return res.redirect(
        `${clientUrl}/auth/google/done#access_token=${encodeURIComponent(session.access_token)}` +
        `&refresh_token=${encodeURIComponent(session.refresh_token)}&new=${newFlag}`,
      );
    }

    // ── Flow B: legacy calendar connect for a logged-in vendor ──────────────
    // Signed state carries the vendor id — exact attach, no email matching.
    // No state at all = pre-deploy URL or forged request → fall back to the
    // old email match ONLY when a host profile exists for that email.
    let targetId = statePayload?.flow === "calendar_connect" ? statePayload.uid : null;
    if (!targetId) {
      const { data: byEmail } = await supabaseAdmin
        .from("profiles").select("id, role").eq("email", googleEmail).maybeSingle();
      if (!byEmail || byEmail.role !== "host") {
        return res.redirect(`${clientUrl}/dashboard?google=error&reason=profile_not_found`);
      }
      targetId = byEmail.id;
    }

    await attachGoogleToProfile(targetId, tokens, googleUser);
    res.redirect(`${clientUrl}/dashboard?google=connected`);
  } catch (error) {
    console.error("google callback error:", error.message);
    // Vendor-auth failures (e.g. session mint failed) → back to vendor login,
    // NOT the dashboard (which would bounce an unauthenticated user to /login).
    if (isVendorAuthFlow) {
      return res.redirect(`${clientUrl}/login-as-vendor?error=auth_failed`);
    }
    res.redirect(`${clientUrl}/dashboard?google=error&reason=auth_failed`);
  }
};

// ============================================
// USER REGISTRATION (simple email/password)
// ============================================

// POST /api/auth/register/user
const registerUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ message: 'Name, email and password are required' });

    // One account per email (unified model). Existing account → log in. A host
    // can already book with their host account, so no separate user account is
    // needed.
    const { data: existing } = await supabaseAdmin
      .from('profiles').select('id, role').eq('email', email.toLowerCase().trim()).maybeSingle();
    if (existing) {
      return res.status(409).json({ message: 'An account with this email already exists. Please log in.' });
    }

    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name },
      });

    if (authError) return res.status(400).json({ message: authError.message });

    const profile = await upsertProfile({
      id: authData.user.id,
      name,
      email: authData.user.email || email,
      role: "guest",
    });

    // Brand-new guest (email/password path) → founder welcome. Awaited in a
    // try/catch (mirrors the Google host VENDOR_WELCOME path); the engine queues
    // the email so this is cheap. (The OTP path is covered in ensureGuestProfile.)
    try {
      await require("../services/notificationEngine").send({
        event: "GUEST_WELCOME",
        data: {
          email: profile.email,
          name: profile.name,
          emailUser: { name: profile.name, email: profile.email, username: profile.username },
          emailData: { first_name: profile.first_name || (profile.name || "").split(" ")[0] || "there" },
          recipientUserId: profile.id,
        },
      });
    } catch (e) {
      console.error("registerUser: GUEST_WELCOME send error (non-fatal):", e.message);
    }

    const { data: signInData, error: signInError } =
      await signInWithPassword(email, password);
    if (signInError)
      return res.status(500).json({ message: signInError.message });

    res.status(201).json(await serializeProfile(profile, signInData.session));
  } catch (error) {
    safeError(res, error);
  }
};

// ============================================
// OTP FLOW (for guest booking without signup)
// ============================================

// Customer identity = mobile number. The OTP record is keyed by the
// normalised phone when one is provided (email stays the fallback for older
// clients still in the wild). Delivery goes to WhatsApp AND email — whichever
// channels the Notification Engine has enabled — so OTP always arrives.
const normalizePhone = (p) => {
  const cleaned = String(p || "").replace(/[\s\-().]/g, "");
  return /^\+?\d{8,15}$/.test(cleaned) ? cleaned : null;
};
const otpIdentifier = ({ email, phone }) => normalizePhone(phone) || (email || "").toLowerCase().trim();

// POST /api/auth/send-otp — sends OTP to guest's phone (WhatsApp) + email
const sendOtp = async (req, res) => {
  try {
    const { email, name, phone, purpose } = req.body;
    const normalizedPhone = normalizePhone(phone);
    if (!email && !normalizedPhone)
      return res.status(400).json({ message: "A valid mobile number or email is required" });

    // Guest-login door: hosts MAY log into their guest space by phone (dual login,
    // superseding the old host-Google-only rule). Only a superadmin number is
    // refused here — an admin must never receive a user session via WhatsApp OTP.
    // Scoped to purpose:'login' so the booking OTP flow is untouched. Mirrored by
    // the verifyOtpLogin safety net.
    if (purpose === "login" && normalizedPhone) {
      const { data: prof } = await supabaseAdmin
        .from("profiles")
        .select("role")
        .eq("phone", normalizedPhone)
        .maybeSingle();
      if (prof && prof.role === "superadmin")
        return res.status(409).json({ message: "This number is registered as an admin. Please use admin login." });
    }

    const identifier = otpIdentifier({ email, phone });
    const otp = otpStore.generate();
    // Securely stored: bcrypt hash, 3 attempts, 3 sends/hour, 15-min lockout
    const stored = await otpStore.set(identifier, otp);
    if (stored && stored.ok === false) return res.status(429).json({ message: stored.reason });

    // Ensure a guest profile exists BEFORE responding so verifyOtp can link the
    // booking. Best-effort and resilient (handles orphaned auth users); a failure
    // here must never block OTP delivery.
    try {
      if (email) await ensureGuestProfile(email, name);
    } catch (profileErr) {
      console.error("send-otp: ensureGuestProfile error (non-fatal):", profileErr.message);
    }

    // Respond immediately; OTP delivery (WhatsApp + email) is slow (~6s) and
    // best-effort. Rate-limit + otpStore.set above already gate correctness, so
    // send in the background to keep the endpoint sub-100ms.
    res.json({ message: "Verification code sent" });

    // Email rendered from the BOOKING_OTP DB template by the Communication Engine.
    runInBackground("send-otp:notify", () =>
      sendOtpNotification({ email, phone, name, otp }));
  } catch (error) {
    console.error("send-otp error:", error);
    safeError(res, error);
  }
};

// POST /api/auth/verify-otp — verifies OTP from Supabase
const verifyOtp = async (req, res) => {
  try {
    const { email, phone, otp } = req.body;
    if ((!email && !normalizePhone(phone)) || !otp)
      return res.status(400).json({ message: "Mobile number (or email) and OTP required" });

    // Validate against the same identifier the code was issued under
    // (phone-first; email for older clients).
    const result = await otpStore.verify(otpIdentifier({ email, phone }), otp);
    if (!result.valid) {
      return res.status(400).json({ message: result.reason });
    }

    // The email is now verified. Ensure a guest profile exists so the booking can
    // be linked to a guest account — but NEVER fail verification if it can't be
    // created. A verified email is enough; the booking proceeds with a null
    // guest_id in the worst case.
    let profile = null;
    try {
      if (email) profile = await ensureGuestProfile(email);
    } catch (e) {
      console.error("verify-otp: ensureGuestProfile error (non-fatal):", e.message);
    }

    // Security audit H-1: issue a short-lived grant bound to the verified contact.
    // createBooking requires this for anonymous bookings so the API can no longer
    // be driven with a bare guest_email/phone (notification relay + slot squatting).
    const bookingGrant = guestGrant.issue({ email, phone });

    res.json({
      message: "OTP verified",
      verified: true,
      bookingGrant,
      user: profile
        ? {
            _id: profile.id,
            name: profile.name,
            email: profile.email,
            role: profile.role,
            username: profile.username,
          }
        : { _id: null, email: (email || "").toLowerCase().trim(), role: "guest" },
    });
  } catch (error) {
    console.error("verify-otp error:", error);
    safeError(res, error);
  }
};

// ============================================
// PHONE-PRIMARY USER LOGIN
// ============================================

// Synthetic Supabase auth email for a phone-only account. Internal artifact —
// the user never sees or types it. Deterministic from the e164 digits so it is
// idempotent across create-or-resolve.
const syntheticPhoneEmail = (phone) =>
  `p${String(phone).replace(/\D/g, "")}@users.bookasloth.app`;

// Find the guest profile for a phone, creating one if none exists. Order matters
// to avoid duplicate accounts:
//   1. profiles.phone match
//   2. a past booking's guest_phone → its guest profile (link phone onto it)
//   3. create a fresh guest (synthetic email + temp password)
// The profiles_phone_unique_idx (v3.1) is the DB-level backstop against races.
const findOrCreateProfileByPhone = async (normalizedPhone) => {
  // 1. Direct match on the unique phone column.
  const { data: byPhone } = await supabaseAdmin
    .from("profiles").select("*").eq("phone", normalizedPhone).maybeSingle();
  if (byPhone) return byPhone;

  // 2. Returning guest who booked before phone-login existed: link via booking.
  const { data: booking } = await supabaseAdmin
    .from("bookings")
    .select("guest_id")
    .eq("guest_phone", normalizedPhone)
    .not("guest_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (booking?.guest_id) {
    const { data: linked } = await supabaseAdmin
      .from("profiles").select("*").eq("id", booking.guest_id).maybeSingle();
    if (linked) {
      await supabaseAdmin
        .from("profiles")
        .update({ phone: normalizedPhone, updated_at: new Date().toISOString() })
        .eq("id", linked.id);
      return { ...linked, phone: normalizedPhone };
    }
  }

  // 3. Brand-new phone account. Username is derived from the (unique) phone, so
  // no slug-uniqueness round-trip is needed.
  const email = syntheticPhoneEmail(normalizedPhone);
  const digits = String(normalizedPhone).replace(/\D/g, "");
  const { data: created } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: `tmp_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    email_confirm: true,
    user_metadata: { name: "Guest" },
  });
  const userId = created?.user?.id;
  if (!userId) throw new Error("Could not create account");

  // Phone-derived username, run through the SAME reserved guard as every other
  // write point — closes the prior bypass where `user-<digits>` was written with
  // no check. In practice user-<digits> is never reserved; the fallback only
  // triggers for the degenerate empty-digits case (normalizes to bare "user").
  let username = normalizeSlug(`user-${digits}`);
  if (isReserved(username)) username = await usernameService.createInitialUsername();

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .upsert(
      {
        id: userId,
        name: "Guest",
        email,
        role: "guest",
        username,
        phone: normalizedPhone,
        password_set: false,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    )
    .select("*")
    .single();
  // Record the phone-derived username as the initial alias (non-reuse + history).
  if (profile?.username) await usernameService.recordInitialUsername(userId, profile.username);
  return profile;
};

// Reunite a now-authenticated guest with the bookings they made anonymously on
// this phone. Anonymous OTP bookings are stored guest_id=NULL (the booker has no
// session at booking time), so they never surface in /user/my-bookings and can't
// be cancelled/rescheduled. This assigns those orphans to the resolved guest.
// Additive + idempotent (only rewrites NULL rows for THIS verified phone) and
// never throws — a login must not fail because a back-fill did.
const backfillGuestBookings = async (guestId, normalizedPhone) => {
  if (!guestId || !normalizedPhone) return;
  try {
    const { error } = await supabaseAdmin
      .from("bookings")
      .update({ guest_id: guestId, updated_at: new Date().toISOString() })
      .eq("guest_phone", normalizedPhone)
      .is("guest_id", null);
    if (error) console.error("backfillGuestBookings (non-fatal):", error.message);
  } catch (e) {
    console.error("backfillGuestBookings threw (non-fatal):", e.message);
  }
};

// POST /api/auth/login-phone — end-user login with phone + password
const loginWithPhone = async (req, res) => {
  try {
    const { phone, password } = req.body;
    if (!phone || !password)
      return res.status(400).json({ message: "Phone and password are required" });
    const normalized = normalizePhone(phone);
    if (!normalized)
      return res.status(400).json({ message: "A valid mobile number is required" });

    const { data: profile } = await supabaseAdmin
      .from("profiles").select("*").eq("phone", normalized).maybeSingle();

    // Unified login (flagged, Phase 3): when ON, ANY account may sign in by phone
    // (one identity, email-or-phone). When OFF, phone login stays guest-only —
    // the legacy separate-identity behavior. Enumeration-resistant either way.
    // Capability is read from is_host (v3.34 source of truth); superadmin is a
    // platform-admin flag still carried on `role` until the Phase D cleanup.
    const unifiedLogin = await featureFlags.isFeatureEnabled("unified_login");
    const isHostAccount = !!profile?.is_host || profile?.role === "superadmin";
    // No account, or (legacy mode) a host/admin account → same 401 as wrong password.
    if (!profile || (!unifiedLogin && isHostAccount)) {
      // Equalize response time with the real wrong-password path (which makes a
      // signInWithPassword round-trip) so an attacker can't time-distinguish a
      // registered guest from an unknown/non-guest number.
      await signInWithPassword("nonexistent@bookasloth.invalid", String(password)).catch(() => {});
      return res.status(401).json({ message: "Invalid phone or password" });
    }
    if (!profile.password_set) {
      return res.status(409).json({ needsPassword: true, message: "Set a password to continue." });
    }

    const lock = lockoutActive(profile);
    if (lock.locked)
      return res.status(429).json({ message: `Too many attempts. Try again in ${lock.mins} minute(s).` });

    const { data, error } = await signInWithPassword(profile.email, password);
    if (error) {
      await recordLoginFailure(profile);
      return res.status(401).json({ message: "Invalid phone or password" });
    }
    await resetLoginCounters(profile.id);

    res.json(await serializeProfile(profile, data.session));
  } catch (error) {
    safeError(res, error);
  }
};

// POST /api/auth/verify-otp-login — verify phone OTP and issue a session.
// Unlike verify-otp (booking), this finds-or-creates by phone and mints a real
// session so the user is logged in.
const verifyOtpLogin = async (req, res) => {
  try {
    const { phone, otp } = req.body;
    const normalized = normalizePhone(phone);
    if (!normalized || !otp)
      return res.status(400).json({ message: "Mobile number and OTP are required" });

    const result = await otpStore.verify(normalized, otp);
    if (!result.valid)
      return res.status(400).json({ message: result.reason });

    const profile = await findOrCreateProfileByPhone(normalized);
    if (!profile)
      return res.status(500).json({ message: "Could not access your account" });
    // Dual login: a host may hold a guest session alongside their host (Google)
    // one. Only a superadmin is barred from minting a user session by phone OTP —
    // admin login is a separate, isolated door.
    if (profile.role === "superadmin")
      return res.status(409).json({ message: "This number is registered as an admin. Please use admin login." });

    // Reunite the guest with any anonymous bookings made on this verified number.
    await backfillGuestBookings(profile.id, normalized);

    const session = await mintSessionForEmail(profile.email);
    res.json(await serializeProfile(profile, session));
  } catch (error) {
    safeError(res, error);
  }
};

// POST /api/auth/set-password — logged-in user sets a real password so they can
// log in with phone + password next time (flips password_set).
const setPassword = async (req, res) => {
  try {
    const { password } = req.body;
    // Match the registration/reset password policy (8–128 chars, upper + number)
    // — this path previously accepted any 8-char string, unlike registerRules.
    if (
      !password ||
      password.length < 8 ||
      password.length > 128 ||
      !/[A-Z]/.test(password) ||
      !/[0-9]/.test(password)
    )
      return res.status(400).json({
        message: "Password must be 8–128 characters and include an uppercase letter and a number",
      });

    const { error } = await supabaseAdmin.auth.admin.updateUserById(req.user.id, { password });
    if (error) {
      console.error('setPassword:', error.message);
      return res.status(400).json({ message: 'Could not set password. Please try again.' });
    }

    await supabaseAdmin
      .from("profiles")
      .update({ password_set: true, updated_at: new Date().toISOString() })
      .eq("id", req.user.id);

    res.json({ ok: true });
  } catch (error) {
    safeError(res, error);
  }
};

// ============================================
// SHARED: LOGIN & GET ME
// ============================================

// POST /api/auth/login
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // ── Per-account lockout check (distributed brute-force defence) ──────────
    const emailKey = String(email || '').toLowerCase().trim();
    const { data: pre } = await supabaseAdmin
      .from('profiles')
      .select('id, email, failed_login_count, login_locked_until')
      .eq('email', emailKey)
      .maybeSingle();

    const lock = lockoutActive(pre);
    if (lock.locked)
      return res.status(429).json({ message: `Too many attempts. Try again in ${lock.mins} minute(s).` });

    const { data, error } = await signInWithPassword(email, password);
    if (error) {
      if (pre) await recordLoginFailure(pre);
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    await resetLoginCounters(data.user.id);

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("id", data.user.id)
      .single();

    res.json(await serializeProfile(profile, data.session));
  } catch (error) {
    safeError(res, error);
  }
};

// POST /api/auth/login-unified — single login door (Phase B). Accepts an
// identifier that is EITHER an email OR a phone number, plus a password, and
// signs the matching account in regardless of role (unified identity — one
// account books AND hosts). The legacy /login (email) and /login-phone (phone)
// endpoints remain as thin aliases for older clients.
const loginUnified = async (req, res) => {
  try {
    const { identifier, password } = req.body;
    if (!identifier || !password)
      return res.status(400).json({ message: "Email or phone and password are required" });

    const id = String(identifier).trim();
    const looksEmail = id.includes("@");
    const phone = looksEmail ? null : normalizePhone(id);
    if (!looksEmail && !phone)
      return res.status(400).json({ message: "Enter a valid email or mobile number" });

    // Resolve the account by phone (digits) or email — one identity either way.
    const { data: profile } = phone
      ? await supabaseAdmin.from("profiles").select("*").eq("phone", phone).maybeSingle()
      : await supabaseAdmin.from("profiles").select("*").eq("email", id.toLowerCase()).maybeSingle();

    if (!profile) {
      // Equalize timing with the real signin round-trip (enumeration resistance).
      await signInWithPassword("nonexistent@bookasloth.invalid", String(password)).catch(() => {});
      return res.status(401).json({ message: "Invalid login or password" });
    }
    // A phone-only account that never set a password → actionable prompt (the
    // client sends an OTP so they can sign in and set one). Email accounts always
    // have a usable password, so this gate only applies to the phone path.
    if (phone && !profile.password_set) {
      return res.status(409).json({ needsPassword: true, message: "Set a password to continue." });
    }

    const lock = lockoutActive(profile);
    if (lock.locked)
      return res.status(429).json({ message: `Too many attempts. Try again in ${lock.mins} minute(s).` });

    const { data, error } = await signInWithPassword(profile.email, password);
    if (error) {
      await recordLoginFailure(profile);
      return res.status(401).json({ message: "Invalid login or password" });
    }
    await resetLoginCounters(profile.id);

    res.json(await serializeProfile(profile, data.session));
  } catch (error) {
    safeError(res, error);
  }
};

// GET /api/auth/me
const getMe = async (req, res) => {
  const PERF = process.env.NODE_ENV !== 'production'
    ? process.env.PERF_LOG !== 'false'
    : process.env.PERF_LOG === 'true';
  try {
    const t0 = process.hrtime.bigint();
    const { data: profile, error } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("id", req.user.id)
      .single();
    if (PERF) {
      const ms = Number(process.hrtime.bigint() - t0) / 1e6;
      console.log(`[perf:me] profiles.select(id=${req.user.id}) → ${ms.toFixed(1)}ms`);
    }

    if (error || !profile) return res.status(404).json({ message: "Profile not found" });
    // Return the same serialized shape as login/register so the client can merge it cleanly
    res.json(await serializeProfile(profile, null));
  } catch (error) {
    safeError(res, error);
  }
};

// PUT /api/auth/me
// Self-service profile edit for any logged-in user (guest or host). Only a
// small allow-list of personal fields is writable here — never role, plan,
// username, etc. Email is intentionally NOT editable (it's the auth identity).
const updateMe = async (req, res) => {
  try {
    const { name, phone, profile_image, date_of_birth } = req.body;
    const patch = { updated_at: new Date().toISOString() };
    if (name !== undefined)          patch.name = String(name).trim();
    if (phone !== undefined)         patch.phone = phone ? String(phone).trim() : null;
    if (profile_image !== undefined) patch.profile_image = profile_image || null;
    if (date_of_birth !== undefined) {
      // Private — only used for the birthday greeting (v3.138), never shown publicly.
      const { parseDob } = require("../lib/dobValidator");
      const dob = parseDob(date_of_birth);
      if (!dob.ok) return res.status(400).json({ message: dob.error });
      patch.date_of_birth = dob.value;
    }

    if (patch.name === "") return res.status(400).json({ message: "Name cannot be empty" });

    const { data: profile, error } = await supabaseAdmin
      .from("profiles")
      .update(patch)
      .eq("id", req.user.id)
      .select("*")
      .single();
    if (error || !profile) return safeError(res, error || new Error("Update failed"));
    res.json(await serializeProfile(profile, null));
  } catch (error) {
    safeError(res, error);
  }
};

// POST /api/auth/become-host
// Unified identity: add the hosting capability to the CURRENT logged-in account
// (no separate host account). Flips is_host=true — the v3.34 trigger mirrors
// role='host' — and seeds onboarding state so the client can walk the existing
// /vendor-register steps on this same id. Idempotent: a host who already finished
// onboarding just gets their profile back unchanged (no reset).
const becomeHost = async (req, res) => {
  try {
    const updated = await enableHostingForProfile(req.user.id);
    res.json(await serializeProfile(updated, null));
  } catch (error) {
    if (/Profile not found/.test(error.message || "")) {
      return res.status(404).json({ message: "Profile not found" });
    }
    safeError(res, error);
  }
};

// POST /api/auth/cancel-hosting — the un-become-host door. Reverses an
// in-progress hosting upgrade (the mirror of becomeHost) so a guest who opened
// the hosting flow and backed out isn't trapped as a half-onboarded host,
// forced into /vendor-register on every login. GUARD: only ever demotes a host
// whose onboarding never completed — a live host (onboarding_completed = true)
// is refused, so this can never strip a real host of their account.
const cancelHosting = async (req, res) => {
  try {
    const { data: profile, error } = await supabaseAdmin
      .from("profiles")
      .select("id, is_host, onboarding_completed")
      .eq("id", req.user.id)
      .single();
    if (error || !profile) return res.status(404).json({ message: "Profile not found" });
    // Nothing to reverse: already a guest, or a fully-onboarded (real) host.
    if (!profile.is_host || profile.onboarding_completed) {
      return res.status(409).json({ message: "Hosting can't be cancelled for this account" });
    }

    const patch = {
      is_host: false,
      onboarding_slug: null,
      onboarding_step_completed: 0,
      onboarding_completed: false,
      updated_at: new Date().toISOString(),
    };
    let { data: updated, error: upErr } = await supabaseAdmin
      .from("profiles").update(patch).eq("id", req.user.id).select("*").single();
    // Schema fallback: pre-onboarding DBs lack the onboarding_* columns — retry
    // with just the capability flip so the reversal still works. Mirrors
    // enableHostingForProfile's fallback exactly.
    if (upErr && /Could not find the|column.*does not exist/i.test(upErr.message || "")) {
      ({ data: updated, error: upErr } = await supabaseAdmin
        .from("profiles")
        .update({ is_host: false, updated_at: new Date().toISOString() })
        .eq("id", req.user.id).select("*").single());
    }
    if (upErr || !updated) throw upErr || new Error("Could not cancel hosting");
    res.json(await serializeProfile(updated, null));
  } catch (error) {
    safeError(res, error);
  }
};

// POST /api/auth/linkedin/verify — the logged-in host has just linked their
// LinkedIn identity to their Supabase auth user via the client's
// supabase.auth.linkIdentity({ provider: 'linkedin_oidc' }). We NEVER trust the
// client's claim: read the auth user's identities with the service-role key and
// confirm linkedin_oidc is actually present, then stamp the profile and award
// the manual "LinkedIn Verified" badge. Idempotent — re-verifying is a no-op.
const LINKEDIN_BADGE_SLUG = "linkedin-verified";
const verifyLinkedin = async (req, res) => {
  try {
    const userId = req.user.id;

    // Source of truth: the identities Supabase actually holds for this auth user.
    const { data: authData, error: auErr } =
      await supabaseAdmin.auth.admin.getUserById(userId);
    if (auErr || !authData?.user) {
      return res.status(404).json({ message: "Account not found" });
    }
    const li = (authData.user.identities || []).find(
      (i) => i.provider === "linkedin_oidc",
    );
    if (!li) {
      return res.status(400).json({
        message: "LinkedIn isn't linked yet. Please try connecting again.",
      });
    }
    const linkedinSub = li.identity_data?.sub || li.identity_id || li.id || null;

    // Stamp verification (idempotent). Schema fallback: pre-v3.170 DBs lack the
    // columns — skip the stamp but still award the badge (the visible outcome).
    let { error: upErr } = await supabaseAdmin
      .from("profiles")
      .update({
        linkedin_verified_at: new Date().toISOString(),
        linkedin_sub: linkedinSub,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);
    if (upErr && !/Could not find the|column.*does not exist/i.test(upErr.message || "")) {
      console.error("verifyLinkedin: profile stamp error (non-fatal):", upErr.message);
    }

    // "LinkedIn Verified" is an automatic (engine-owned) badge keyed off the
    // linkedin_verified attribute metric (= linkedin_verified_at IS NOT NULL,
    // just stamped above). Run a scoped, synchronous reconcile so the engine
    // awards it now, then report whether it's held. Best-effort; a badge failure
    // never fails verification (the profile stamp is the real outcome).
    let badgeAwarded = false;
    try {
      await require("../services/badgeEngine").evaluate({ vendorIds: [userId] });
      const { data: badge } = await supabaseAdmin
        .from("badges").select("id").eq("slug", LINKEDIN_BADGE_SLUG).maybeSingle();
      if (badge) {
        const { data: held } = await supabaseAdmin
          .from("vendor_badges").select("id")
          .eq("vendor_id", userId).eq("badge_id", badge.id).is("revoked_at", null).maybeSingle();
        badgeAwarded = !!held;
      }
    } catch (e) {
      console.error("verifyLinkedin: badge reconcile (non-fatal):", e.message);
    }

    // Re-serialize so the client picks up linkedin_verified in one round trip.
    const { data: profile } = await supabaseAdmin
      .from("profiles").select("*").eq("id", userId).single();
    res.json({ ...(await serializeProfile(profile, null)), badgeAwarded });
  } catch (error) {
    safeError(res, error);
  }
};

// ============================================
// PASSWORD RESET (OTP-based, all user types)
// ==========================================

// POST /api/auth/forgot-password
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email is required" });

    const normalizedEmail = email.toLowerCase().trim();

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id, name, email")
      .eq("email", normalizedEmail)
      .single();

    // Always return success to prevent email enumeration
    if (!profile) {
      return res.json({ message: "If that email exists, an OTP has been sent." });
    }

    // Respect an active reset lockout: re-requesting a code must NOT clear it,
    // otherwise the per-code attempt lockout in resetPassword is trivially
    // bypassable (guess N times → request new code → repeat). While locked we
    // issue nothing and leave attempts/locked_until intact.
    const { data: existingOtp } = await supabaseAdmin
      .from("otp_codes")
      .select("locked_until")
      .eq("email", normalizedEmail)
      .eq("type", "password_reset")
      .maybeSingle();
    if (existingOtp?.locked_until && new Date(existingOtp.locked_until) > new Date()) {
      return res.json({ message: "If that email exists, an OTP has been sent." });
    }

    // CSPRNG 6-digit code; stored only as a bcrypt hash (never plaintext).
    const otp = crypto.randomInt(100000, 1000000).toString();
    const otpHash = await bcrypt.hash(otp, 10);

    // Upsert the reset code on the composite key (email, type) (audit P1-9) so a
    // booking/login OTP for the same email can no longer overwrite it (and can't
    // clear its brute-force lockout). Falls back to the (email) conflict target if
    // the v3.44 migration isn't applied yet.
    const upsertReset = async (row) => {
      let r = await supabaseAdmin.from("otp_codes").upsert(row, { onConflict: "email,type" });
      if (r.error && /no unique or exclusion constraint matching the ON CONFLICT/i.test(r.error.message || "")) {
        r = await supabaseAdmin.from("otp_codes").upsert(row, { onConflict: "email" });
      }
      return r;
    };

    const { error: otpError } = await upsertReset({
      email: normalizedEmail,
      otp: "",                 // legacy plaintext column kept empty
      otp_hash: otpHash,
      attempts: 0,
      locked_until: null,
      type: "password_reset",
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      created_at: new Date().toISOString(),
    });

    if (otpError) {
      // Pre-v1.9 DB without otp_hash/attempts/locked_until — degrade to the
      // legacy plaintext column so reset still works (resetPassword reads both).
      if (/Could not find the|column.*does not exist/i.test(otpError.message || "")) {
        const { error: legacyErr } = await upsertReset({
          email: normalizedEmail,
          otp,
          type: "password_reset",
          expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
          created_at: new Date().toISOString(),
        });
        if (legacyErr) {
          console.error("forgot-password: OTP store error:", legacyErr.message);
          return res.status(500).json({ message: "Failed to send reset code. Please try again." });
        }
      } else {
        console.error("forgot-password: OTP store error:", otpError.message);
        return res.status(500).json({ message: "Failed to send reset code. Please try again." });
      }
    }

    // Email rendered from the PASSWORD_RESET DB template; immediate (waiting user).
    await NotificationEngine.send({
      event: 'PASSWORD_RESET',
      data: {
        email: normalizedEmail,
        emailData: { otp: String(otp) },
        emailUser: { email: normalizedEmail, name: profile.name },
        immediateEmail: true,
      },
    });

    res.json({ message: "If that email exists, an OTP has been sent." });
  } catch (error) {
    console.error("forgot-password error:", error);
    res.status(500).json({ message: "Failed to send reset code. Please try again." });
  }
};

// POST /api/auth/reset-password
const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword)
      return res.status(400).json({ message: "Email, OTP, and new password are required" });
    // Match the registration password policy (8+ chars, upper + number).
    if (
      newPassword.length < 8 ||
      newPassword.length > 128 ||
      !/[A-Z]/.test(newPassword) ||
      !/[0-9]/.test(newPassword)
    )
      return res.status(400).json({
        message: "Password must be 8–128 characters and include an uppercase letter and a number",
      });

    const normalizedEmail = email.toLowerCase().trim();

    const { data: record } = await supabaseAdmin
      .from("otp_codes")
      .select("*")
      .eq("email", normalizedEmail)
      .eq("type", "password_reset")
      .maybeSingle();

    if (!record)
      return res.status(400).json({ message: "No reset code found. Request a new one." });
    if (record.type && record.type !== "password_reset")
      return res.status(400).json({ message: "Invalid reset code." });

    // Lockout after too many wrong attempts (brute-force protection).
    const MAX_RESET_ATTEMPTS = 5;
    const LOCKOUT_MS = 15 * 60 * 1000;
    if (record.locked_until && new Date(record.locked_until) > new Date()) {
      const mins = Math.ceil((new Date(record.locked_until) - new Date()) / 60000);
      return res.status(429).json({ message: `Too many attempts. Try again in ${mins} minute(s).` });
    }
    if (new Date(record.expires_at) < new Date()) {
      await supabaseAdmin.from("otp_codes").delete().eq("email", normalizedEmail).eq("type", "password_reset");
      return res.status(400).json({ message: "Reset code expired. Request a new one." });
    }

    // Compare against the bcrypt hash (v1.9) or the legacy plaintext column.
    const supplied = String(otp).trim();
    const matches = record.otp_hash
      ? await bcrypt.compare(supplied, record.otp_hash)
      : String(record.otp) === supplied;

    if (!matches) {
      const attempts = (record.attempts || 0) + 1;
      if (attempts >= MAX_RESET_ATTEMPTS) {
        await supabaseAdmin
          .from("otp_codes")
          .update({ attempts, locked_until: new Date(Date.now() + LOCKOUT_MS).toISOString() })
          .eq("email", normalizedEmail)
          .eq("type", "password_reset");
        return res.status(429).json({ message: "Too many incorrect attempts. Try again in 15 minutes." });
      }
      // Best-effort attempt increment (no-op on pre-v1.9 schemas without the column).
      await supabaseAdmin.from("otp_codes").update({ attempts }).eq("email", normalizedEmail).eq("type", "password_reset");
      return res.status(400).json({ message: "Invalid reset code." });
    }

    await supabaseAdmin.from("otp_codes").delete().eq("email", normalizedEmail).eq("type", "password_reset");

    // BUG-06 fixed: use profile.id (= Supabase auth user id) instead of listUsers() which only returns first 1000
    const { data: profileForReset } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("email", normalizedEmail)
      .single();
    if (!profileForReset) return res.status(404).json({ message: "User not found." });

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(profileForReset.id, {
      password: newPassword,
    });
    if (updateError) return res.status(400).json({ message: updateError.message });

    // Security confirmation email (queued, non-blocking)
    NotificationEngine.send({
      event: 'SECURITY_PASSWORD_CHANGED',
      data: { email: normalizedEmail, emailUser: { email: normalizedEmail } },
    }).catch((e) => console.error('password-changed email error:', e.message));

    res.json({ message: "Password reset successful. You can now log in." });
  } catch (error) {
    console.error("reset-password error:", error);
    safeError(res, error);
  }
};

module.exports = {
  serializeProfile,
  upsertProfile,
  registerVendor,
  registerUser,
  googleAuth,
  googleVendorAuth,
  googleCallback,
  sendOtp,
  verifyOtp,
  login,
  loginUnified,
  loginWithPhone,
  verifyOtpLogin,
  setPassword,
  getMe,
  updateMe,
  becomeHost,
  cancelHosting,
  verifyLinkedin,
  forgotPassword,
  resetPassword,
  maybeStampInvite,
  backfillGuestBookings,
  normalizeSeedTimezone,
};

const { supabaseAdmin } = require("../config/supabase");
const { safeError } = require('../utils/httpError');
const { setPublicCache } = require('../utils/httpCache');
const responseCache = require('../services/responseCache');
const { bustPublicReadCaches } = require('../services/publicCacheBust');
const { sanitizeLikeTerm } = require("../utils/searchSanitize");

// Server-side read-through cache TTL for the assembled public host profile.
const HOST_PROFILE_CACHE_MS = Number(process.env.HOST_PROFILE_CACHE_MS) || 120_000;
const { getConfig: getPlatformConfig } = require("../services/platformConfig");
const usernameService = require("../services/usernameService");
const { bustSitemapCache } = require("../utils/sitemapCache");
const planService = require('../services/planService');
const { validateCategorySelection } = require('../lib/categoryRules');
const { resolveAndValidateCategory, clearHostServiceCategories } = require('../lib/serviceCategory');
const { canActivateMore, canAddFreeService } = require('../middleware/planMiddleware');
const { isBackgroundKey } = require('../config/backgroundKeys');
const cleanBackgroundKey = (v) => (isBackgroundKey(v) ? v : null);

// SECURITY (audit H1): profile_image / cover_image were stored VERBATIM while
// every sibling URL field (map_link, social_links) is scheme-checked. A host
// could PUT a data:/javascript: URI (DB bloat / bad href) or an arbitrary
// external URL (off-platform tracker, referer leak, and the OG generator later
// fetches it). We only ever legitimately store: '' (cleared), a Google account
// avatar, or our own public 'images' bucket URL — verified against all live
// rows (googleusercontent.com, <project>.supabase.co, empty; nothing else).
// Anything outside that allowlist is coerced to '' rather than 400'd, so a
// malformed value degrades to the fallback avatar instead of blocking the save.
const cleanImageUrl = (v) => {
  const s = String(v ?? '').trim();
  if (!s) return '';
  let u;
  try { u = new URL(s); } catch { return ''; }
  if (u.protocol !== 'https:') return '';           // reject http:, data:, javascript:, blob:
  const host = u.hostname.toLowerCase();
  if (host === 'googleusercontent.com' || host.endsWith('.googleusercontent.com')) return s;
  if (host.endsWith('.supabase.co') && u.pathname.includes('/storage/v1/object/public/images/')) return s;
  return '';
};

// Orphan cleanup (audit M1): each upload gets a fresh random key and the old
// object was never removed, so replacing a photo leaked the previous file
// forever. Given a public images-bucket URL, return its in-bucket path (e.g.
// 'profiles/abc_1_x.jpg') so we can delete it; returns null for anything that
// isn't our images bucket (Google avatars, empty, external) — those we must
// NOT touch. Only cleans the 'profiles'/'covers' prefixes we own here.
const CLEANABLE_PREFIXES = ['profiles/', 'covers/'];
const imagesBucketPath = (url) => {
  const s = String(url ?? '').trim();
  if (!s) return null;
  let u;
  try { u = new URL(s); } catch { return null; }
  if (u.protocol !== 'https:' || !u.hostname.toLowerCase().endsWith('.supabase.co')) return null;
  const marker = '/storage/v1/object/public/images/';
  const i = u.pathname.indexOf(marker);
  if (i === -1) return null;
  const path = decodeURIComponent(u.pathname.slice(i + marker.length));
  if (!CLEANABLE_PREFIXES.some((p) => path.startsWith(p))) return null;
  return path;
};

// Best-effort delete of a replaced/removed image from the images bucket. Never
// throws — a failed cleanup must not fail the profile save (the DB row already
// points at the new value; a leftover file is cosmetic). Skips when the old
// value is unchanged or isn't one of our own bucket objects.
const cleanupReplacedImage = async (oldUrl, newUrl) => {
  if (oldUrl === newUrl) return;
  const path = imagesBucketPath(oldUrl);
  if (!path) return;
  try {
    await supabaseAdmin.storage.from('images').remove([path]);
  } catch (e) {
    console.warn('cleanupReplacedImage failed (non-fatal):', path, e?.message);
  }
};

// Clamp service money/time fields to safe bounds (audit P1-11). Mirrors
// serviceController — the controller-level backstop so a negative/oversized
// price or absurd duration can never be persisted, even via direct API.
const clampPrice = (v) => Math.min(500000, Math.max(0, Number.isFinite(parseFloat(v)) ? parseFloat(v) : 0));
const clampDuration = (v) => Math.min(480, Math.max(5, parseInt(v, 10) || 30));
const clampGrace = (v) => Math.min(1440, Math.max(0, parseInt(v, 10) || 0));

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/; // HH:MM 24h
const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

// Validate a weekly_schedule payload (audit P1-10). A host could previously save
// end<=start, overlapping, or malformed windows; computeSlots then silently
// produced ZERO bookable slots — the host looked "open" but every guest saw an
// empty calendar (invisible lost bookings). Returns null if ok, else a message.
const validateWeeklySchedule = (ws) => {
  if (ws == null) return null; // not being updated
  if (typeof ws !== 'object' || Array.isArray(ws)) return 'Invalid weekly schedule.';
  for (const day of Object.keys(ws)) {
    if (!DAY_KEYS.includes(String(day).toLowerCase())) return `Unknown day "${day}".`;
    const windows = ws[day];
    if (windows == null) continue;
    if (!Array.isArray(windows)) return `Schedule for ${day} must be a list of time windows.`;
    const ranges = [];
    for (const w of windows) {
      if (!w || typeof w !== 'object') return `Invalid time window on ${day}.`;
      const { start, end } = w;
      if (!TIME_RE.test(String(start)) || !TIME_RE.test(String(end)))
        return `Use HH:MM 24-hour times on ${day}.`;
      const [sh, sm] = String(start).split(':').map(Number);
      const [eh, em] = String(end).split(':').map(Number);
      const s = sh * 60 + sm, e = eh * 60 + em;
      if (e <= s) return `On ${day}, the end time must be after the start time.`;
      ranges.push([s, e]);
    }
    ranges.sort((a, b) => a[0] - b[0]);
    for (let i = 1; i < ranges.length; i++) {
      if (ranges[i][0] < ranges[i - 1][1]) return `Overlapping time windows on ${day}.`;
    }
  }
  return null;
};

// Public host columns. SECURITY: explicit whitelist — never select('*') on a
// public route. SEO override cols (v3.19) are appended with a fallback so a
// pre-migration DB still resolves the profile.
const HOST_PUBLIC_COLS =
  "id, name, username, role, bio, tagline, profession, location, profile_image, " +
  "cover_image, social_links, badges, theme_color, plan, is_verified, google_calendar_connected, primary_category, categories, updated_at";
const HOST_SEO_COLS =
  "seo_title, seo_description, og_title, og_description, seo_image, is_indexable, og_image, og_status";

// Public service columns for the profile listing. PERF: never select('*') here —
// the profile can carry up to 100 services and '*' drags every heavy text column
// (long_description, faqs, included_items, excluded_items) into the payload the
// public page never renders. The card only needs title/slug/desc/price/duration/
// mode (+ created_at for the "New" tag). Matches the schema-fallback set below so
// both query paths return an identical lean shape.
// price_on_request (v3.169) is kept SEPARATE so a pre-migration DB degrades to
// SERVICE_PUBLIC_COLS_BASE (shows the price, current behaviour) instead of the
// whole profile losing its services.
const SERVICE_PUBLIC_COLS_BASE =
  "id, host_id, title, slug, description, short_description, type, duration, " +
  "price, currency, meeting_mode, is_active, created_at, updated_at";
const SERVICE_PUBLIC_COLS = `${SERVICE_PUBLIC_COLS_BASE}, price_on_request`;

// ??? Profile slug helpers ????????????????????????????????????????????????????
const slugifyUsername = (text) =>
  text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/--+/g, '-')
    .slice(0, 60);

// Find a unique profile slug (username) -- appends numeric suffix if taken
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

const insertServiceSafe = async (payload) => {
  let result = await supabaseAdmin
    .from("services")
    .insert(payload)
    .select()
    .single();

  // Retry with fallback if schema cache doesn't recognize newer columns
  if (
    result.error &&
    /Could not find the '(grace_period_minutes|thumbnail_url|category|primary_category)' column|column.*does not exist/i.test(
      result.error.message,
    )
  ) {
    const payloadCopy = { ...payload };
    delete payloadCopy.grace_period_minutes;
    delete payloadCopy.thumbnail_url;
    // `category` and `primary_category` are deliberately excluded from the legacy
    // fallback so a stale / pre-migration schema (without the columns) still
    // writes the core fields.
    delete payloadCopy.category;
    delete payloadCopy.primary_category;
    result = await supabaseAdmin
      .from("services")
      .insert(payloadCopy)
      .select()
      .single();
  }
  return result;
};

const updateServiceSafe = async (id, updates, userId) => {
  let result = await supabaseAdmin
    .from("services")
    .update(updates)
    .eq("id", id)
    .eq("host_id", userId)
    .select()
    .single();

  // Retry with fallback if schema cache doesn't recognize newer columns
  if (
    result.error &&
    /Could not find the '(grace_period_minutes|thumbnail_url|category|primary_category|og_status)' column|column.*does not exist/i.test(
      result.error.message,
    )
  ) {
    const updatesCopy = { ...updates };
    delete updatesCopy.grace_period_minutes;
    delete updatesCopy.thumbnail_url;
    // `category` and `primary_category` are deliberately excluded from the legacy
    // fallback so a stale / pre-migration schema (without the columns) still
    // writes the core fields.
    delete updatesCopy.category;
    delete updatesCopy.primary_category;
    // og_status (v3.154 OG card) — drop it on a pre-migration schema.
    delete updatesCopy.og_status;
    result = await supabaseAdmin
      .from("services")
      .update(updatesCopy)
      .eq("id", id)
      .eq("host_id", userId)
      .select()
      .single();
  }
  return result;
};

// Assemble the public profile payload (6+ queries). Returns a normalized
// outcome: { redirect, username } | { notFound: true } | { payload }. Kept as a
// pure-ish builder so responseCache.getOrSet can wrap it — including negative
// outcomes, which also shields the DB from crawlers walking dead usernames.
const buildHostProfile = async (username) => {
  // Try whitelist + SEO override cols; fall back to the base whitelist if the
  // v3.19 SEO migration isn't applied yet (so the profile still resolves).
  let { data: host, error } = await supabaseAdmin
    .from("profiles")
    .select(`${HOST_PUBLIC_COLS}, ${HOST_SEO_COLS}`)
    .eq("username", username)
    .eq("role", "host")
    .single();

  if (error && /Could not find the|column.*does not exist/i.test(error.message)) {
    ({ data: host, error } = await supabaseAdmin
      .from("profiles")
      .select(HOST_PUBLIC_COLS)
      .eq("username", username)
      .eq("role", "host")
      .single());
  }

  if (error || !host) {
    // Not a current username — it may be an OLD alias. Resolve via history and
    // tell the client to redirect to the canonical (current) username. The
    // SEO-grade HTTP 301 is issued by the Vercel edge function; this 200
    // envelope is defense-in-depth so the SPA self-corrects the URL too.
    const requested = String(username || "").toLowerCase();
    const resolved = await usernameService.resolve(requested);
    if (resolved && resolved.currentUsername && resolved.currentUsername !== requested) {
      return { redirect: true, username: resolved.currentUsername };
    }
    return { notFound: true };
  }

  // Defense-in-depth: the whitelist above already excludes these at the query
  // layer; this strip is a second guard in case the select ever changes.
  delete host.google_access_token;
  delete host.google_refresh_token;
  delete host.otp_code;
  delete host.otp_expires_at;

  // Task 10: Show unverified status but don't block -- client shows a banner
  // (flip host.is_verified to true in Admin -> Users to go fully live)

  // Fetch services + availability in parallel
  const [servicesResult, { data: availability }] = await Promise.all([
    supabaseAdmin.from("services").select(SERVICE_PUBLIC_COLS).eq("host_id", host.id).eq("is_active", true).limit(100),
    supabaseAdmin.from("availability").select("*").eq("host_id", host.id).single(),
  ]);

  let { data: services } = servicesResult;

  // Fallback if schema cache is stale
  if (
    servicesResult.error &&
    /Could not find the|column.*does not exist/i.test(servicesResult.error.message)
  ) {
    const fallback = await supabaseAdmin
      .from("services")
      .select(SERVICE_PUBLIC_COLS_BASE)
      .eq("host_id", host.id)
      .eq("is_active", true)
      .limit(100);
    services = fallback.data;
  }

  // Resolve the primary category's human label for display (best-effort).
  if (host?.primary_category) {
    const { data: cat } = await supabaseAdmin
      .from('categories').select('label').eq('slug', host.primary_category).maybeSingle();
    host.primary_category_label = cat?.label || null;
  }

  // Review aggregate for the profile's schema.org aggregateRating (guest→host,
  // not admin-hidden) — mirrors getHostReviews. Only rating rows are needed here;
  // the full comment list is a separate public read. Best-effort: a failure here
  // must not drop the profile, so reviewCount/avgRating default to 0.
  let reviews = [];
  let avgRating = 0;
  try {
    const { data: ratingRows } = await supabaseAdmin
      .from('reviews')
      .select('rating')
      .eq('host_id', host.id)
      .eq('direction', 'guest_to_host')
      .neq('status', 'hidden');
    if (Array.isArray(ratingRows) && ratingRows.length) {
      reviews = ratingRows;
      avgRating = Math.round((ratingRows.reduce((s, r) => s + (r.rating || 0), 0) / ratingRows.length) * 10) / 10;
    }
  } catch { /* rating is best-effort — a reviews read hiccup must not drop the profile */ }

  return { payload: { host, services: services || [], availability, reviews, avgRating } };
};

// GET /api/host/:username -- public profile
const getHostProfile = async (req, res) => {
  try {
    const username = req.params.username;
    // Read-through cache (120s) keyed by username. Busted on this host's profile
    // and service mutations (see bustHostCaches); the TTL is the backstop.
    const outcome = await responseCache.getOrSet(
      `hostprofile:${username}`,
      HOST_PROFILE_CACHE_MS,
      () => buildHostProfile(username),
    );

    if (outcome.redirect) return res.json({ redirect: true, username: outcome.username });
    if (outcome.notFound) return res.status(404).json({ message: "Host not found" });

    // Public, anonymous profile — cacheable. Short TTL so a profile/service edit
    // is reflected within ~2 min for viewers even on a cold shared cache.
    setPublicCache(res, 120);
    res.json(outcome.payload);
  } catch (error) {
    safeError(res, error);
  }
};

// PUT /api/host/profile -- update own profile
const updateProfile = async (req, res) => {
  try {
    const {
      name,
      bio,
      tagline,
      social_links,
      profile_image,
      cover_image,
      profession,
      location,
      map_link,
      theme_color,
      background_key,
      reschedule_fee,
      date_of_birth,
      is_indexable,
    } = req.body;

    // Username is NOT editable here. Changes go through the gated, rate-limited
    // PUT /api/host/username (WhatsApp-verified, max 2/year, 6-month gap). Any
    // `username` field in this body is ignored. Safety net: a legacy account with
    // no username gets an auto-generated one — an INITIAL assignment, not a change.
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles').select('username, email, profile_image, cover_image').eq('id', req.user.id).single();
    let initialUsername;
    if (!existingProfile?.username) {
      initialUsername = await usernameService.createInitialUsername(existingProfile?.email);
    }

    const updates = { updated_at: new Date().toISOString() }; // BUG-05 fixed: removed forced role:"host"
    if (name) updates.name = name;
    if (date_of_birth !== undefined) {
      // Private — only ever used for the birthday greeting, never shown publicly (v3.138).
      const { parseDob } = require('../lib/dobValidator');
      const dob = parseDob(date_of_birth);
      if (!dob.ok) return res.status(400).json({ message: dob.error });
      updates.date_of_birth = dob.value;
    }
    if (bio !== undefined) updates.bio = bio;
    if (tagline !== undefined) updates.tagline = tagline;
    if (initialUsername) updates.username = initialUsername;
    if (profile_image !== undefined) updates.profile_image = cleanImageUrl(profile_image);
    if (cover_image !== undefined) updates.cover_image = cleanImageUrl(cover_image);
    if (profession !== undefined) updates.profession = profession;
    if (location !== undefined) updates.location = location;
    if (map_link !== undefined) {
      // Offline-service venue link (Google Maps etc.). Sanitise like social links:
      // empty stays empty, http(s) kept, bare domain → https, any other scheme
      // (javascript:/data:) rejected so it can never become an XSS href.
      const v = String(map_link ?? '').trim().slice(0, 500);
      if (!v) updates.map_link = '';
      else if (/^https?:\/\//i.test(v)) updates.map_link = v;
      else if (/^[a-z][a-z0-9+.-]*:/i.test(v)) updates.map_link = '';
      else updates.map_link = `https://${v}`;
    }
    if (social_links && typeof social_links === 'object') {
      // SECURITY (audit M5): only persist http(s) links (and well-formed
      // emails). Strip javascript:/data:/etc so a stored value can never become
      // an XSS href on the public profile. Mirrors the client-side sanitiser.
      const clean = {};
      for (const [k, v] of Object.entries(social_links)) {
        const val = String(v ?? '').trim();
        if (!val) { clean[k] = ''; continue; }
        if (k === 'email') {
          clean[k] = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val) ? val : '';
        } else if (/^https?:\/\//i.test(val)) {
          clean[k] = val;
        } else if (/^[a-z][a-z0-9+.-]*:/i.test(val)) {
          clean[k] = ''; // reject any non-http(s) scheme (javascript:, data:, …)
        } else {
          clean[k] = `https://${val}`; // bare domain → assume https
        }
      }
      updates.social_links = clean;
    }
    // Validate and store theme color. Plan-gated server-side (mirror of
    // client/src/utils/themeUtils.js — keep both palettes in sync):
    //   free/starter → 3 presets, creator → 16 presets, professional → any hex.
    // Invalid input is now a 400, not a silent drop (was the root cause of
    // "saved but colour never changed" reports).
    if (theme_color !== undefined && theme_color !== null && theme_color !== "") {
      if (!/^#[0-9a-fA-F]{6}$/.test(theme_color)) {
        return res.status(400).json({ message: "Invalid theme colour — expected a hex value like #FE5100." });
      }
      const FREE_PALETTE = ["#F8F7F2", "#6B7280", "#FE5100"];
      // Host+ (creator) — 8 curated colours (keep in sync with
      // client/src/utils/themeUtils.js CREATOR_COLORS).
      const CREATOR_PALETTE = [
        "#FE5100", "#2563EB", "#4F46E5", "#7C3AED",
        "#EC4899", "#DC2626", "#10B981", "#15803D",
      ];
      const { data: planRow } = await supabaseAdmin
        .from("profiles").select("plan").eq("id", req.user.id).single();
      const plan = planRow?.plan || "explorer";
      const hex = theme_color.toUpperCase();
      // Studio (professional) and Supreme get any hex; creator is gated to the
      // 8-colour palette; everyone else to the free palette.
      const unlimited = plan === "professional" || plan === "supreme";
      const allowed =
        unlimited ||
        (plan === "creator" && CREATOR_PALETTE.includes(hex)) ||
        (plan !== "creator" && FREE_PALETTE.includes(hex));
      if (!allowed) {
        return res.status(403).json({ message: "This colour is not available on your plan. Upgrade to unlock more colours." });
      }
      updates.theme_color = hex;
    }

    if (background_key !== undefined) updates.background_key = cleanBackgroundKey(background_key);

    if (reschedule_fee !== undefined) {
      const rf = Number(reschedule_fee);
      if (rf !== 0 && rf !== 10) return res.status(400).json({ message: 'reschedule_fee must be 0 or 10' });
      updates.reschedule_fee = rf;
    }

    // Host-facing search/Explore visibility (v3.19 column, previously admin-only).
    // A host may hide THEIR OWN profile — e.g. a Chartered Accountant bound by ICAI
    // solicitation rules. false → drops out of Explore, sitemap and prerendered HTML
    // (noindex), all already keyed on is_indexable. Direct link still works. The
    // admin SEO route is unchanged — this only lets a host set their own flag.
    if (is_indexable !== undefined) updates.is_indexable = !!is_indexable;

    // A change to any field the OG share card renders marks it stale; the next
    // generateHostOgImages sweep regenerates. Safe to set on a 'none' row too:
    // the generator gates on card-ready and skips non-ready rows, and og_hash
    // resets an unchanged row back to 'ready' without re-rendering.
    // ponytail: doesn't diff old vs new value — a same-value save marks dirty,
    // but og_hash makes that a cheap no-op regen, not a wasted render.
    const OG_CARD_FIELDS = ['name', 'profile_image', 'profession', 'bio', 'username'];
    if (OG_CARD_FIELDS.some((f) => f in updates)) updates.og_status = 'dirty';

    let result = await supabaseAdmin
      .from("profiles")
      .update(updates)
      .eq("id", req.user.id)
      .select()
      .single();

    // Graceful fallback: drop columns the DB doesn't have yet (pre-migration) and
    // retry. Covers theme_color (v-old) and og_status (v3.88) — keep both here
    // until the migration is confirmed applied everywhere.
    if (result.error && /Could not find the '(theme_color|og_status)' column/i.test(result.error.message)) {
      const { theme_color: _tc, og_status: _og, ...safeUpdates } = updates;
      result = await supabaseAdmin
        .from("profiles")
        .update(safeUpdates)
        .eq("id", req.user.id)
        .select()
        .single();
    }

    if (result.error) return safeError(res, result.error);

    // Record an auto-assigned initial username in history (no-op if already present).
    if (initialUsername) {
      await usernameService.recordInitialUsername(req.user.id, initialUsername);
    }

    // Best-effort: delete the previous image file(s) now that the row points at
    // the new value. Runs only when the field was actually part of this update
    // and only for our own bucket objects (never Google avatars). Non-fatal.
    if ('profile_image' in updates) {
      await cleanupReplacedImage(existingProfile?.profile_image, updates.profile_image);
    }
    if ('cover_image' in updates) {
      await cleanupReplacedImage(existingProfile?.cover_image, updates.cover_image);
    }

    res.json(result.data);
  } catch (error) {
    safeError(res, error);
  }
};

// GET /api/host/categories — current host's primary + categories
const getMyCategories = async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('primary_category, categories')
      .eq('id', req.user.id)
      .single();
    if (error) throw error;
    res.json({
      primary_category: data?.primary_category || null,
      categories: Array.isArray(data?.categories) ? data.categories : [],
    });
  } catch (error) {
    safeError(res, error);
  }
};

// PUT /api/host/categories — plan-capped update; body { primary_category, categories }
const updateCategories = async (req, res) => {
  try {
    const plan = req.vendorPlan || planService.FREE_PLAN;
    const max = await planService.getLimit(plan, 'categories'); // 0=locked, N, -1=unlimited
    // -1 means UNLIMITED, not locked. The old `max <= 0` test swallowed it, so
    // the moment a plan's category cap went unlimited (v3.165 made that the free
    // default) every category change 403'd. Only 0 / missing means locked;
    // validateCategorySelection below already special-cases -1 for the count.
    if (!max) {
      return res.status(403).json({
        message: 'Your plan does not allow changing your category. Contact admin to make a change.',
        upgrade_required: true,
        current_plan: plan,
      });
    }

    const { data: activeRows, error: actErr } = await supabaseAdmin
      .from('categories').select('slug').eq('status', 'active');
    if (actErr) throw actErr;
    const activeSlugs = (activeRows || []).map((r) => r.slug);

    const result = validateCategorySelection({
      primary_category: req.body.primary_category,
      categories: req.body.categories,
      activeSlugs,
      max,
    });
    if (!result.ok) return res.status(result.status).json({ message: result.message });

    // Prior profession — a change invalidates every categorised service (their
    // category slugs belong to the OLD profession's list).
    const { data: before } = await supabaseAdmin
      .from('profiles').select('primary_category').eq('id', req.user.id).single();

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update({
        primary_category: result.primary_category,
        categories: result.categories,
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.user.id)
      .select('primary_category, categories')
      .single();
    if (error) throw error;

    let services_cleared = 0;
    if ((before?.primary_category || null) !== (data.primary_category || null)) {
      services_cleared = await clearHostServiceCategories(supabaseAdmin, req.user.id);
      if (services_cleared > 0) bustPublicReadCaches(); // public service pages embed category_label
    }
    res.json({ ...data, services_cleared });
  } catch (error) {
    safeError(res, error);
  }
};

// POST /api/host/services
const createService = async (req, res) => {
  try {
    // Service must use one of the active service categories for the host's profession.
    const chk = await resolveAndValidateCategory(supabaseAdmin, req.user.id, req.body.category, { required: true });
    if (!chk.ok) return res.status(chk.status).json({ message: chk.message });

    // Whitelist fields explicitly -- avoids Supabase schema-cache errors (e.g. thumbnail_url)
    const {
      title,
      description,
      type,
      meeting_mode,
      duration,
      price,
      currency,
      thumbnail_url,
      grace_period_minutes,
    } = req.body;
    const payload = {
      host_id: req.user.id,
      title,
      description: description || "",
      type: type || "one_on_one",
      meeting_mode: meeting_mode || "online",
      duration: clampDuration(duration),
      price: clampPrice(price),
      currency: currency || "INR",
      grace_period_minutes: grace_period_minutes !== undefined ? clampGrace(grace_period_minutes) : 10,
      category: chk.value,
      primary_category: chk.primary,
    };
    if (thumbnail_url !== undefined) payload.thumbnail_url = thumbnail_url;
    // Interim fee-only mode (no Route yet): no paid listings — force ₹0
    // (paid-enabled pilot host exempt).
    const { feeOnlyForHost } = require('../services/paidMode');
    if (await feeOnlyForHost(req.user.id)) payload.price = 0;

    // Free-service sub-cap: a new active price-0 service must fit the plan's
    // free_services limit (Starter 2; paid tiers unlimited). New host services
    // are created active, so this gates the listing immediately.
    if (Number(payload.price ?? 0) === 0) {
      const gate = await canAddFreeService(req.user.id);
      if (!gate.ok) return res.status(gate.status).json({ message: gate.message, upgrade_required: true });
    }

    const { data, error } = await insertServiceSafe(payload);

    if (error) return safeError(res, error);
    bustSitemapCache();
    bustPublicReadCaches();
    res.status(201).json(data);
  } catch (error) {
    safeError(res, error);
  }
};

// PUT /api/host/services/:id
const updateService = async (req, res) => {
  try {
    const {
      title,
      description,
      type,
      meeting_mode,
      duration,
      price,
      currency,
      is_active,
      thumbnail_url,
      grace_period_minutes,
    } = req.body;
    // P1-1: this endpoint can flip is_active and/or price. Gate against the
    // plan's caps. Fetch current state once so we can reason about the RESULTING
    // (is_active, price) — needed for both the total-service cap and the
    // free-service sub-cap.
    if (is_active === true || price !== undefined) {
      const { data: current } = await supabaseAdmin
        .from('services').select('is_active, price').eq('id', req.params.id).eq('host_id', req.user.id).single();
      if (current) {
        const finalActive = is_active !== undefined ? is_active === true : current.is_active;
        const finalPrice  = price !== undefined ? clampPrice(price) : Number(current.price ?? 0);
        const wasFreeActive = current.is_active && Number(current.price ?? 0) === 0;

        // Total active-service cap on a real false→true transition.
        if (is_active === true && current.is_active === false) {
          const gate = await canActivateMore(req.user.id, 'services');
          if (!gate.ok) return res.status(gate.status).json({ message: gate.message, upgrade_required: true });
        }
        // Free sub-cap only when the edit newly enters the active+free set.
        if (finalActive && finalPrice === 0 && !wasFreeActive) {
          const freeGate = await canAddFreeService(req.user.id, { excludeId: req.params.id });
          if (!freeGate.ok) return res.status(freeGate.status).json({ message: freeGate.message, upgrade_required: true });
        }
      }
    }

    const updates = { updated_at: new Date().toISOString() };
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (type !== undefined) updates.type = type;
    if (meeting_mode !== undefined) updates.meeting_mode = meeting_mode;
    if (duration !== undefined) updates.duration = clampDuration(duration);
    if (price !== undefined) updates.price = clampPrice(price);
    // Interim fee-only mode: no paid listings — force ₹0 on every update
    // (paid-enabled pilot host exempt).
    const { feeOnlyForHost } = require('../services/paidMode');
    if (await feeOnlyForHost(req.user.id)) updates.price = 0;
    if (currency !== undefined) updates.currency = currency;
    if (is_active !== undefined) updates.is_active = is_active;
    if (thumbnail_url !== undefined) updates.thumbnail_url = thumbnail_url;
    if (grace_period_minutes !== undefined)
      updates.grace_period_minutes = clampGrace(grace_period_minutes);

    if (req.body.category !== undefined) {
      const chk = await resolveAndValidateCategory(supabaseAdmin, req.user.id, req.body.category, { required: false });
      if (!chk.ok) return res.status(chk.status).json({ message: chk.message });
      updates.category = chk.value;
      updates.primary_category = chk.primary;
    }

    // OG card (v3.154): title/price are the service-card's own fields — an edit to
    // either stales it, so mark dirty for the next generator sweep. Schema-safe:
    // updateServiceSafe drops og_status on a pre-migration schema.
    if (title !== undefined || price !== undefined) updates.og_status = 'dirty';

    const { data, error } = await updateServiceSafe(
      req.params.id,
      updates,
      req.user.id,
    );

    if (error) return safeError(res, error);
    bustSitemapCache();
    bustPublicReadCaches();
    res.json(data);
  } catch (error) {
    safeError(res, error);
  }
};

// DELETE /api/host/services/:id
const deleteService = async (req, res) => {
  try {
    const { error } = await supabaseAdmin
      .from("services")
      .delete()
      .eq("id", req.params.id)
      .eq("host_id", req.user.id);

    if (error) {
      // P2-16: services→bookings is ON DELETE RESTRICT — a service with bookings
      // can't be hard-deleted (would erase paid/completed history). Deactivate it
      // instead so it drops off the public profile while records survive.
      if (error.code === "23503" || /foreign key/i.test(error.message || "")) {
        const { error: deErr } = await supabaseAdmin
          .from("services")
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq("id", req.params.id).eq("host_id", req.user.id);
        if (deErr) return safeError(res, deErr);
        bustSitemapCache();
        bustPublicReadCaches();
        return res.json({ deactivated: true, message: "This service has existing bookings, so it was hidden instead of deleted (booking history is preserved)." });
      }
      return safeError(res, error);
    }
    bustSitemapCache();
    bustPublicReadCaches();
    res.json({ message: "Service deleted" });
  } catch (error) {
    safeError(res, error);
  }
};

// GET /api/host/services
const getMyServices = async (req, res) => {
  try {
    let result = await supabaseAdmin
      .from("services")
      .select("*")
      .eq("host_id", req.user.id)
      .order("created_at", { ascending: false });

    // Fallback if schema cache is stale
    if (result.error && /Could not find the|column.*does not exist/i.test(result.error.message)) {
      result = await supabaseAdmin
        .from("services")
        .select("id, host_id, title, description, type, duration, price, currency, meeting_mode, is_active, created_at, updated_at")
        .eq("host_id", req.user.id)
        .order("created_at", { ascending: false });
    }
    const { data, error } = result;

    if (error) return safeError(res, error);
    res.json(data);
  } catch (error) {
    safeError(res, error);
  }
};

// PUT /api/host/availability
const setAvailability = async (req, res) => {
  try {
    const { weekly_schedule, blocked_dates, timezone, buffer_minutes } =
      req.body;

    // P1-10: reject malformed/contradictory schedules before they silently
    // produce an empty calendar (host appears open, guests see no slots).
    const scheduleError = validateWeeklySchedule(weekly_schedule);
    if (scheduleError) return res.status(400).json({ message: scheduleError });
    if (blocked_dates != null && !Array.isArray(blocked_dates))
      return res.status(400).json({ message: 'blocked_dates must be a list of dates.' });
    if (buffer_minutes != null && (!Number.isFinite(Number(buffer_minutes)) || Number(buffer_minutes) < 0 || Number(buffer_minutes) > 480))
      return res.status(400).json({ message: 'buffer_minutes must be between 0 and 480.' });

    // Upsert -- insert if not exists, update if exists
    const { data, error } = await supabaseAdmin
      .from("availability")
      .upsert(
        {
          host_id: req.user.id,
          weekly_schedule,
          blocked_dates,
          timezone,
          buffer_minutes: buffer_minutes ?? 0, // Task 13
          updated_at: new Date().toISOString(),
        },
        { onConflict: "host_id" },
      )
      .select()
      .single();

    if (error) return safeError(res, error);
    res.json(data);
  } catch (error) {
    safeError(res, error);
  }
};

// GET /api/host/:username/:slug -- single service by slug
const getServiceBySlug = async (req, res) => {
  try {
    const { data: host } = await supabaseAdmin
      .from("profiles")
      .select(
        "id, name, username, tagline, profession, profile_image, cover_image, bio, location, social_links, badges, google_calendar_connected, theme_color, plan",
      )
      .eq("username", req.params.username)
      .eq("role", "host")
      .single();

    if (!host) return res.status(404).json({ message: "Host not found" });

    const { data: service } = await supabaseAdmin
      .from("services")
      .select("*")
      .eq("host_id", host.id)
      .eq("slug", req.params.slug)
      .eq("is_active", true)
      .single();

    if (!service) return res.status(404).json({ message: "Service not found" });

    const { data: availability } = await supabaseAdmin
      .from("availability")
      .select("*")
      .eq("host_id", host.id)
      .single();

    // Customer-facing booking charge = flat platform fee + GST (admin-editable).
    // Single source of truth so the booking summary matches what Razorpay charges.
    let bookingFee = 0, platformFee = 0, gstRate = 0;
    try {
      ({ platformFee, gstRate } = await getPlatformConfig());
      bookingFee = Math.round(platformFee * (1 + gstRate) * 100) / 100;
    } catch (_) { bookingFee = 0; }

    // P3-7: return feeOnly so the booking page's step list matches reality (the
    // client otherwise defaults it true, showing a "Pay" step for a free booking).
    let feeOnly = true;
    try { feeOnly = await require("../services/paidMode").feeOnlyForHost(host.id); } catch (_) { feeOnly = true; }

    res.json({ host, service, availability, bookingFee, platformFee, gstRate, feeOnly });
  } catch (error) {
    safeError(res, error);
  }
};

// GET /api/host/search?q= -- Task 11: search vendors and services
const duplicateSearchVendors = async (req, res) => {
  try {
    const { q = "" } = req.query;
    if (!q.trim()) return res.json({ vendors: [], services: [] });

    const safe = sanitizeLikeTerm(q);
    if (!safe) return res.json({ vendors: [], services: [] });
    const term = `%${safe}%`;

    // Search vendor profiles
    const { data: vendors } = await supabaseAdmin
      .from("profiles")
      .select(
        "id, name, username, profession, tagline, bio, profile_image, is_verified",
      )
      .eq("role", "host")
      .or(
        `name.ilike.${term},profession.ilike.${term},tagline.ilike.${term},bio.ilike.${term}`,
      )
      .limit(10);

    // Search services
    const { data: services } = await supabaseAdmin
      .from("services")
      .select(
        "id, title, description, price, duration, slug, thumbnail_url, profiles!services_host_id_fkey(name, username, profile_image)",
      )
      .eq("is_active", true)
      .or(`title.ilike.${term},description.ilike.${term}`)
      .limit(10);

    res.json({ vendors: vendors || [], services: services || [] });
  } catch (error) {
    safeError(res, error);
  }
};

// GET /api/host/availability -- Task: return existing availability for dashboard
const getAvailability = async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("availability")
      .select("*")
      .eq("host_id", req.user.id)
      .single();
    if (error && error.code !== "PGRST116")
      return safeError(res, error);
    res.json(data || null);
  } catch (error) {
    safeError(res, error);
  }
};

// Duplicate legacy block below is kept inert by using distinct names.

// GET /api/host/search?q= -- Task 11
const searchVendors = async (req, res) => {
  try {
    const { q = "" } = req.query;
    if (!q.trim()) return res.json({ vendors: [], services: [] });
    const safe = sanitizeLikeTerm(q);
    if (!safe) return res.json({ vendors: [], services: [] });
    const term = `%${safe}%`;

    const { data: vendors } = await supabaseAdmin
      .from("profiles")
      .select(
        "id, name, username, profession, tagline, bio, profile_image, is_verified",
      )
      .eq("role", "host")
      .or(
        `name.ilike.${term},profession.ilike.${term},tagline.ilike.${term},bio.ilike.${term}`,
      )
      .limit(10);

    const { data: services } = await supabaseAdmin
      .from("services")
      .select(
        "id, title, description, price, duration, slug, thumbnail_url, profiles!services_host_id_fkey(name, username, profile_image)",
      )
      .eq("is_active", true)
      .or(`title.ilike.${term},description.ilike.${term}`)
      .limit(10);

    res.json({ vendors: vendors || [], services: services || [] });
  } catch (error) {
    safeError(res, error);
  }
};

module.exports = {
  getHostProfile,
  updateProfile,
  getMyCategories,
  updateCategories,
  createService,
  updateService,
  deleteService,
  getMyServices,
  setAvailability,
  getAvailability,
  getServiceBySlug,
  searchVendors,
  validateWeeklySchedule, // exported for unit testing (P1-10)
  cleanBackgroundKey, // exported for unit testing
  cleanImageUrl, // exported for unit testing (audit H1)
  imagesBucketPath, // exported for unit testing (audit M1)
  buildHostProfile, // used by prerenderController for bot-traffic meta shells
};

/**
 * Centralized security middleware for BookASloth API
 * Covers: Helmet, CSP, HSTS, rate limiting, XSS, HPP, request hardening
 */
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
const hpp = require('hpp');
const { isLoadTestMode } = require('../config/loadTestMode');
const { isOpenAccess } = require('../config/openAccessWindow');
const { makeRateLimitStore } = require('./rateLimitStore');
const { getClientIp } = require('../lib/clientIp');
const ipBlocklist = require('../lib/ipBlocklist');
const { isExempt: isIpGuardExempt, isPublicHostRead } = require('./ipGuard');

// Shared IP-keyed generator: every per-IP limiter below must resolve through
// getClientIp() (which honours CLIENT_IP_HEADER behind an edge proxy), not
// express-rate-limit's own default (plain req.ip). Before this, only adminLimiter
// and botLimiter did — every other limiter silently ignored CLIENT_IP_HEADER, so
// setting it on Render (the documented Cloudflare-edge fix, see
// docs/cloudflare-edge-setup.md Step 9.3) would NOT have protected them from the
// shared-edge-IP problem it exists to solve.
const ipKeyGenerator = (req) => getClientIp(req) || req.ip;

// The global apiLimiter's own cap must never 429 a legitimate crawler re-fetching
// public, unauthenticated, read-only SEO content (blog/sitemap/host/service
// detail) — same reasoning as the ipGuard exemptions for these paths. Only GET
// requests to these specific routes are skipped; every other endpoint (including
// the OTHER routes under /api/host/*) keeps the 100/min cap.
const isPublicSeoGet = (req) => req.method === 'GET' && (isIpGuardExempt(req) || isPublicHostRead(req));

// Load-test bypass: a single JMeter IP would trip every per-IP limiter
// instantly. Off by default (isLoadTestMode() is false) → every limiter
// behaves exactly as before. Never true in production (fail-safe).
const skipWhenLoadTest = () => isLoadTestMode();

// Master limiter bypass: skip during load test OR while the temporary open-access
// window (OPEN_ACCESS_UNTIL) is active. Every limiter's `skip` points here, so one
// env var lifts all per-IP / per-contact caps for a launch/event, then auto
// re-gates. Read live per request so the env can be flipped without a restart.
const skipWhenOpen = () => isLoadTestMode() || isOpenAccess();

// ── Helmet — security headers ─────────────────────────────────
const helmetMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'", "https://checkout.razorpay.com"],
      styleSrc:   ["'self'", "'unsafe-inline'"],
      imgSrc:     ["'self'", "data:", "https:", "blob:"],
      connectSrc: ["'self'", "https://api.razorpay.com", "https://*.supabase.co"],
      frameSrc:   ["'self'", "https://api.razorpay.com"],
      objectSrc:  ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  hsts: {
    maxAge: 31536000,          // 1 year
    includeSubDomains: true,
    preload: true,
  },
  frameguard:          { action: 'deny' },
  noSniff:             true,
  xssFilter:           true,
  referrerPolicy:      { policy: 'strict-origin-when-cross-origin' },
  permittedCrossDomainPolicies: false,
});

// ── Rate limiters ─────────────────────────────────────────────

// Auth endpoints: strict — 10 requests per 15 minutes per IP
const authLimiter = rateLimit({
  store: makeRateLimitStore('auth'),
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: ipKeyGenerator,
  message: { message: 'Too many auth attempts. Please try again in 15 minutes.' },
  skipSuccessfulRequests: false,
  skip: skipWhenOpen,
});

// OTP endpoints: very strict — 5 sends per hour per IP
const otpLimiter = rateLimit({
  store: makeRateLimitStore('otp'),
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: ipKeyGenerator,
  message: { message: 'Too many OTP requests. Please wait before requesting another.' },
  skip: skipWhenOpen,
});

// General API: 100 requests per minute per IP
const apiLimiter = rateLimit({
  store: makeRateLimitStore('api'),
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: ipKeyGenerator,
  message: { message: 'Too many requests. Please slow down.' },
  skip: (req) => skipWhenOpen() || isPublicSeoGet(req),
});

// Admin data endpoints: a DoS/enumeration backstop, NOT a throttle on the working
// admin. The old cap (30/min, keyed on raw req.ip) tripped during normal console
// use: one page mount fires ~5 admin reads and every tab/paginate/drawer fires more,
// so an active admin blew 30/min in seconds → a spurious "Couldn't load leads" (the
// client can't retry the resulting 429). Worse, raw req.ip lumped every admin behind
// a shared edge IP (Cloudflare) into ONE bucket. Fix: key per authenticated admin
// (own lane, never shared) and lift the ceiling so only a runaway script hits it.
// The sensitive credential paths (/api/admin-auth login, 2fa, password) carry their
// own strict authLimiter, so brute-force defense is unchanged by the higher cap here.
// Per-admin rate-limit key from the verified bearer token → each admin gets their own
// bucket (never shared with other staff or a shared edge IP). Unauthenticated/invalid
// requests fall back to the resolved client IP (honours CLIENT_IP_HEADER). Lazy-require
// the verifier to avoid any middleware↔service load-order cycle.
const adminRateKey = (req) => {
  const h = req.headers.authorization;
  if (h && h.startsWith('Bearer ')) {
    try {
      const p = require('../services/adminAuthService').jwtVerify(h.slice(7));
      if (p && p.type === 'admin' && p.sub) return `admin:${p.sub}`;
    } catch (_) { /* not a valid admin token — fall through to IP */ }
  }
  return `ip:${getClientIp(req) || req.ip}`;
};

const adminLimiter = rateLimit({
  store: makeRateLimitStore('admin'),
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: adminRateKey,
  message: { message: 'Too many admin requests.' },
  skip: skipWhenOpen,
});

// Payment endpoints: 20 per hour per IP (prevent order flooding)
const paymentLimiter = rateLimit({
  store: makeRateLimitStore('payment'),
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: ipKeyGenerator,
  message: { message: 'Too many payment requests. Please try again later.' },
  skip: skipWhenOpen,
});

// Username/slug availability check — prevent vendor-username enumeration.
const slugLimiter = rateLimit({
  store: makeRateLimitStore('slug'),
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: ipKeyGenerator,
  message: { message: 'Too many requests. Please slow down.' },
  skip: skipWhenOpen,
});

// Public availability lookup — each call can hit the Google Calendar FreeBusy
// API, so cap it tighter than the global limiter to protect the API quota.
const slotsLimiter = rateLimit({
  store: makeRateLimitStore('slots'),
  windowMs: 5 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: ipKeyGenerator,
  message: { message: 'Too many availability checks. Please wait a moment.' },
  skip: skipWhenOpen,
});

// Explore / discovery search — public, unauthenticated, and the search box invites
// a high rate of DISTINCT queries (each cache miss = a live profiles⋈services read
// + count). Cap tighter than the global apiLimiter (100/min) so query spam can't
// hammer the DB. Stacks on top of apiLimiter, which is mounted on all of /api.
const searchLimiter = rateLimit({
  store: makeRateLimitStore('search'),
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: ipKeyGenerator,
  message: { message: 'Too many searches. Please slow down.' },
  // Fail-soft: over the limit, serve last-good cache (or a soft-empty 200) instead
  // of a hard 429 — the cap still blocks the live DB query, but a shared-IP user
  // never sees an error. Lazy-require avoids a controller↔security import cycle.
  handler: (req, res) => require('../controllers/exploreController').serveStaleOrEmpty(req, res),
  skip: skipWhenOpen,
});

// Booking creation — public + fires email/WhatsApp notifications; cap per IP.
const bookingLimiter = rateLimit({
  store: makeRateLimitStore('booking'),
  windowMs: 60 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: ipKeyGenerator,
  message: { message: 'Too many booking attempts. Please try again later.' },
  skip: skipWhenOpen,
});

// Companion to bookingLimiter, keyed by the guest CONTACT (email, else phone).
// The IP-keyed limiter alone is bypassed by rotating source IPs → unlimited
// bookings/notifications for one contact (security audit M-6). Caps per contact
// regardless of IP. Stack BOTH on the route.
const bookingContactLimiter = rateLimit({
  store: makeRateLimitStore('booking_contact'),
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const email = String(req.body?.guest_email || '').toLowerCase().trim();
    if (email) return `e:${email}`;
    const phone = String(req.body?.guest_phone || '').replace(/[\s\-().]/g, '');
    return phone ? `p:${phone}` : ipKeyGenerator(req);
  },
  message: { message: 'Too many bookings for this contact. Please try again later.' },
  skip: skipWhenOpen,
});

// Companion to otpLimiter, keyed by the target CONTACT (email, else phone), not
// the IP (audit P2-2). otpLimiter alone (per-IP) is bypassed by rotating source
// IPs → an attacker can spray OTP sends at one victim's email/phone (SMS/email
// bombing) or brute-force verify across IPs. This caps per contact regardless of
// IP. Stack BOTH on /send-otp, /verify-otp, /verify-otp-login.
const otpContactLimiter = rateLimit({
  store: makeRateLimitStore('otp_contact'),
  windowMs: 60 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const email = String(req.body?.email || '').toLowerCase().trim();
    if (email) return `e:${email}`;
    const phone = String(req.body?.phone || req.body?.identifier || '').replace(/[\s\-().]/g, '');
    return phone ? `p:${phone}` : ipKeyGenerator(req);
  },
  message: { message: 'Too many code requests for this contact. Please wait before trying again.' },
  skip: skipWhenOpen,
});

// Free digital-product download — keyed by EMAIL (falling back to IP) so an
// attacker can't spam purchase rows / a victim's address by rotating IPs.
const freeDownloadLimiter = rateLimit({
  store: makeRateLimitStore('freedl_email'),
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const email = String(req.body?.buyer_email || '').toLowerCase().trim();
    return email || ipKeyGenerator(req);
  },
  message: { message: 'Too many download requests for this email. Please try again later.' },
  skip: skipWhenOpen,
});

// Companion to freeDownloadLimiter, keyed by IP. The email-keyed limiter alone
// is bypassed by rotating buyer_email per request (each unique email = a fresh
// bucket) → unlimited purchase-row spam from one IP. This caps total free-download
// requests per IP regardless of how many distinct emails are used. Stack BOTH.
const freeDownloadIpLimiter = rateLimit({
  store: makeRateLimitStore('freedl_ip'),
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: ipKeyGenerator,
  message: { message: 'Too many download requests. Please try again later.' },
  skip: skipWhenOpen,
});

// Signed product-download links (GET /products/download/:token). The token is a
// 122-bit UUID so it isn't brute-forceable, but the route is unauthenticated and
// each hit mints a fresh short-lived signed file URL. Cap per IP so a leaked
// token (forwarded email, proxy log, referrer) can't be used to hammer the
// storage-URL endpoint, and so token-guessing floods are throttled regardless.
const downloadTokenLimiter = rateLimit({
  store: makeRateLimitStore('download_token'),
  windowMs: 60 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: ipKeyGenerator,
  message: { message: 'Too many download requests. Please try again later.' },
  skip: skipWhenOpen,
});

// Newsletter signup — public write keyed by EMAIL (falling back to IP) so an
// attacker can't repeatedly subscribe a victim's address from rotating IPs.
const newsletterEmailLimiter = rateLimit({
  store: makeRateLimitStore('newsletter_email'),
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const email = String(req.body?.email || '').toLowerCase().trim();
    return email || ipKeyGenerator(req);
  },
  message: { message: 'Too many signups for this email. Please try again later.' },
  skip: skipWhenOpen,
});

// Companion to newsletterEmailLimiter, keyed by IP. The email-keyed limiter alone
// is bypassed by rotating the email per request (each unique email = a fresh
// bucket) → unlimited contact-row spam from one IP. Caps total signups per IP
// regardless of distinct emails used. Stack BOTH on the route.
const newsletterIpLimiter = rateLimit({
  store: makeRateLimitStore('newsletter_ip'),
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: ipKeyGenerator,
  message: { message: 'Too many signups. Please try again later.' },
  skip: skipWhenOpen,
});

// Support bot — every /bot/ask hits the Anthropic API (real cost), so cap it
// per IP well under the global apiLimiter. Public + unauthenticated, so IP is the
// only key we have. Feedback shares the same router but is cheap; this bound is
// sized for the ask path.
const botLimiter = rateLimit({
  store: makeRateLimitStore('bot'),
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  // Key on the resolved client IP (honours CLIENT_IP_HEADER behind an edge proxy),
  // matching the bot abuse/IP-block path so both see the same address.
  keyGenerator: ipKeyGenerator,
  message: { message: 'You’re sending messages too quickly. Please wait a moment and try again.' },
  skip: skipWhenOpen,
});

// Global request cap for the bot — a SINGLE bucket across ALL IPs (constant key),
// so rotating IPs can't bypass it the way they bypass the per-IP botLimiter. This
// bounds total request volume (DB/CPU/embedding load); the model-call budget
// (lib/botBudget.js) is the tighter control on the expensive path. `max` is a
// function so BOT_GLOBAL_MAX_PER_MIN retunes at runtime without a redeploy.
const botGlobalLimiter = rateLimit({
  store: makeRateLimitStore('bot-global'),
  windowMs: 60 * 1000,
  max: () => Number(process.env.BOT_GLOBAL_MAX_PER_MIN) || 300,
  keyGenerator: () => 'bot-global',
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Tithi is very busy right now. Please try again in a moment.' },
  skip: skipWhenOpen,
});

// File uploads — each call streams up to 2MB into Supabase Storage, so cap
// them tighter than the global apiLimiter to stop an authenticated account from
// burning storage/bandwidth. Keyed per ACCOUNT (req.user.id), set by `protect`
// which MUST run before this limiter, so legit hosts sharing an IP (corporate /
// carrier-grade NAT) don't collide; falls back to IP if somehow unauthenticated.
const uploadLimiter = rateLimit({
  store: makeRateLimitStore('upload'),
  windowMs: 15 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip,
  message: { message: 'Too many uploads. Please wait a few minutes and try again.' },
  skip: skipWhenOpen,
});

// Slow down abusive request floods — secondary to apiLimiter (100/min hard cap).
//
// PROVEN BUG (fixed): the old config (delayAfter:50, delayMs: hits*200, no cap)
// multiplied the delay by TOTAL hits in the 15-min window, so a normal dev/app
// session that legitimately makes 50+ calls (/auth/me fires on every mount) got
// 10–13s added to EVERY subsequent request. Measured: req #50 = 11,050ms,
// #60 = 12,971ms. Now: threshold raised well above normal usage, delay grows
// from the EXCESS over the threshold, and is hard-capped at 2s.
const speedLimiter = slowDown({
  store: makeRateLimitStore('speed'),
  windowMs: 15 * 60 * 1000,
  delayAfter: 300,                          // normal sessions never reach this
  delayMs: (used) => (used - 300) * 100,    // gentle ramp only past the threshold
  maxDelayMs: 2000,                         // never add more than 2s, ever
  validate: { delayMs: false },             // silence express-slow-down v2 notice
  keyGenerator: ipKeyGenerator,
  skip: skipWhenOpen,
});

// Permissions-Policy — deny powerful features the app never uses.
const permissionsPolicy = (req, res, next) => {
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), browsing-topics=()');
  next();
};

// ── Request hardening ─────────────────────────────────────────

// Prevent HTTP Parameter Pollution
const hppMiddleware = hpp({
  whitelist: ['tags', 'sort', 'filter'], // arrays allowed for these keys
});

// Strip dangerous characters from request body strings.
//
// NOTE: deepSanitize / blockSuspiciousRequests below are defense-in-depth
// regex blocklists ONLY. They are a coarse safety net, not the primary XSS /
// SQLi control — never rely on them as such. Real protection comes from
// parameterized queries (Supabase/PostgREST), output encoding, and explicit
// per-field validation. Do not expand these patterns.
const sanitizeBody = (req, res, next) => {
  if (req.body && typeof req.body === 'object') {
    req.body = deepSanitize(req.body);
  }
  next();
};

const deepSanitize = (obj) => {
  // Raw webhook bodies (express.raw → Buffer, e.g. Razorpay) MUST survive
  // intact: the handler verifies the HMAC over the exact bytes. Object.entries
  // on a Buffer would shred it into a plain {0:..,1:..} object and break
  // signature verification, so return Buffers untouched.
  if (Buffer.isBuffer(obj)) return obj;
  if (typeof obj === 'string') {
    // Remove script tags and null bytes
    return obj
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/\0/g, '')
      .trim();
  }
  if (Array.isArray(obj)) return obj.map(deepSanitize);
  if (obj && typeof obj === 'object') {
    const clean = {};
    for (const [k, v] of Object.entries(obj)) {
      clean[k] = deepSanitize(v);
    }
    return clean;
  }
  return obj;
};

// Block requests with suspicious patterns
const blockSuspiciousRequests = (req, res, next) => {
  // Path traversal only matters where a path is resolved: the URL + query.
  // It is NOT scanned in the JSON body and needs a real traversal shape
  // (`../`, `..\`, `%2e%2e%2f`) — a bare `..` matched ordinary text like
  // "see you.." / "..." and, since a hit is an instant 24h IP ban, locked the
  // founder out mid CSV import (2026-10-05).
  const traversal = /((\.|%2e){2}(\/|\\|%2f|%5c)|\/etc\/passwd|\/proc\/)/i;
  const suspicious = [
    /(union\s+select|drop\s+table|insert\s+into)/i, // SQL injection hints
    /(<script|javascript:|vbscript:|data:text\/html)/i, // XSS
  ];
  // A raw webhook body is a Buffer (express.raw); JSON.stringify would mangle
  // it and it isn't a JSON payload to scan anyway — skip the body in that case.
  const bodyStr = Buffer.isBuffer(req.body) ? '' : JSON.stringify(req.body);
  const urlStr = req.url + JSON.stringify(req.query);
  const payload = bodyStr + urlStr;
  if (traversal.test(urlStr) || suspicious.some(p => p.test(payload))) {
    // Unambiguous attack signature (SQLi/XSS/path-traversal) → auto-ban the source
    // IP immediately (no repeat threshold). Fire-and-forget; never block the 400.
    ipBlocklist.recordAttack(getClientIp(req), 'pattern').catch(() => {});
    return res.status(400).json({ message: 'Invalid request.' });
  }
  next();
};

module.exports = {
  helmetMiddleware,
  skipWhenLoadTest,
  skipWhenOpen,
  ipKeyGenerator,
  isPublicSeoGet,
  authLimiter,
  otpLimiter,
  apiLimiter,
  adminLimiter,
  adminRateKey,
  paymentLimiter,
  bookingLimiter,
  bookingContactLimiter,
  otpContactLimiter,
  slugLimiter,
  slotsLimiter,
  searchLimiter,
  uploadLimiter,
  freeDownloadLimiter,
  freeDownloadIpLimiter,
  downloadTokenLimiter,
  newsletterEmailLimiter,
  newsletterIpLimiter,
  botLimiter,
  botGlobalLimiter,
  speedLimiter,
  hppMiddleware,
  sanitizeBody,
  blockSuspiciousRequests,
  permissionsPolicy,
};

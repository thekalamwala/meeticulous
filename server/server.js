const express = require('express');
const cors = require('cors');
const compression = require('compression');
const dotenv = require('dotenv');

dotenv.config();

// Fail fast on an incomplete environment (prod), or warn loudly (dev/test),
// instead of 500-ing later at request time deep inside a controller.
require('./config/validateEnv').validateEnv();

// Error tracking. No-op unless SENTRY_DSN is set, so local/CI are unaffected.
const { initSentry, captureException, flushSentry } = require('./utils/sentry');
const sentryStatus = initSentry();
if (sentryStatus.enabled) console.log('Sentry error tracking enabled');

const app = express();

// Behind a reverse proxy (Render/Heroku/Nginx) the client IP is in
// X-Forwarded-For. Trust the first proxy hop so express-rate-limit and the
// security middleware key on the real client IP instead of the proxy's (which
// would otherwise lump all users into one bucket or be spoofable). Adjust the
// hop count if more proxies sit in front.
app.set('trust proxy', 1);

// CORS: in production lock to the canonical CLIENT_URL plus its www/apex
// sibling and any CLIENT_URLS extras (see config/corsOrigins). In dev, also
// accept any localhost port so Vite drifting (5173 → 5174 → 5175 when ports are
// busy) doesn't break the API with origin-mismatch failures that surface as
// "Could not start..." toasts.
const isProd = process.env.NODE_ENV === 'production';
const { buildAllowedOrigins, stripSlash } = require('./config/corsOrigins');
const allowedOrigins = buildAllowedOrigins(process.env);
const corsWarned = new Set(); // warn once per blocked origin, not per request
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // same-origin / curl / server-to-server
    if (allowedOrigins.has(stripSlash(origin))) return cb(null, true);
    if (!isProd && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) return cb(null, true);
    // Clean CORS denial (omit Access-Control-Allow-Origin) rather than throwing,
    // which would 500 every blocked request and spam logs/Sentry. The browser
    // still blocks it; we just don't treat a wrong origin as a server error.
    if (!corsWarned.has(origin)) {
      corsWarned.add(origin);
      console.warn(`[cors] blocked origin: ${origin}`);
    }
    return cb(null, false);
  },
  credentials: true,
}));

// IP blocking — reject banned IPs early (after CORS so the 403 still carries CORS
// headers, before the rate limiters) and feed the general auto-ban counter on
// 429s. No-op when IP_BLOCK_ENABLED=false or under load-test mode; fails open if
// the in-memory blocklist can't load (e.g. before migration v3.51 is applied), so
// it can never take the site down. See middleware/ipGuard.js + lib/ipBlocklist.js.
const { ipGuard, offenseTracker } = require('./middleware/ipGuard');
const ipBlocklist = require('./lib/ipBlocklist');
app.use(ipGuard);
app.use(offenseTracker);

// Raw body for Razorpay webhook (must come before express.json). Explicit limit
// so a malformed/oversized webhook body is rejected early (Razorpay payloads are
// a few KB; 1mb is generous headroom).
app.use('/api/payment/webhook', express.raw({ type: 'application/json', limit: '1mb' }));
// Raw body for the Resend email webhook — Svix signature is verified over the
// exact bytes (see resendWebhookController). Must precede express.json.
app.use('/api/webhooks/resend', express.raw({ type: 'application/json', limit: '1mb' }));
// Raw body for the Meta Lead Ads webhook — X-Hub-Signature-256 is verified over
// the exact bytes (see metaLeadgenController). Must precede express.json.
app.use('/api/webhooks/meta-leadgen', express.raw({ type: 'application/json', limit: '1mb' }));

// Explicit JSON body cap (defence-in-depth vs large-body DoS). This equals the
// body-parser default but is stated so the bound is intentional and can't drift
// silently if a future route needs a larger payload.
app.use(express.json({ limit: '100kb' }));

// Gzip/deflate JSON + text responses. Only kicks in when the client sends
// Accept-Encoding and the body clears the 1KB default threshold, and it never
// double-encodes an already-compressed response — so this is safe even if a
// proxy in front (Render) also compresses. Biggest win on the large public list
// payloads (host profile, service listings). Honors a `x-no-compression` header
// for debugging raw responses.
app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  },
}));

// Always-on, O(1) HTTP metrics (request counts, slow-request count, status
// classes) surfaced at /metrics. Distinct from the opt-in PERF_LOG logger below.
app.use(require('./utils/metrics').middleware);

// ── Perf instrumentation ────────────────────────────────────────────────
// Logs real wall-clock per /api request so the actual slow endpoints behind the
// "20s+ vendor page" reports are visible. Disable with PERF_LOG=false.
if (process.env.NODE_ENV !== 'production'
  ? process.env.PERF_LOG !== 'false'
  : process.env.PERF_LOG === 'true') {
  app.use('/api', (req, res, next) => {
    const start = process.hrtime.bigint();
    res.on('finish', () => {
      const ms = Number(process.hrtime.bigint() - start) / 1e6;
      const tag = ms > 1000 ? 'SLOW' : 'ok';
      console.log(`[perf:${tag}] ${req.method} ${req.originalUrl} → ${res.statusCode} ${ms.toFixed(0)}ms`);
    });
    next();
  });
}

// BUG-03: Apply all security middleware that was defined but never used
const {
  helmetMiddleware,
  apiLimiter,
  adminLimiter,
  speedLimiter,
  hppMiddleware,
  sanitizeBody,
  blockSuspiciousRequests,
  permissionsPolicy,
} = require('./middleware/security');

app.use(helmetMiddleware);
app.use(permissionsPolicy);
app.use(hppMiddleware);
app.use(sanitizeBody);
app.use(blockSuspiciousRequests);
app.use(speedLimiter);
app.use('/api', apiLimiter);

// Maintenance mode — 503s public/vendor traffic when enabled; admin stays reachable.
const { maintenanceMiddleware } = require('./middleware/maintenanceMiddleware');
app.use('/api', maintenanceMiddleware);

app.use('/api/auth',        require('./routes/authRoutes'));
app.use('/api/admin-auth',  adminLimiter, require('./routes/adminAuthRoutes'));
app.use('/api/onboarding',  require('./routes/vendorOnboardingRoutes'));
app.use('/api/host',        require('./routes/hostRoutes'));
app.use('/api/bookings',    require('./routes/bookingRoutes'));
app.use('/api/manage-booking', require('./routes/manageBookingRoutes')); // public, token-authed guest self-service (#516)
app.use('/api/payment',     require('./routes/paymentRoutes'));
app.use('/api/invoices',   require('./routes/invoiceRoutes'));
app.use('/api/kyc',         require('./routes/kycRoutes'));
app.use('/api/admin',       adminLimiter, require('./routes/adminRoutes'));
app.use('/api/reviews',     require('./routes/reviewRoutes'));
app.use('/api/feedback',    require('./routes/feedbackRoutes'));
app.use('/api/products',    require('./routes/productRoutes'));
app.use('/api/crm',         require('./routes/crmRoutes'));
app.use('/api/upload',      require('./routes/uploadRoutes'));
app.use('/api/vendor',      require('./routes/vendorRoutes'));
app.use('/api/referrals',   require('./routes/referralRoutes'));
app.use('/api/invite',      require('./routes/inviteRoutes'));
app.use('/api/services',    require('./routes/serviceRoutes'));
app.use('/api/categories',  require('./routes/categoryRoutes'));
const { adminRouter: scAdminRouter, publicRouter: scPublicRouter } = require('./routes/serviceCategoryRoutes');
app.use('/api/admin/service-categories', adminLimiter, scAdminRouter);
app.use('/api/service-categories',       scPublicRouter);
app.use('/api/services-directory', require('./routes/servicesDirectoryRoutes'));
app.use('/api/admin/security', adminLimiter, require('./routes/adminSecurityRoutes')); // IP blocking mgmt (super-only)
app.use('/api/security', require('./routes/securityRoutes')); // Google RISC (Cross-Account Protection) receiver — SET-signed, own text parser
app.use('/api/admin/host360', adminLimiter, require('./routes/host360Routes')); // Host 360 command center (per-permission gated)
app.use('/api/admin/guest360', adminLimiter, require('./routes/guest360Routes')); // Guest 360 (read-only; demand-side mirror of Host 360)
app.use('/api/admin/crm', adminLimiter, require('./routes/adminCrmRoutes')); // Sales CRM command center (leads.* gated)
app.use('/api/explore',     require('./routes/exploreRoutes'));
app.use('/api/blogs',       require('./routes/blogRoutes'));
app.use('/api/vendors',        require('./routes/badgePublicRoutes'));
app.use('/api/feature-flags',  require('./routes/featureFlagRoutes'));
app.use('/api/notifications', require('./routes/notificationWebhookRoutes')); // public AiSensy webhook (secret-gated)
app.use('/api/webhooks',      require('./routes/webhookRoutes')); // public provider webhooks (Resend, Svix-signed)
app.use('/api/notifications', require('./routes/notificationRoutes'));         // in-app feed (bell panel, auth-gated)
app.use('/api/email',         require('./routes/emailRoutes')); // public unsubscribe (signed-token gated)
app.use('/api/contact',       require('./routes/contactRoutes')); // public contact form → support email
app.use('/api/bot',           require('./routes/botRoutes')); // public "Bolt 958" support bot (grounded on docs/)
app.use('/api/support',       require('./routes/supportRoutes')); // host/guest support chat (Bolt → human handoff)
app.use('/api/enterprise-lead', require('./routes/enterpriseLeadRoutes')); // public /enterprise page lead form → support email
app.use('/api/be-a-sloth-lead', require('./routes/beASlothLeadRoutes')); // public /be-a-sloth "Book a Demo" OTP lead form → CRM (source website)
app.use('/api/ingest', require('./routes/ingestRoutes')); // external lead intake (Meta/Zoho/form) → upsertLead, token-gated
app.use('/api/events',        require('./routes/eventsRoutes')); // public intent-event sink → lead_events
app.use('/api/opening',       require('./routes/openingRoutes')); // public "The Opening" launch event (ribbon cut + Inaugurators Wall)
app.use('/api/whatsapp',      require('./routes/whatsappRoutes'));
app.use('/api/pitch-deck',    require('./routes/pitchDeckRoutes')); // gated investor deck (passcode + WhatsApp OTP → confidential figures)
app.use('/api/username',      require('./routes/usernameRoutes')); // public resolve (edge 301) + auth check
app.get('/api/appearance',  require('./controllers/appearanceController').getPublic); // public navbar logo
app.get('/api/plans',       require('./controllers/planAdminController').publicPlans);
// Public platform config — non-secret flags the client (incl. logged-out marketing
// pages) reads to gate interim UI. feeOnlyMode drives the "payments launching soon"
// copy + free-plan hiding; it auto-reverts when the DB flag flips on Route go-live.
app.get('/api/config/public', async (req, res) => {
  try {
    const { getConfig } = require('./services/platformConfig');
    const { feeOnlyMode } = await getConfig();
    res.json({ feeOnlyMode });
  } catch (_) {
    res.json({ feeOnlyMode: true }); // fail-safe: interim until proven otherwise
  }
});

// Dynamic sitemap — root-mounted (NOT /api) so the public URLs are
// bookasloth.com/sitemap*.xml via the Vercel rewrite. DB-driven, cached, busted
// on service/profile mutations. Bypasses the /api rate limiter + maintenance 503.
app.use(require('./routes/sitemapRoutes'));

// Bot-traffic prerender — serves lightweight HTML meta-tag shells for social
// scrapers and non-JS crawlers. Proxied from Vercel edge middleware on bot UA.
app.use('/prerender', require('./routes/prerenderRoutes'));

// Health check — used by Render's health probe and UptimeRobot. Mounted outside
// /api so it bypasses the API rate limiter and maintenance-mode 503s, staying
// reachable even while the app is in maintenance. Intentionally does NOT touch
// the DB so a slow Supabase round-trip can't flap the platform health check.
app.get('/health', (req, res) =>
  res.status(200).json({ status: 'ok', uptime: process.uptime(), ts: Date.now() })
);

// Readiness (DB-checked) + metrics (Prometheus text, token-gated). Mounted
// outside /api so they bypass the rate limiter + maintenance 503, like /health.
const opsController = require('./controllers/opsController');
app.get('/ready', opsController.readiness);
app.get('/metrics', opsController.exposeMetrics);

// Human-facing branded status page. Distinct from /health + /ready (which stay
// pure JSON for probes/monitors) — this one is for a person, always HTML.
app.get('/status', async (req, res) => {
  const { statusPage } = require('./utils/brandPage');
  const { ready } = await opsController.checkDbReady();
  res.type('html').send(statusPage({ db: ready, uptimeSec: process.uptime() }));
});

// Google Search Console site-ownership proof for OAuth verification. Served as a
// route (no static dir on this API-only server). ponytail: onrender.com is a
// shared/free-tier host — move OAuth redirect + this proof to api.bookasloth.in
// once we own that subdomain.
app.get('/google7afa06c4734ff5fc.html', (req, res) =>
  res.type('text/html').send('google-site-verification: google7afa06c4734ff5fc.html')
);

// This origin (book-a-sloth.onrender.com) is an API host, never a site to
// index — sitemap + prerender HTML reach crawlers only via the Vercel proxy on
// bookasloth.com, whose own robots.txt governs them. Blanket-disallow direct
// crawling here so the raw origin can't become a duplicate "site" in an index.
app.get('/robots.txt', (req, res) =>
  res.type('text/plain').send('User-agent: *\nDisallow: /\n')
);

// Browser-facing pages carry the brand; API/JSON clients keep the machine payload.
const { brandPage, apiHomePage, wantsBrandedHtml } = require('./utils/brandPage');

app.get('/', (req, res) => {
  if (wantsBrandedHtml(req)) {
    return res.type('html').send(apiHomePage());
  }
  res.json({ message: 'Meeticulous API running' });
});

// 404 — branded page for browsers, JSON for API/clients. Must come after every
// route mount and before the error handler.
app.use((req, res) => {
  if (wantsBrandedHtml(req)) {
    return res.status(404).type('html').send(brandPage({
      code: 404,
      title: 'Not found',
      heading: 'This page took a nap',
      body: 'This address doesn’t exist on the Meeticulous API. The app lives next door — head over to book a session or manage your account.',
    }));
  }
  res.status(404).json({ message: 'Not found' });
});

app.use(require('./middleware/errorMiddleware'));

const { processReminders, autoCompleteBookings, expireStalePendingBookings } = require('./controllers/bookingController');
const { cleanup: cleanupOtps } = require('./utils/otpStore');

// Leader-election for the crons below. On one instance every job runs (the lock
// fails open / always wins); on >1 instance only the lease holder runs each job,
// so reminders/emails/campaigns aren't double-sent and the reconcilers don't
// race. Each job leases for 2x its interval so the holder always renews in time.
// See utils/jobLock.js + migrations/v3.25_job_locks.sql.
const { runLocked } = require('./utils/jobLock');

setInterval(async () => {
  try { await runLocked('reminders', () => processReminders(), { leaseMs: 10 * 60 * 1000 }); }
  catch (err) { console.error('Reminder cron error:', err.message); }
}, 5 * 60 * 1000);

// ── Fast workers + short-interval crons (≤10 min) stay on their own setInterval:
// they re-tick within minutes, so the setInterval-first-tick delay after a restart
// is negligible. The LONG jobs (≥15 min) moved to the persisted due-runner below
// (F4) — those are the ones Render's pod churn was silently starving. ──

// Follow-up nudges (rebook) — fires due scheduled_followups.
const { processFollowups } = require('./services/followups/followupService');
const FOLLOWUP_INTERVAL_MIN = Number(process.env.FOLLOWUP_INTERVAL_MIN || 10);
setInterval(async () => {
  try { await runLocked('followups', () => processFollowups(), { leaseMs: 10 * 60 * 1000 }); }
  catch (err) { console.error('Follow-up cron error:', err.message); }
}, FOLLOWUP_INTERVAL_MIN * 60 * 1000);

// Reap stale unpaid 'pending' bookings (security audit H-2).
const PENDING_REAP_INTERVAL_MIN = Number(process.env.PENDING_REAP_INTERVAL_MIN) || 10;
setInterval(async () => {
  try { await runLocked('expire-pending-bookings', () => expireStalePendingBookings(), { leaseMs: PENDING_REAP_INTERVAL_MIN * 2 * 60 * 1000 }); }
  catch (err) { console.error('Pending-hold reaper cron error:', err.message); }
}, PENDING_REAP_INTERVAL_MIN * 60 * 1000);

// Abandoned-payment recovery: email guests who started a paid booking and didn't finish.
setInterval(async () => {
  try {
    const { processAbandonedRecovery } = require('./services/abandonedRecovery');
    await runLocked('abandoned-recovery', () => processAbandonedRecovery(), { leaseMs: 10 * 60 * 1000 });
  } catch (err) { console.error('Abandoned-recovery cron error:', err.message); }
}, 5 * 60 * 1000);

// Queue-poll worker cadence (seconds). Default 300s (5 min): these poll near-empty
// queues, so a minute-fast tick just burns Supabase egress (the free-tier bandwidth
// cliff) for no gain — a send lands within one interval either way. Tune per env.
const EMAIL_QUEUE_INTERVAL_SEC = Number(process.env.EMAIL_QUEUE_INTERVAL_SEC) || 300;
const CAMPAIGN_WORKER_INTERVAL_SEC = Number(process.env.CAMPAIGN_WORKER_INTERVAL_SEC) || 300;
const CRM_SEND_INTERVAL_SEC = Number(process.env.CRM_SEND_INTERVAL_SEC) || 300;
const CRM_SEQUENCE_INTERVAL_SEC = Number(process.env.CRM_SEQUENCE_INTERVAL_SEC) || 300;

// Email queue worker.
const communicationEngine = require('./services/email/communicationEngine');
setInterval(async () => {
  try {
    await runLocked('email-queue', async () => {
      const r = await communicationEngine.processQueue();
      if (r.sent || r.failed) console.log(`Email queue: ${r.sent} sent, ${r.retried} retried, ${r.failed} failed`);
    }, { leaseMs: 2 * 60 * 1000 });
  } catch (err) { console.error('Email queue worker error:', err.message); }
}, EMAIL_QUEUE_INTERVAL_SEC * 1000);

// Campaign worker.
const campaignWorker = require('./services/campaignWorker');
setInterval(async () => {
  try {
    await runLocked('campaign-worker', async () => {
      const r = await campaignWorker.processDue();
      if (r.enqueued || r.failed) console.log(`Campaign worker: ${r.enqueued} enqueued, ${r.failed} failed`);
    }, { leaseMs: 2 * 60 * 1000 });
  } catch (err) { console.error('Campaign worker error:', err.message); }
}, CAMPAIGN_WORKER_INTERVAL_SEC * 1000);

// Host activation nudges (stage-based, every 30 min). Double-gated: feature flag
// `activation_nudges` (default OFF) + per-event is_active/whatsapp_enabled (OFF,
// v3.163) — fully inert until the founder launches. Quiet-hours + dedupe inside.
const { runActivationNudges } = require('./services/activationNudges');
setInterval(async () => {
  try {
    await runLocked('activation-nudges', async () => {
      const r = await runActivationNudges();
      if (r.processed) console.log(`Activation nudges: ${r.processed} processed, ${r.skipped} skipped`);
    }, { leaseMs: 60 * 60 * 1000 });
  } catch (err) { console.error('Activation nudges cron error:', err.message); }
}, 30 * 60 * 1000);

// ── Sales CRM fast workers (60s / 5min). Sends gated by crm_admin_sends (default OFF). ──
const crmMessageService = require('./services/crm/messageService');
const crmSequenceService = require('./services/crm/sequenceService');
const crmFollowUpService = require('./services/crm/followUpService');
setInterval(async () => {
  try {
    await runLocked('crm-send-worker', async () => {
      const r = await crmMessageService.processQueue();
      if (r.sent || r.failed) console.log(`CRM send worker: ${r.sent} sent, ${r.failed} failed, ${r.skipped} skipped`);
    }, { leaseMs: 2 * 60 * 1000 });
  } catch (err) { console.error('CRM send worker error:', err.message); }
}, CRM_SEND_INTERVAL_SEC * 1000);
setInterval(async () => {
  try {
    await runLocked('crm-sequence-worker', async () => {
      const r = await crmSequenceService.processDue();
      if (r.sent || r.stopped || r.completed) console.log(`CRM sequences: ${r.sent} stepped, ${r.stopped} stopped, ${r.completed} completed`);
    }, { leaseMs: 2 * 60 * 1000 });
  } catch (err) { console.error('CRM sequence worker error:', err.message); }
}, CRM_SEQUENCE_INTERVAL_SEC * 1000);
const CRM_FOLLOWUP_INTERVAL_MIN = Number(process.env.CRM_FOLLOWUP_INTERVAL_MIN) || 5;
setInterval(async () => {
  try {
    await runLocked('crm-followup-reminder', async () => {
      const r = await crmFollowUpService.processReminders();
      if (r.reminded) console.log(`CRM follow-up reminders: ${r.reminded} sent`);
    }, { leaseMs: CRM_FOLLOWUP_INTERVAL_MIN * 2 * 60 * 1000 });
  } catch (err) { console.error('CRM follow-up reminder error:', err.message); }
}, CRM_FOLLOWUP_INTERVAL_MIN * 60 * 1000);

// Cold calling: WhatsApp the lead ~15 min before a promised callback (no-op until
// the AiSensy template is approved).
setInterval(async () => {
  try { await runLocked('cold-call-reminders', () => require('./services/crm/coldCallService').callbackReminders(), { leaseMs: 10 * 60 * 1000 }); }
  catch (err) { console.error('Cold-call reminder cron error:', err.message); }
}, 5 * 60 * 1000);

// ══ F4: LONG-interval crons (≥15 min) driven off a PERSISTED schedule (job_runs),
// checked on a short SCHEDULER_TICK so pod churn can't starve them. Before this, a
// setInterval whose first tick lands after a FULL interval was reset on every Render
// restart — so ledger-reconcile, otp-cleanup, referral-release, the daily digests etc.
// effectively never ran (their job_locks leases sat expired under dead pods). runIfDue
// does the durable due-check + lease + run-stamp; each service self-gates/dedupes, so an
// occasional extra run right after a restart is safe. ══
const { runIfDue } = require('./utils/jobRunner');
const AUTO_COMPLETE_INTERVAL_MIN = Number(process.env.AUTO_COMPLETE_INTERVAL_MIN) || 15;
const badgeEngine = require('./services/badgeEngine');
const ledgerReconciler = require('./services/ledger/ledgerReconciler');
const subscriptionReconciler = require('./services/subscriptionReconciler');
const bookingPaymentReconciler = require('./services/bookingPaymentReconciler');
const confirmationReconciler = require('./services/confirmationReconciler');
const payoutReconciler = require('./services/payoutReconciler');
const payoutHolidayNotice = require('./services/payoutHolidayNotice');
const referralService = require('./services/referralService');
const crmAttribution = require('./services/crm/attribution');
const crmLifecycleEngine = require('./services/crm/lifecycleEngine');
const crmGuestEngine = require('./services/crm/guestRelationshipEngine');
const { cleanupExpired: cleanupRateLimitHits } = require('./middleware/rateLimitStore');

const SCHEDULED_JOBS = [
  { name: 'auto-complete', min: AUTO_COMPLETE_INTERVAL_MIN, run: () => autoCompleteBookings() },
  { name: 'otp-cleanup', min: 60, run: () => cleanupOtps() },
  { name: 'subscription-expiry', min: 6 * 60, run: () => require('./services/subscriptionExpiry').processSubscriptionExpiry() },
  { name: 'guest-host-invite', min: 24 * 60, run: () => require('./services/guestHostInvite').processGuestHostInvites() },
  { name: 'profile-completion', min: 12 * 60, run: () => require('./services/profileCompletion').processProfileCompletion() },
  { name: 'birthday', min: 12 * 60, run: () => require('./services/birthdayGreetings').processBirthdays() },
  { name: 'weekly-recap', min: 24 * 60, run: async () => { const r = await require('./services/weeklyHostRecap').sendWeeklyRecaps(); if (r.sent) console.log(`Weekly recap: ${r.sent} sent, ${r.skipped} skipped`); } },
  { name: 'support-insights-digest', min: 24 * 60, run: async () => { const r = await require('./services/supportInsightsDigest').sendWeeklyInsightsDigest(); if (r.sent) console.log(`Support digest: sent to ${r.recipients} recipient(s)`); } },
  { name: 'crm-attribution', min: Number(process.env.CRM_ATTRIBUTION_INTERVAL_MIN) || 60, run: async () => { const r = await crmAttribution.run(); if (r.linked || r.updated) console.log(`CRM attribution: ${r.linked} linked, ${r.updated} refreshed`); } },
  { name: 'crm-lifecycle-engine', min: Number(process.env.CRM_LIFECYCLE_INTERVAL_MIN) || 15, run: async () => { const r = await crmLifecycleEngine.run(); if (r.moved || r.enrolled || r.tasks || r.churned) console.log(`CRM lifecycle: ${r.moved} moved, ${r.enrolled} enrolled, ${r.tasks} tasks, ${r.churned || 0} churned (scanned ${r.scanned}${r.dryRun ? ', dryrun' : ''})`); } },
  { name: 'crm-guest-engine', min: Number(process.env.CRM_GUEST_ENGINE_INTERVAL_MIN) || 60, run: async () => { const r = await crmGuestEngine.run(); if (r.recs) console.log(`CRM guest engine: ${r.recs} recs from ${r.customers} customers (scanned ${r.scanned})`); } },
  // B2: cold-pool engagement. DRY-RUN by default; go-live = CRM_LIST_ENGAGEMENT_DRY_RUN=false
  // + enable crm_list_engagement flag + seed openers/clickers/new-marketing sequences.
  { name: 'crm-list-engagement', min: Number(process.env.CRM_LIST_ENGAGEMENT_INTERVAL_MIN) || 30, run: async () => { const r = await require('./services/crm/listEngagementService').run({ dryRun: process.env.CRM_LIST_ENGAGEMENT_DRY_RUN !== 'false' }); if (r.promoted || r.enrolled) console.log(`CRM list engagement: ${r.promoted} promoted, ${r.enrolled} enrolled (scanned ${r.scanned}${r.dryRun ? ', dryrun' : ''})`); } },
  // Phase 3: warm second-touch to campaign clickers. DRY-RUN by default (only
  // logs would-sends); go-live = CRM_SECOND_TOUCH_DRY_RUN=false + enable the
  // crm_second_touch flag (+ crm_admin_sends already on). Enqueues only — sendGate
  // still governs the actual send (quiet-hours, 1/48h, suppression).
  { name: 'crm-second-touch', min: Number(process.env.CRM_SECOND_TOUCH_INTERVAL_MIN) || 30, run: async () => { const r = await require('./services/crm/secondTouchService').run({ dryRun: process.env.CRM_SECOND_TOUCH_DRY_RUN !== 'false' }); if (r.enqueued) console.log(`CRM second-touch: ${r.enqueued} ${r.dryRun ? 'would-send (dryrun)' : 'enqueued'}, ${r.skipped} skipped (scanned ${r.scanned})`); } },
  { name: 'badge-eval', min: parseInt(process.env.BADGE_EVAL_INTERVAL_MIN) || 60, run: async () => { const r = await badgeEngine.evaluate(); if (r.awarded || r.revoked) console.log(`Badge engine: +${r.awarded} awarded, -${r.revoked} revoked`); } },
  { name: 'ledger-reconcile', min: Number(process.env.LEDGER_RECONCILE_INTERVAL_MIN || 60), run: async () => { const r = await ledgerReconciler.reconcile(); if (r.reposted > 0) console.log(`Ledger reconciler: reposted ${r.reposted} missed entries`); } },
  { name: 'subscription-reconcile', min: Number(process.env.SUBSCRIPTION_RECONCILE_INTERVAL_MIN || 15), run: async () => { const r = await subscriptionReconciler.reconcile(); if (r.healed > 0) console.log(`Subscription reconciler: activated ${r.healed} pending subscriptions`); if (r.released > 0) console.log(`Subscription reconciler: released ${r.released} orphaned pending mandates`); if (r.recorded > 0) console.log(`Subscription reconciler: booked ${r.recorded} missing subscription charges`); } },
  { name: 'booking-reconcile', min: Number(process.env.BOOKING_RECONCILE_INTERVAL_MIN || 15), run: async () => { const r = await bookingPaymentReconciler.reconcile(); if (r.healed > 0) console.log(`Booking reconciler: confirmed ${r.healed} paid bookings (of ${r.checked} checked)`); } },
  { name: 'confirmation-reconcile', min: Number(process.env.CONFIRMATION_RECONCILE_INTERVAL_MIN || 15), run: async () => { const r = await confirmationReconciler.reconcile(); if (r.healed > 0) console.log(`Confirmation reconciler: re-drove ${r.healed} unconfirmed bookings (of ${r.checked} checked)`); } },
  { name: 'payout-reconcile', min: Number(process.env.PAYOUT_RECONCILE_INTERVAL_MIN || 15), run: async () => { const r = await payoutReconciler.reconcile(); if (r.created || r.finalized) console.log(`Payout reconciler (${r.mode}): created ${r.created || 0}, finalized ${r.finalized || 0}`); } },
  { name: 'payout-holiday-notice', min: 24 * 60, run: async () => { const r = await payoutHolidayNotice.run(); if (r.notified) console.log(`Payout holiday notice: ${r.notified} host(s) for ${r.holiday}`); } },
  { name: 'referral-release', min: 60, run: async () => { const r = await referralService.releaseDue(); if (r.released || r.clawed) console.log(`Referral release: +${r.released} rewarded, ${r.clawed} clawed back`); } },
  { name: 'rate-limit-cleanup', min: 60, run: async () => { const n = await cleanupRateLimitHits(); if (n > 0) console.log(`Rate-limit store: pruned ${n} expired rows`); } },
  { name: 'ip-block-prune', min: 60, run: async () => { const n = await ipBlocklist.pruneExpired(); if (n > 0) console.log(`IP blocklist: pruned ${n} expired bans`); } },
  { name: 'seo-crawl', min: Number(process.env.SEO_CRAWL_INTERVAL_MIN) || 24 * 60, run: () => require('./services/seo/seoCrawler').run({ trigger: 'nightly' }) },
  // 6 pm IST cold-calling recap to the founder (`when` gates the hour; 20h interval = once a day).
  { name: 'cold-call-recap', min: 20 * 60, when: () => require('./services/crm/coldCallRules').istHour() === 18, run: () => require('./services/crm/coldCallService').dailyRecap() },
  { name: 'gsc-sync', min: Number(process.env.GSC_SYNC_INTERVAL_MIN) || 24 * 60, run: () => require('./services/seo/gscSync').run() },
];
const SCHEDULER_TICK_MIN = Number(process.env.SCHEDULER_TICK_MIN) || 5;
setInterval(async () => {
  for (const job of SCHEDULED_JOBS) {
    if (job.when && !job.when()) continue;
    try { await runIfDue(job.name, job.min * 60 * 1000, job.run); }
    catch (err) { console.error(`Scheduled job ${job.name} error:`, err.message); }
  }
}, SCHEDULER_TICK_MIN * 60 * 1000);

// Feature flags — seed any registry keys missing from the DB on boot (all ON,
// never overwrites an admin's existing on/off choice). Best-effort; the admin
// GET also re-syncs, so a transient boot failure self-heals.
require('./controllers/featureFlagController').syncRegistry()
  .then(() => console.log('Feature flags synced'))
  .catch((err) => console.error('Feature flag sync error:', err.message));

// IP blocklist — load active bans + allowlist into memory and start the periodic
// re-sync. Best-effort: if the tables don't exist yet (pre-migration) it logs and
// runs with an empty cache (fail-open), so boot never breaks.
ipBlocklist.init()
  .then(() => console.log('IP blocklist loaded'))
  .catch((err) => console.error('IP blocklist init error:', err.message));

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => console.log('Server running on port ' + PORT));

// Graceful shutdown: flush buffered PostHog events before exit (Render sends
// SIGTERM on deploy/restart). Best-effort, then close the HTTP server.
const { shutdown: posthogShutdown } = require('./utils/posthog');
const gracefulShutdown = async (signal) => {
  console.log(`${signal} received — flushing analytics and shutting down`);
  await Promise.allSettled([posthogShutdown(), flushSentry()]);
  server.close(() => process.exit(0));
  // Hard cap so a stuck connection can't hang the deploy.
  setTimeout(() => process.exit(0), 5000).unref();
};
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Last-resort safety nets. Without these, an unhandled promise rejection or a
// stray synchronous throw outside Express's try/catch (e.g. inside a setInterval
// cron callback) crashes the process silently with no captured context.
//
// uncaughtException: state is unknown/corrupt after one — log it, then exit so
// Render restarts a clean process rather than serving from a poisoned one.
// unhandledRejection: log at error level but do NOT exit — exiting on every
// rejected promise (an awaited fetch that 500s, etc.) would crash-loop the
// service. Surface it so it gets fixed; keep serving.
const { logger } = require('./utils/logger');
process.on('uncaughtException', (err) => {
  logger.error({ event: 'uncaughtException', message: err.message, stack: err.stack });
  captureException(err, { event: 'uncaughtException' });
  // Flush analytics + Sentry best-effort, then exit non-zero so Render restarts
  // a clean process. Hard cap so a stuck flush can't hang the restart.
  Promise.allSettled([posthogShutdown(), flushSentry()]).finally(() => process.exit(1));
  setTimeout(() => process.exit(1), 5000).unref();
});
process.on('unhandledRejection', (reason) => {
  const err = reason instanceof Error ? reason : new Error(String(reason));
  logger.error({ event: 'unhandledRejection', message: err.message, stack: err.stack });
  captureException(err, { event: 'unhandledRejection' });
});

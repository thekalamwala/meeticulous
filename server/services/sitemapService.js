/**
 * sitemapService.js — data layer for the dynamic sitemap.
 *
 * Pure mappers (DB rows -> sitemap entries) are exported for unit testing;
 * the DB fetchers query Supabase for the CURRENT set of indexable hosts and
 * services. Visibility rules (single source of truth):
 *   - Host listed when: role='host' AND is_verified AND is_indexable AND NOT
 *     is_banned AND has a username. (Admin verification flips it on; is_indexable
 *     defaults TRUE so verifying is enough — matches product decision.)
 *   - Service listed when: is_active AND is_indexable AND its host is listable.
 * A noindexed host therefore drops its service pages too (the canonical lives
 * under the host path), which is the correct cascade.
 *
 * Pre-migration safety: if the seo columns don't exist yet, the is_indexable
 * filters are dropped and everything active/verified is treated as indexable.
 */
const { supabaseAdmin } = require('../config/supabase');

// ── Pure helpers ─────────────────────────────────────────────────────────────

const trimSlash = (s) => String(s || '').replace(/\/+$/, '');

const hostUrl = (siteUrl, username) => `${trimSlash(siteUrl)}/${username}`;
const serviceUrl = (siteUrl, username, slug) => `${trimSlash(siteUrl)}/${username}/${slug}`;

// ISO timestamp -> W3C date (YYYY-MM-DD). Undefined for missing/invalid input.
const toLastmod = (ts) => {
  if (!ts) return undefined;
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString().slice(0, 10);
};

// Feature marketing pages (/features/:slug). KEEP IN SYNC with
// client/src/pages/features/featureData.js — that file is ESM and this server is
// CJS on a separately-rooted deploy, so the slugs are mirrored here by hand.
// Drift symptom: a live /features page missing from sitemap-pages.xml.
const FEATURE_SLUGS = [
  'online-scheduling', 'payments', 'google-calendar', 'notifications',
  'booking-pages', 'digital-products', 'reviews', 'availability',
  'analytics', 'client-management',
];

// Help-center articles (/help/docs/:slug). KEEP IN SYNC with
// client/src/content/helpDocsList.js (same ESM/CJS constraint as above).
const HELP_DOC_SLUGS = [
  'booking-a-service', 'signing-in-with-your-phone', 'otp-problems',
  'is-my-booking-confirmed', 'reschedule-or-cancel', 'refunds-and-failed-payments',
  'leaving-a-review', 'buying-digital-products', 'your-profile-and-email-preferences',
  'becoming-a-host', 'creating-and-managing-services', 'availability-and-google-calendar',
  'getting-paid', 'plans-and-upgrading', 'why-am-i-not-getting-bookings',
  'your-username-and-booking-link', 'branding-and-theme-colours', 'selling-digital-products',
  'reminders-notifications-and-badges', 'kyc-and-verification',
  'what-is-meeticulous', 'pricing-and-commission',
  'is-my-payment-and-data-safe', 'whats-not-supported-yet',
  'troubleshooting-and-errors', 'contact-support',
];

// Glossary terms (/glossary/:slug). KEEP IN SYNC with
// client/src/data/glossaryData.js (GLOSSARY_SLUGS) — same ESM/CJS constraint as above.
const GLOSSARY_SLUGS = [
  'booking-page', 'booking-link', 'no-show', 'advance-payment', 'availability',
  'double-booking', 'buffer-time', 'lead-time', 'cancellation-policy', 'reschedule',
  'reminder', 'whatsapp-reminder', 'upi', 'gst-invoice', 'payment-gateway',
  'payout', 'commission', 'platform-fee', 'google-calendar-sync', 'round-robin',
  'intake-form', 'digital-product', 'meeting-link',
  'placeholder-meeting', 'recurring-meeting', 'soft-booking', 'direct-booking', 'preferred-time',
  'availability-24-7',
];

// Open roles (/careers/:jobSlug). KEEP IN SYNC with
// client/src/components/careers/careersContent.js (same ESM/CJS constraint).
const JOB_SLUGS = ['digital-marketeer', 'mern-stack-developer', 'sales-associate'];

// Moment archive pages (/moments/:slug). KEEP IN SYNC with the MOMENTS array in
// client/src/data/moments.js (ESM data file, mirrored here by hand like above).
// Drift symptom: a live /moments/:slug missing from sitemap-pages.xml.
const MOMENT_SLUGS = ['fifa-2026-winners-spain'];

// Public, crawlable static routes. Host/service URLs come from the DB below.
const STATIC_ROUTES = [
  { path: '/',                         changefreq: 'daily',   priority: '1.0' },
  { path: '/explore',                  changefreq: 'daily',   priority: '0.9' },
  { path: '/become-a-host',               changefreq: 'weekly',  priority: '0.8' },
  { path: '/pricing',                  changefreq: 'monthly', priority: '0.7' },
  { path: '/appointment-booking-software', changefreq: 'monthly', priority: '0.8' },
  { path: '/enterprise',               changefreq: 'monthly', priority: '0.7' },
  { path: '/about',                    changefreq: 'monthly', priority: '0.5' },
  // SEO discovery hubs — internally link every /for/* and /compare/* landing page.
  { path: '/solutions',                changefreq: 'monthly', priority: '0.7' },
  { path: '/compare',                  changefreq: 'monthly', priority: '0.7' },
  { path: '/careers',                  changefreq: 'weekly',  priority: '0.5' },
  ...JOB_SLUGS.map((s) => ({ path: `/careers/${s}`, changefreq: 'weekly', priority: '0.5' })),
  { path: '/blog',                     changefreq: 'daily',   priority: '0.6' },
  { path: '/changelog',                changefreq: 'weekly',  priority: '0.4' },
  { path: '/contact',                  changefreq: 'monthly', priority: '0.4' },
  { path: '/support',                  changefreq: 'monthly', priority: '0.4' },
  { path: '/help',                     changefreq: 'monthly', priority: '0.4' },
  { path: '/privacy',                  changefreq: 'yearly',  priority: '0.3' },
  { path: '/terms',                    changefreq: 'yearly',  priority: '0.3' },
  { path: '/refund',                   changefreq: 'yearly',  priority: '0.3' },
  { path: '/guest-terms',              changefreq: 'yearly',  priority: '0.3' },
  { path: '/host-agreement',           changefreq: 'yearly',  priority: '0.3' },
  { path: '/host-fees',                changefreq: 'yearly',  priority: '0.3' },
  { path: '/earnings-calculator',      changefreq: 'monthly', priority: '0.6' },
  { path: '/tools',                    changefreq: 'monthly', priority: '0.5' },
  { path: '/templates',                changefreq: 'weekly',  priority: '0.6' },
  { path: '/tools/no-show-cost-calculator', changefreq: 'monthly', priority: '0.6' },
  { path: '/tools/gst-calculator',     changefreq: 'monthly', priority: '0.6' },
  { path: '/glossary',                 changefreq: 'monthly', priority: '0.5' },
  ...GLOSSARY_SLUGS.map((s) => ({ path: `/glossary/${s}`, changefreq: 'monthly', priority: '0.4' })),
  { path: '/press',                    changefreq: 'monthly', priority: '0.4' },
  { path: '/stats',                    changefreq: 'monthly', priority: '0.4' },
  { path: '/wall-of-love',             changefreq: 'weekly',  priority: '0.5' },
  { path: '/moments',                  changefreq: 'weekly',  priority: '0.5' },
  ...MOMENT_SLUGS.map((s) => ({ path: `/moments/${s}`, changefreq: 'monthly', priority: '0.5' })),
  { path: '/help/docs',                changefreq: 'monthly', priority: '0.4' },
  ...HELP_DOC_SLUGS.map((s) => ({ path: `/help/docs/${s}`, changefreq: 'monthly', priority: '0.4' })),
  ...FEATURE_SLUGS.map((s) => ({ path: `/features/${s}`, changefreq: 'monthly', priority: '0.7' })),
  { path: '/compare/topmate-alternative', changefreq: 'monthly', priority: '0.7' },
  { path: '/compare/calendly-alternative',  changefreq: 'monthly', priority: '0.7' },
  { path: '/compare/setmore-alternative',   changefreq: 'monthly', priority: '0.7' },
  { path: '/compare/acuity-alternative',    changefreq: 'monthly', priority: '0.7' },
  { path: '/compare/simplybook-alternative', changefreq: 'monthly', priority: '0.7' },
  { path: '/compare/zoho-bookings-alternative', changefreq: 'monthly', priority: '0.7' },
  // These 5 are live, prerendered /for pages (client/scripts/prerender.mjs)
  // that were missing from the sitemap — crawlable only via internal links.
  { path: '/for/astrologers',          changefreq: 'monthly', priority: '0.8' },
  { path: '/for/architects',           changefreq: 'monthly', priority: '0.8' },
  { path: '/for/dentists',             changefreq: 'monthly', priority: '0.8' },
  { path: '/for/sports-turf',          changefreq: 'monthly', priority: '0.8' },
  { path: '/for/chartered-accountants', changefreq: 'monthly', priority: '0.8' },
  { path: '/for/lawyers',              changefreq: 'monthly', priority: '0.8' },
  { path: '/for/doctors',              changefreq: 'monthly', priority: '0.8' },
  { path: '/for/therapists',           changefreq: 'monthly', priority: '0.8' },
  { path: '/for/yoga-instructors',     changefreq: 'monthly', priority: '0.8' },
  { path: '/for/business-consultant',  changefreq: 'monthly', priority: '0.8' },
  { path: '/for/pediatricians',        changefreq: 'monthly', priority: '0.8' },
  { path: '/for/gynecologists',        changefreq: 'monthly', priority: '0.8' },
  { path: '/for/dermatologists',       changefreq: 'monthly', priority: '0.8' },
  { path: '/for/physiotherapists',     changefreq: 'monthly', priority: '0.8' },
  { path: '/for/ent-specialists',      changefreq: 'monthly', priority: '0.8' },
  { path: '/for/ophthalmologists',     changefreq: 'monthly', priority: '0.8' },
  { path: '/for/nutritionists',        changefreq: 'monthly', priority: '0.8' },
  { path: '/for/life-coaches',         changefreq: 'monthly', priority: '0.8' },
  { path: '/for/spa',                  changefreq: 'monthly', priority: '0.8' },
  { path: '/for/veterinarians',        changefreq: 'monthly', priority: '0.8' },
  { path: '/for/salon',                changefreq: 'monthly', priority: '0.8' },
  { path: '/for/freelancers',          changefreq: 'monthly', priority: '0.8' },
  { path: '/for/fitness',              changefreq: 'monthly', priority: '0.8' },
  { path: '/for/tutors',               changefreq: 'monthly', priority: '0.8' },
  { path: '/for/photographers',        changefreq: 'monthly', priority: '0.8' },
  { path: '/for/events',               changefreq: 'monthly', priority: '0.8' },
  { path: '/for/agencies',             changefreq: 'monthly', priority: '0.8' },
];

const staticEntries = (siteUrl) =>
  STATIC_ROUTES.map((r) => ({ loc: `${trimSlash(siteUrl)}${r.path}`, changefreq: r.changefreq, priority: r.priority }));

const hostEntries = (rows, siteUrl) =>
  (rows || [])
    .filter((r) => r && r.username)
    .map((r) => ({ loc: hostUrl(siteUrl, r.username), lastmod: toLastmod(r.updated_at), changefreq: 'weekly', priority: '0.7' }));

const serviceEntries = (rows, siteUrl) =>
  (rows || [])
    .filter((r) => r && r.slug && r.profiles && r.profiles.username)
    .map((r) => ({ loc: serviceUrl(siteUrl, r.profiles.username, r.slug), lastmod: toLastmod(r.updated_at), changefreq: 'weekly', priority: '0.8' }));

// Professions that own >=1 active bookable-service category -> /services/:slug pages.
const professionEntries = (rows, siteUrl) => {
  const site = trimSlash(siteUrl);
  return [
    { loc: `${site}/services`, changefreq: 'weekly', priority: '0.6' },
    ...(rows || []).map((r) => ({
      loc: `${site}/services/${r.slug}`,
      lastmod: toLastmod(r.updated_at),
      changefreq: 'weekly',
      priority: '0.6',
    })),
  ];
};

// Published blog posts -> /blog/:slug. `lastmod` prefers updated_at so an edited
// post re-surfaces to crawlers, falling back to its publish date.
const blogEntries = (rows, siteUrl) => {
  const site = trimSlash(siteUrl);
  return (rows || [])
    .filter((r) => r && r.slug)
    .map((r) => ({
      loc: `${site}/blog/${r.slug}`,
      lastmod: toLastmod(r.updated_at || r.published_at),
      changefreq: 'monthly',
      priority: '0.6',
    }));
};

// ── DB fetchers ──────────────────────────────────────────────────────────────

const schemaMissing = (err) => err && /Could not find the|column.*does not exist/i.test(err.message || '');

// All listable host rows (username + updated_at), newest first.
const fetchHosts = async () => {
  let r = await supabaseAdmin
    .from('profiles')
    .select('username, updated_at')
    .eq('role', 'host')
    .eq('is_verified', true)
    .eq('is_banned', false)
    .eq('is_indexable', true)
    .not('username', 'is', null)
    .order('updated_at', { ascending: false });

  if (schemaMissing(r.error)) {
    // Pre-migration: no is_indexable column — every verified host is indexable.
    r = await supabaseAdmin
      .from('profiles')
      .select('username, updated_at')
      .eq('role', 'host')
      .eq('is_verified', true)
      .eq('is_banned', false)
      .not('username', 'is', null)
      .order('updated_at', { ascending: false });
  }
  if (r.error) throw r.error;
  return r.data || [];
};

// All listable service rows joined to their host (for the username path segment),
// then filtered in JS so a noindexed/unverified host removes its services too.
const fetchServices = async () => {
  const select = 'slug, updated_at, profiles!services_host_id_fkey(username, role, is_verified, is_banned, is_indexable)';
  let r = await supabaseAdmin
    .from('services')
    .select(select)
    .eq('is_active', true)
    .eq('is_indexable', true)
    .order('updated_at', { ascending: false });

  if (schemaMissing(r.error)) {
    r = await supabaseAdmin
      .from('services')
      .select('slug, updated_at, profiles!services_host_id_fkey(username, role, is_verified, is_banned)')
      .eq('is_active', true)
      .order('updated_at', { ascending: false });
  }
  if (r.error) throw r.error;

  return (r.data || []).filter((s) => {
    const p = s.profiles;
    if (!p) return false;
    if (p.role !== 'host' || !p.is_verified || p.is_banned) return false;
    if (p.is_indexable === false) return false; // host noindex cascades; missing col => true
    return true;
  });
};

// Professions that own >=1 active bookable-service category (newest updated_at wins).
// Intersected with ACTIVE professions (categories.status): the directory endpoint
// 404s inactive/unknown professions, so emitting them here would sitemap 404 URLs.
const fetchProfessions = async () => {
  const [sc, prof] = await Promise.all([
    supabaseAdmin
      .from('service_categories')
      .select('primary_category, updated_at')
      .eq('is_active', true),
    supabaseAdmin
      .from('categories')
      .select('slug')
      .eq('status', 'active'),
  ]);
  if (sc.error) throw sc.error;
  if (prof.error) throw prof.error;
  const activeProfessions = new Set((prof.data || []).map((r) => r.slug));
  const newest = new Map();
  for (const r of sc.data || []) {
    if (!activeProfessions.has(r.primary_category)) continue;
    const prev = newest.get(r.primary_category);
    if (!prev || (r.updated_at && r.updated_at > prev)) newest.set(r.primary_category, r.updated_at);
  }
  return [...newest.entries()].map(([slug, updated_at]) => ({ slug, updated_at }));
};

// Published blog posts. Mirrors the public read in blogController exactly
// (status + future-date gate) — so the sitemap never lists a scheduled post the
// API still 404s, nor omits one it serves.
const fetchBlogs = async () => {
  const r = await supabaseAdmin
    .from('blogs')
    .select('slug, published_at, updated_at')
    .eq('status', 'published')
    .lte('published_at', new Date().toISOString())
    .not('slug', 'is', null)
    .order('published_at', { ascending: false });
  if (r.error) throw r.error;
  return r.data || [];
};

module.exports = {
  // pure
  trimSlash, hostUrl, serviceUrl, toLastmod, STATIC_ROUTES, staticEntries, hostEntries, serviceEntries, professionEntries, blogEntries,
  // db
  fetchHosts, fetchServices, fetchProfessions, fetchBlogs,
};

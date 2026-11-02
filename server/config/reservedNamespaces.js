// L1 — route-derived + future-namespace reservations. This is the version-
// controlled enforcement AUTHORITY for platform names: a row here can never be
// deleted by a runtime DB write (unlike L2 / reserved_slugs). A CI test
// (client/src/__tests__/routeManifestSync) asserts every app route's first path
// segment appears here, so the list can never silently drift behind the router.
//
// Grouped by category for auditability and so the admin UI can render "why is
// this reserved". Everything is normalized through the same slug normalizer used
// at every write point, so comparisons are apples-to-apples.
const { normalizeSlug } = require('../utils/slugNormalize');

// Every first path-segment the app owns today (client App.jsx + server root routes).
const ROUTES = [
  'login', 'logout', 'signin', 'signup', 'register', 'forgot-password', 'reset-password',
  'help', 'about', 'privacy', 'terms', 'refund', 'unsubscribe', 'support', 'explore', 'how-it-works',
  'guest-terms', 'host-agreement', 'host-fees', // legal document set
  'become-a-host', 'login-as-vendor', 'vendor', 'vendor-register', 'auth',
  'backstage', 'super-dashboard', 'admin', 'dashboard', 'user', 'review', 'manage-booking', 'lp', 'for',
  'og', // /og/blog/:slug — render target for the OG card generator
  'my-bookings', 'profile', 'reviews', 'loyalty', 'settings', 'search', 'wall-of-love', 'moments',
  'opening', 'inaugurators', // "The Opening" launch event + permanent Inaugurators Wall

  'earnings-calculator',
  'tools', // free calculators hub — client /tools + /tools/* routes
  'glossary', 'press', 'stats', // client /glossary(+/:slug), /press, /stats routes
  'templates', // client /templates hub
  'solutions', 'compare', // SEO discovery hubs — client /solutions + /compare routes
  'appointment-booking-software', // SEO landing — client /appointment-booking-software route
  'sitemap', 'robots', 'health', 'manifest', 'favicon', 'get-in-touch',
];

// Infrastructure / technical reserved handles.
const INFRA = [
  'api', 'www', 'cdn', 'static', 'assets', 'public', 'media', 'files', 'img', 'images',
  'download', 'downloads', 'webhook', 'webhooks', 'oauth', 'sso', 'saml', 'callback',
  'well-known', 'healthz', 'ping', 'status', 'metrics', 'debug', 'internal', 'system', 'root',
];

// Future product / marketing namespaces — reserved now so the business can
// launch them later without being blocked by a user-claimed slug.
const FUTURE = [
  'docs', 'doc', 'blog', 'blogs', 'pricing', 'plans', 'plan', 'features', 'feature',
  'presentation', // full-screen product pitch deck — client /presentation route
  'pitch-deck', // investor pitch deck — client /pitch-deck route (noindex, unlinked)

  'changelog', 'roadmap', 'security', 'legal', 'cookies', 'careers', 'jobs', 'press',
  'newsroom', 'contact', 'faq', 'guides', 'guide', 'tutorials', 'tutorial', 'resources',
  'learn', 'academy', 'courses', 'partners', 'affiliates', 'developers', 'developer',
  'api-docs', 'enterprise', 'teams', 'team', 'org', 'orgs', 'organization', 'organizations',
  'workspace', 'workspaces', 'community', 'communities', 'marketplace', 'store', 'shop', 'market',
];

// Auth / account / commerce / booking nouns.
const ACCOUNT = [
  'account', 'accounts', 'billing', 'invoice', 'invoices', 'checkout', 'cart', 'verify',
  'confirm', 'activate', 'welcome', 'onboarding', 'get-started', 'start', 'join', 'invite',
  'refer', 'referral', 'book', 'booking', 'bookings', 'schedule', 'appointment', 'appointments',
  'slot', 'slots', 'availability', 'service', 'services', 'product', 'products', 'order', 'orders',
  'payment', 'payments', 'pay', 'subscribe', 'subscription', 'subscriptions', 'upgrade',
  'redeem', 'gift', 'promo', 'coupon', 'deals', 'offers', 'notifications', 'campaigns', 'badges',
  'categories', 'category', 'feedback',
];

// Brand / role / safety / impersonation-prevention.
const BRAND = [
  'meeticulous', 'meeticulousofficial', 'official', 'verified', 'staff',
  'moderator', 'mod', 'administrator', 'superadmin', 'team-meeticulous', 'no-reply', 'noreply',
  'postmaster', 'abuse', 'hostmaster', 'mail', 'email', 'hosts', 'host', 'users', 'vendors',
  'home', 'index', 'me', 'guest', 'app', 'apps', 'web', 'go',
];

// Single / very-short handles — premium landgrab guard (also reserved at L1).
const SHORT = ['a', 'i', 'u', 's', 'p', 'c', 'e', 'r', 'o', 'x', 'm'];

// Literal hazards that must never be a slug.
const HAZARD = ['null', 'undefined', 'true', 'false', 'nan', 'none', 'nil', 'void'];

// Branded error / status pages — each has its own /<code> route on the client
// (config/errorCatalog.js), plus offline + maintenance. Reserved so a user can
// never claim "/404" and shadow an error page. Includes the common non-routed
// codes too, future-proofing new error pages (brief: "reserve any future error
// routes").
const STATUS = [
  '400', '401', '402', '403', '404', '405', '406', '408', '409', '410',
  '411', '412', '413', '414', '415', '418', '422', '423', '425', '426',
  '429', '431', '451',
  '500', '501', '502', '503', '504', '505', '507', '508', '511',
  'offline', 'maintenance', 'waitlist',
];

// Corporate / org-chart roles — impersonation guard for "the company".
const CORP = [
  'owner', 'founder', 'cofounder', 'co-founder', 'ceo', 'cto', 'cfo', 'coo',
  'employee', 'manager', 'superuser', 'sysadmin',
];

// Marketplace role nouns (parity with existing host/guest/vendor in BRAND).
const ROLES = ['provider', 'client', 'customer', 'customerservice', 'member', 'members'];

// Account / auth / config surface nouns not covered by ACCOUNT above.
const ACCOUNT_EXTRA = [
  'verification', 'authentication', 'profiles', 'password', 'reset',
  'forgot-password', 'forgotpassword', 'registration', 'preferences',
  'config', 'configuration', 'panel', 'console', 'portal',
];

// Ops / observability surfaces.
const OPS = [
  'monitor', 'logs', 'analytics', 'reports', 'report', 'finance', 'trust', 'safety',
];

// Communication surfaces.
const COMMS = ['messages', 'inbox', 'outbox', 'news', 'updates', 'calendar', 'documentation'];

// Mail / transport protocol handles (extends INFRA).
const PROTO = ['ftp', 'smtp', 'imap', 'pop3'];

// Legal / compliance handles (extends FUTURE legal set).
const LEGAL = ['gdpr', 'cookie'];

// Non-prod environment handles — never a public username.
const ENVS = ['dev', 'staging', 'test', 'beta', 'sandbox', 'demo'];

// Additional literal / anonymity hazards (extends HAZARD).
const HAZARD_EXTRA = ['anonymous', 'unknown', 'default'];

// Current + future product brands (impersonation guard).
const PRODUCTS = ['timewheel'];

// Vanity easter-egg handles — reserved so no host can claim them; the client
// redirects each to a single public profile (client/src/config/vanityRedirects).
// Keep this list in sync with VANITY_SLUGS there. ('me'/'founder' are already
// reserved via BRAND/CORP; the Set dedupes, listed here to keep the set whole.)
const VANITY = [
  '18', '21', '69', '420', '007', '0001', '1337', '999',
  'adult', '18plus', 'nsfw', 'uncensored', 'private', 'secret',
  'human', 'founder', 'boss', 'lore', 'me',
];

const CATEGORIES = {
  ROUTES, INFRA, FUTURE, ACCOUNT, BRAND, SHORT, HAZARD, STATUS,
  CORP, ROLES, ACCOUNT_EXTRA, OPS, COMMS, PROTO, LEGAL, ENVS, HAZARD_EXTRA, PRODUCTS, VANITY,
};

// Normalized set of every L1 reserved name.
const RESERVED_SET = new Set(
  Object.values(CATEGORIES).flat().map(normalizeSlug),
);

// True if a NORMALIZED slug exactly matches an L1 reserved name. (Exact match is
// sufficient for route protection: user slugs are single path segments, so
// "/admin-tips" never collides with "/admin" or "/admin/x". Prefix/namespace
// reservation is an opt-in L2 concern, not an L1 one.)
function isStaticReserved(norm) {
  return RESERVED_SET.has(norm);
}

module.exports = { RESERVED_SET, isStaticReserved, CATEGORIES };

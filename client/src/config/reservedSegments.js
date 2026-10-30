// First path-segment of every top-level app route. Two consumers:
//   1. client/middleware.js (Vercel edge) — SKIP list, avoids a resolve() round
//      trip on known non-profile paths.
//   2. CI sync tests — routeManifestSync (client) asserts every <Route> first
//      segment is listed here; reservedSegmentsSync (server) asserts every entry
//      here is also reserved in the server L1 registry. Together they make it
//      impossible to add a route that a user could claim as a username.
//
// When you add a top-level route to App.jsx, add its first segment here.
export const RESERVED_FIRST_SEGMENTS = [
  'login', 'logout', 'signin', 'signup', 'register', 'forgot-password', 'reset-password',
  'help', 'about', 'careers', 'privacy', 'terms', 'refund', 'unsubscribe', 'support', 'explore', 'changelog', 'blog', 'blogs', 'pricing', 'services', 'features',
  // SEO discovery hubs (pages/Solutions.jsx, pages/Compare.jsx) — link every /for/* + /compare/* landing page.
  'solutions', 'compare',
  // Legal document set — see components/common/LegalLayout.jsx POLICIES.
  'guest-terms', 'host-agreement', 'host-fees',
  'contact', 'get-in-touch', 'enterprise', 'earnings-calculator', 'how-it-works',
  'tools', // free calculators hub (pages/tools/*): /tools, /tools/no-show-cost-calculator, /tools/gst-calculator
  'glossary', // booking & scheduling glossary (pages/Glossary.jsx + /glossary/:slug)
  'templates', // message & policy templates hub (pages/TemplatesIndex.jsx)
  'press', // press / media kit (pages/Press.jsx)
  'stats', // "by the numbers" fast-facts page (pages/Stats.jsx)
  'appointment-booking-software', // SEO landing (pages/AppointmentBookingSoftware.jsx)
  'be-a-sloth', 'become-a-host', 'login-as-vendor', 'vendor', 'vendor-register', 'auth',
  'hello-sloth', 'backstage', 'super-dashboard', 'admin', 'dashboard', 'user', 'review', 'manage-booking', 'lp', 'for', 'invite',
  // /og/blog/:slug — render target for the OG card generator (see pages/OgCard.jsx).
  'og',
  'my-bookings', 'profile', 'reviews', 'loyalty', 'sitemap', 'robots', 'health',
  'search', 'wall-of-love', 'moments', 'opening', 'inaugurators',
  'presentation', // full-screen product pitch deck (pages/presentation/)
  'pitch-deck', // investor pitch deck (pages/pitch-deck/) — noindex, unlinked, not in sitemap/prerender
  '_attic', // hidden pre-compaction homepage snapshot (pages/HomeArchive.jsx) — noindex, unlinked, not in sitemap/prerender
  // Branded error pages (config/errorCatalog.js) + offline/maintenance. Each has
  // its own /<code> route, so the first segment must be reserved here too.
  '400', '401', '403', '404', '405', '408', '409', '410', '413', '415', '422', '429',
  '500', '502', '503', '504', 'offline', 'maintenance',
];

export default RESERVED_FIRST_SEGMENTS;

// /changelog releases — public "What's New". Marketing-facing product updates.
// Pure ESM data (no JSX/lucide) so scripts/prerender.mjs can import it to bake
// every /changelog/:version page. History starts at the Nov 1, 2026 launch;
// add new releases on top.
//
// `version` is semver (major.minor.patch) and doubles as the URL slug:
// /changelog/1.0.0. KEEP IN SYNC with CHANGELOG_VERSIONS in
// server/services/sitemapService.js (mirrored by hand, like MOMENT_SLUGS).
//
// The FIRST tag picks the road sign on /changelog:
//   New → destination board · Improved → KM stone · Fixed → turn sign · Security → shield.
export const RELEASES = [
  {
    version: '2.0.0',
    date: 'Nov 25, 2026',
    title: 'Meeticulous 2.0 — your whole business, in one place',
    tags: ['New', 'Improved', 'Security'],
    points: [
      'Memberships — turn your regulars into a paid membership with recurring billing, member-only spaces and content, and upgrades that pro-rate automatically.',
      'Creator Intelligence (Pro) — a dashboard that shows where your bookings come from, who your audience is, what’s in demand and how your revenue is tracking.',
      'A reimagined community — a mobile-first feed with spaces, threaded replies, @mentions, reactions, topic hubs and up to two credited collaborators per post.',
      'Meet Tithi, your Chief of Staff — in-thread help that answers questions, handles reschedules and cancellations, and loops in a human the moment she can’t.',
      'Discount codes — create coupons and let guests apply them at checkout.',
      'Video courses (Pro) — sell on-demand video courses right from your page.',
      'Cancellation policies (Pro) — pick a per-service policy, shown to guests up front at checkout.',
      'Gift Pro — send someone complimentary Pro, extend it, or pay it forward.',
      'Sign in with LinkedIn — hosts can now join and sign in with LinkedIn, alongside Google.',
      'A redesigned host dashboard — cleaner Today, Bookings, Catalog, Clients, Money, Schedule and Settings, with a native-app feel and a bottom tab bar on mobile.',
      'A smoother booking flow — a clearer two-column time step, a tidier calendar and an up-front price breakdown.',
      'Smarter, warmer emails — a redesigned booking confirmation, festival and milestone greetings, review nudges, and gentle win-back notes, on email and WhatsApp.',
      'A testimonials wall — collect and show client proof on your page.',
      'Booking caps (Pro) — set how many bookings you’ll take in a day so you never over-commit.',
      'A richer profile — social-proof booking counts, a free-intro call-to-action, and a 16-colour palette to make your page yours.',
      'Safer by default — a top-to-bottom security pass that locks down your data and payouts, plus faster, more reliable pages.',
    ],
  },
  {
    version: '1.1.0',
    date: 'Nov 2, 2026',
    title: 'A fresh new look',
    tags: ['Improved', 'New'],
    points: [
      'A whole new look — our home, about, careers and pricing pages now wear the new Meeticulous design.',
      'Pro pricing in US dollars — visiting from outside India? You now see Pro priced in USD.',
      'Simpler plans — it’s just Starter and Pro now; the old Host+ and Studio names are gone.',
      'Friendlier emails — booking and account emails now open with an illustrated header.',
      'New dashboard icons — the host dashboard sidebar has a fresh, easier-to-scan icon set.',
      'Cleaner sign-in pages — signing in and signing up now match the new design.',
    ],
  },
  {
    version: '1.0.0',
    date: 'Nov 1, 2026',
    title: 'Meeticulous is here',
    tags: ['New'],
    points: [
      'Your own booking page — one link that shows who you are and what people can book with you.',
      'Get paid when people book — guests pay online with UPI or card, and the money comes to you.',
      'Calendar sync and reminders — bookings land on your Google Calendar, and everyone gets a reminder before the session.',
    ],
  },
];

// Sort by date, newest first. `new Date('Jul 19, 2026')` parses the display
// string fine; sort is stable so same-day entries keep their authored order.
export const SORTED_RELEASES = [...RELEASES].sort((a, b) => new Date(b.date) - new Date(a.date));

export const findRelease = (version) => SORTED_RELEASES.find((r) => r.version === version);

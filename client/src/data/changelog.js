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

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
    title: 'Meeticulous 2.0 — it all comes together',
    tags: ['New'],
    points: [
      'A premium host home — a redesigned Today that shows your whole day at a glance, with what needs you up front.',
      'Everything since 1.1, together — memberships, Creator Intelligence, the new community, Tithi, courses, coupons, cancellation policies and more, now in one polished place.',
      'A fresh coat throughout — rounder cards, calmer colours and quicker pages, end to end.',
    ],
  },
  {
    version: '1.7.0',
    date: 'Nov 23, 2026',
    title: 'A smoother booking, and sharing the credit',
    tags: ['Improved', 'New'],
    points: [
      'A smoother booking flow — a clearer two-column time step, a tidier calendar and an up-front price breakdown.',
      'Share the credit — tag up to two collaborators on a community post, shown on the post and on their profile.',
      'A redesigned host profile — a warmer creator card, grid cards and a community feed.',
      'Cleaner forms everywhere — simpler, lighter fields across sign-in, booking and your dashboard.',
    ],
  },
  {
    version: '1.6.0',
    date: 'Nov 19, 2026',
    title: 'A redesigned dashboard',
    tags: ['Improved', 'New'],
    points: [
      'A redesigned host dashboard — cleaner Today, Bookings, Catalog, Clients, Money, Schedule and Settings, all on your real data.',
      'A rebuilt community feed — one clean layout, smoother reactions and spaces.',
      'Membership upgrades that pro-rate — move a member up a tier and we only charge the difference.',
    ],
  },
  {
    version: '1.5.0',
    date: 'Nov 17, 2026',
    title: 'Memberships and Creator Intelligence',
    tags: ['New', 'Improved'],
    points: [
      'Memberships — turn your regulars into a paid membership with recurring billing and member-only spaces and content.',
      'Creator Intelligence (Pro) — a dashboard that shows where your bookings come from, who your audience is, what’s in demand and how your revenue is tracking.',
      'Clearer tax handling — statutory, correctly-calculated tax on every booking.',
    ],
  },
  {
    version: '1.4.0',
    date: 'Nov 14, 2026',
    title: 'Sell more — courses, codes and proof',
    tags: ['New', 'Improved'],
    points: [
      'Discount codes — create coupons and let guests apply them at checkout.',
      'Video courses (Pro) — sell on-demand video courses right from your page.',
      'Cancellation policies (Pro) — pick a per-service policy, shown to guests up front at checkout.',
      'Booking caps (Pro) — set how many bookings you’ll take in a day so you never over-commit.',
      'A testimonials wall — collect and show client proof on your page.',
      'A redesigned confirmation email — clearer details to cut no-shows.',
      'A friendlier dashboard — a setup checklist, cleaner stat cards, and your assigned account manager in view.',
    ],
  },
  {
    version: '1.3.0',
    date: 'Nov 11, 2026',
    title: 'Meet Tithi, a mobile home screen and warmer emails',
    tags: ['New', 'Improved', 'Security'],
    points: [
      'Meet Tithi, your Chief of Staff — in-thread help that answers questions, handles reschedules and cancellations, and loops in a human the moment she can’t.',
      'A native-app feel on mobile — a bottom tab bar and pull-to-refresh on both the host and guest dashboards.',
      'Smarter, warmer emails — gentle win-back notes, review nudges and festival greetings, now on WhatsApp too.',
      'A fresh community — a mobile-first feed with threaded replies, @mentions, contributor profiles and a UPI tip jar.',
      'Safer by default — a top-to-bottom security pass that locks down your data and payouts.',
    ],
  },
  {
    version: '1.2.1',
    date: 'Nov 9, 2026',
    title: 'Smoother sign-in and faster support',
    tags: ['Improved', 'Fixed'],
    points: [
      'A tidier sign-in — one-time codes now drop into clean digit slots.',
      'Faster help — we alert the team the moment a support chat has been waiting too long.',
      'Polished home, careers and about pages.',
      'Community tidy-up — clearer house rules and smoother replies.',
    ],
  },
  {
    version: '1.2.0',
    date: 'Nov 5, 2026',
    title: 'Gifting, LinkedIn and a palette of your own',
    tags: ['New', 'Improved'],
    points: [
      'Sign in with LinkedIn — hosts can now join and sign in with LinkedIn, alongside Google.',
      'Gift Pro — send someone complimentary Pro, extend it, or pay it forward.',
      'Make your page yours — a 16-colour profile palette for Pro hosts.',
      'Steadier payouts — behind-the-scenes work so your money reaches you reliably.',
      'Bigger uploads — profile and service images up to 5MB.',
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

// client/src/data/moments.js
// Moments — Google-Doodle-style archive content. Single source of truth for
// pages/Moments.jsx (index), pages/MomentPage.jsx (detail), and the featured
// moment on pages/Search.jsx. Curated, dev-authored; publish = edit + deploy.
//
// Each moment:
//   slug     — URL segment (/moments/:slug). Unique, URL-safe [a-z0-9-].
//   title    — headline.
//   date     — display string; also sort order (keep array newest-first).
//   image    — art URL. Self-hosted art lives in client/public/images/moments
//              and is referenced as /images/moments/${slug}.{gif,png}. Remote
//              art may use the assets CDN instead.
//   alt      — image alt text.
//   excerpt  — 1-2 line summary (index card + meta description, keep < 160 chars).
//   body     — array of blocks:
//                { p }     paragraph
//                { h2 }    section heading
//                { quote } the quiet ending — one line to remember, rendered
//                          large + centered with a hairline above. At most one.
//   credits  — optional attribution string.
//   cta      — optional { label, href } (internal path or external URL).
//
// Voice: calm. Almost a museum curator speaking quietly. The event is only the
// beginning; the lesson is the destination. Celebrate effort more than victory.
// See docs/moments-authoring.md before writing a new one.

export const MOMENTS = [
  {
    slug: 'diwali-2026',
    title: 'Diwali — The Festival of Lights',
    date: 'November 8, 2026',
    image: '/images/moments/diwali-2026.gif',
    alt: 'Illustration celebrating Diwali 2026 — a night sky lit by fireworks over lamp-lit homes',
    excerpt: 'On the darkest night of the year, millions light a single lamp. Diwali 2026 — light over darkness, one patient flame at a time.',
    body: [
      { p: 'On the new-moon night of November 8, 2026 — the darkest night of the lunar month — millions of homes did the same small thing at the same hour: they lit a lamp. One clay diya on a windowsill, then another beside it, then a row along the wall, until streets, balconies and whole cities glowed against the dark. Diwali had come again.' },
      { p: 'Diwali is not one story but many — Rama’s return to Ayodhya, Lakshmi walking into lit homes, the triumph of light over darkness and knowledge over ignorance. Across faiths and regions the details differ, but the gesture is the same everywhere: when the night is longest, you do not wait for the dark to pass. You make light.' },
      { h2: 'What this took' },
      { p: 'The festival looks effortless — fireworks, sweets, lamps — but the night rests on weeks of quiet work. Homes are cleaned corner to corner. Debts are settled and accounts closed before the new year. Rangoli is drawn grain by grain at dawn. The celebration everyone sees is the last small part of a long, unglamorous preparation nobody photographs.' },
      { p: 'And a single diya is itself a lesson in patience: oil, a cotton wick, a steady hand, shelter from the wind. Light does not arrive all at once. It is tended.' },
      { h2: 'What we can carry from it' },
      { p: 'One lamp does little against a whole night. But no one lights just one. Each flame borrows from the one beside it, and a street no single lamp could brighten becomes luminous because everyone lit their own. The point was never the brightness of any one light. It was that we all chose to light something.' },
      { p: 'That is the quiet instruction of Diwali — not to wait for better conditions, not to out-shout the darkness, but to tend your own small flame faithfully, and trust it to join the others.' },
      { quote: 'A thousand lamps begin with one that refused to stay dark.' },
    ],
    credits: 'Art by the Meeticulous team.',
    cta: { label: 'Explore hosts', href: '/explore' },
  },
];

export const FEATURED = MOMENTS[0];

export function getMoment(slug) {
  return MOMENTS.find((m) => m.slug === slug);
}

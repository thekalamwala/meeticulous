// client/src/data/moments.js
// Moments — Google-Doodle-style archive content. Single source of truth for
// pages/Moments.jsx (index), pages/MomentPage.jsx (detail), and the featured
// moment on pages/Search.jsx. Curated, dev-authored; publish = edit + deploy.
//
// Each moment:
//   slug     — URL segment (/moments/:slug). Unique, URL-safe [a-z0-9-].
//   title    — headline.
//   date     — display string; also sort order (keep array newest-first).
//   image    — art URL. Convention: CDN .../images/moments/${slug}.png
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

const CDN = 'https://company-assets.meeticulous.in/images/moments';

export const MOMENTS = [
  {
    slug: 'fifa-2026-winners-spain',
    title: 'Spain — Champions of the World',
    date: 'July 19, 2026',
    image: `${CDN}/fifa-2026-winners-spain.png`,
    alt: 'Illustration celebrating Spain winning the FIFA World Cup 2026',
    excerpt: 'Spain win the 2026 World Cup, 1–0 after extra time. A final decided not by chaos, but by control.',
    body: [
      { p: 'On a July night at New York–New Jersey Stadium, Spain became champions of the world. They beat the defending champions, Argentina, 1–0 after extra time — Ferran Torres finishing the deadlock in the 106th minute for the country’s second world title.' },
      { p: 'It was not a night of chaos. Spain kept the ball, kept the shape, and kept coming: chance after chance, save after save from Emiliano Martínez, until the pressure finally found a way through. Argentina, holders of the crown, did not manage a shot in normal time.' },
      { h2: 'What this took' },
      { p: 'A final like this is won long before the whistle. It is won in the midfield — in the unglamorous discipline of holding the ball for one more pass, closing one more gap, staying patient while the score stays level and the world grows loud. Spain did not out-run this game. They out-organised it.' },
      { p: 'That kind of control is not a gift. It is thousands of ordinary training days, repeated with purpose, until composure under pressure stops being a decision and becomes a habit.' },
      { h2: 'What we can carry from it' },
      { p: 'Most great results look, from the outside, like a single decisive moment — one goal, in the 106th minute. But the moment was only the visible ending. The real work was every quiet day that made the team calm enough to still be playing their game when it mattered most.' },
      { p: 'And we should hold a little space for Argentina, too. To reach a World Cup final is itself the sum of years most people never see. Some nights the discipline is the other team’s. The effort is no less real.' },
      { quote: 'Great moments are rarely created in a single day.' },
    ],
    credits: 'Art by the Meeticulous team.',
    cta: { label: 'Explore hosts', href: '/explore' },
  },
];

export const FEATURED = MOMENTS[0];

export function getMoment(slug) {
  return MOMENTS.find((m) => m.slug === slug);
}

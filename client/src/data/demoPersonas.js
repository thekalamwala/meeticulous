// demoPersonas.js — persona presets for the public /demo host profile.
//
// The /demo account (username 'demo') carries one bookable service set per
// persona. Each persona lists its service slugs; the public profile page shows a
// "View as" switcher that overrides the displayed header (name / profession /
// tagline / bio) and filters services to that persona's slugs.
//
// Services are tagged by slug (not category) because services.(primary_category,
// category) is a composite FK into service_categories — arbitrary persona keys
// aren't valid there, so the seed leaves both null and we match on slug instead.
//
// Presentation-only: the switch never writes to the DB, so a visitor flipping it
// changes only their own view. Matching services are seeded by
// server/scripts/demoPersonaSeed.sql — keep these slugs in sync with that file.

export const DEMO_USERNAME = 'demo';

export const DEMO_PERSONAS = [
  {
    key: 'coach',
    label: 'Coach',
    name: 'Aanya Kapoor',
    profession: 'Career & Business Coach',
    tagline: '1:1 coaching · 500+ sessions',
    bio: 'Career and business coach helping professionals get unstuck and move faster. Book a slot below — the first call is where it clicks.',
    serviceSlugs: ['demo-career-clarity-call', 'demo-business-strategy-hour', 'demo-mock-interview'],
    image: 'https://loremflickr.com/400/400/business,coach?lock=11',
  },
  {
    key: 'salon',
    label: 'Salon',
    name: 'Studio Bloom',
    profession: 'Salon & Makeup Studio',
    tagline: 'Hair · Makeup · Skin',
    bio: 'A calm little studio for cuts, colour, and event-ready makeup. Pick a service and a time — we handle the rest.',
    serviceSlugs: ['demo-haircut-style', 'demo-bridal-makeup-trial', 'demo-spa-facial'],
    image: 'https://loremflickr.com/400/400/hair,salon?lock=21',
  },
  {
    key: 'wellness',
    label: 'Wellness',
    name: 'Maya Rao',
    profession: 'Wellness & Therapy',
    tagline: 'Therapy · Nutrition · Yoga',
    bio: 'Gentle, practical support for mind and body — one honest session at a time. Book what fits you today.',
    serviceSlugs: ['demo-therapy-session', 'demo-nutrition-consult', 'demo-1-1-yoga'],
    image: 'https://loremflickr.com/400/400/yoga,wellness?lock=31',
  },
  {
    key: 'sports-arena',
    label: 'Sports Arena',
    name: 'GreenField Arena',
    profession: 'Sports Arena & Turf Booking',
    tagline: 'Turf · Courts · Nets',
    bio: 'Book the turf, a court, or a practice net by the hour. Instant slots, no phone calls, no waiting.',
    serviceSlugs: ['demo-turf-slot', 'demo-badminton-court', 'demo-cricket-net'],
    image: 'https://loremflickr.com/400/400/football,stadium?lock=41',
  },
];

export const findPersona = (key) => DEMO_PERSONAS.find((p) => p.key === key) || null;

// Every persona-owned service slug — used to keep the "Default" view showing only
// the base account's own services, not the persona sets.
export const ALL_PERSONA_SLUGS = new Set(DEMO_PERSONAS.flatMap((p) => p.serviceSlugs || []));

// Build the view for a persona (or the base account when key is null/unknown).
export const personaView = (base, key) => {
  const p = findPersona(key);
  if (!p) {
    return { host: base.host, services: base.services.filter((s) => !ALL_PERSONA_SLUGS.has(s.slug)) };
  }
  const slugs = new Set(p.serviceSlugs || []);
  return {
    host: {
      ...base.host,
      name: p.name, profession: p.profession, tagline: p.tagline, bio: p.bio,
      profile_image: p.image || base.host.profile_image,
    },
    services: base.services.filter((s) => slugs.has(s.slug)),
  };
};

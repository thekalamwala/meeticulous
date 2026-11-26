// Grow — pure helpers (tested in tests/growModel.test.js). No React, no API.
//
// Grow is one section with in-page tabs (Kept redesign, founder-approved
// 2026-11-26): Overview · Your page · Reviews · Refer & earn. Every tab is a real
// URL; Reviews and Refer & earn keep their old routes (/dashboard/testimonials,
// /dashboard/referrals), so bookmarks and email links still land. Community uses
// the same shell as its own section, over its four old routes.

export const GROW_HOME = '/dashboard/grow';
export const GROW_PAGE = '/dashboard/grow/page';

// `match` = every pathname prefix that lights the tab. Community is its own
// rail section again (founder, 2026-11-26), with its own tabs (GrowCommunity).
export const growTabs = () => [
  { key: 'overview', to: GROW_HOME, label: 'Overview', match: [GROW_HOME], exact: true },
  { key: 'page', to: GROW_PAGE, label: 'Your page', match: [GROW_PAGE] },
  { key: 'reviews', to: '/dashboard/testimonials', label: 'Reviews', match: ['/dashboard/testimonials'] },
  { key: 'refer', to: '/dashboard/referrals', label: 'Refer & earn', match: ['/dashboard/referrals'] },
];

export const COMMUNITY_TABS = ['activity', 'mentions', 'answer', 'spaces'].map((k) => ({
  key: k, to: `/dashboard/community/${k}`, label: k[0].toUpperCase() + k.slice(1), match: [`/dashboard/community/${k}`],
}));

export const activeGrowTab = (pathname, tabs) => {
  const p = String(pathname || '').replace(/\/+$/, '');
  return tabs.find((t) => (t.exact ? t.match.includes(p) : t.match.some((m) => p === m || p.startsWith(`${m}/`))))?.key || null;
};

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

// One sentence about guest reviews: what a host would say out loud.
export const reviewsSentence = ({ count = 0, avg = 0 } = {}) => (count > 0
  ? `Guests rate you ${Number(avg).toFixed(1)} out of 5 from ${plural(count, 'review')}.`
  : 'No guest reviews yet. They appear here after a completed booking.');

// The Grow band — one focal sentence from real figures, picked by what is true:
//   1. setup unfinished → how far from ready, and the next step;
//   2. page live, people have opened it → visits so far + the reviews sentence;
//   3. page live, nobody yet → share it.
// `views` null = the count could not be read: say nothing about visits.
export const growBand = ({ steps = [], views = null, reviews = null } = {}) => {
  const left = steps.filter((s) => !s.done);
  if (left.length) {
    return {
      kind: 'setup',
      title: [`Your page is ${plural(left.length, 'step')}`, 'from ready.'],
      sub: `Next: ${left[0].title.toLowerCase()}.`,
    };
  }
  if (views > 0) {
    return {
      kind: 'views',
      title: [`${views.toLocaleString('en-IN')} ${views === 1 ? 'visit' : 'visits'} to your page`, 'so far.'],
      sub: reviews ? reviewsSentence(reviews) : 'Share it again to fill next week.',
    };
  }
  return {
    kind: 'share',
    title: ['Your page is live.', 'Now let people see it.'],
    sub: 'Put your link where your audience already is: bio, WhatsApp status, email signature.',
  };
};

// The public booking link for a username, or null before one is set.
export const pageUrl = (username, origin = (typeof window !== 'undefined' ? window.location.origin : '')) =>
  (username ? `${origin}/${username}` : null);

// WhatsApp share sheet with the link prefilled (wa.me with no number = pick a chat).
export const waShare = (url, text = 'Book a session with me:') =>
  (url ? `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}` : null);

// Your page edits ONLY the guest-facing profile fields (founder split, 2026-11-26).
// Everything else on the profile (birthday, search keywords, maps link, booking
// rules, visibility) stays with Settings → Account and is never sent from here.
export const PAGE_KEYS = ['name', 'profession', 'location', 'bio', 'profile_image', 'cover_image', 'theme_color', 'social_links'];

export const pageFields = (user = {}) => ({
  name: user?.name || '',
  profession: user?.profession || '',
  location: user?.location || '',
  bio: user?.bio || '',
  profile_image: user?.profile_image || '',
  cover_image: user?.cover_image || '',
  theme_color: user?.theme_color || '',
  social_links: { ...(user?.social_links || {}) },
});

// The save body: exactly PAGE_KEYS, nothing else, name trimmed.
export const pagePayload = (form) => {
  const out = {};
  for (const k of PAGE_KEYS) if (form[k] !== undefined) out[k] = form[k];
  if (typeof out.name === 'string') out.name = out.name.trim();
  if (!out.theme_color) delete out.theme_color; // keep the stored/default colour
  return out;
};

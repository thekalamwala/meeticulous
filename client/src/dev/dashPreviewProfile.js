// Dev-preview fixtures for the PUBLIC profile (/riyakapoor), so Grow › Your page's
// live preview iframe renders the real page without a server. Made-up data only.
const HOST = {
  id: 'host-preview', username: 'riyakapoor', name: 'Riya Kapoor', profession: 'Growth coach',
  tagline: 'Growth sprints for small teams', location: 'Pune', theme_color: '#960D32',
  bio: 'I help small teams find the one funnel fix that matters.',
  profile_image: '/about/mascot-blue.png', cover_image: '', is_verified: true, plan: 'starter',
  social_links: { instagram: 'https://instagram.com/riya.grows', linkedin: 'https://linkedin.com/in/riyakapoor' },
};
const SERVICES = [
  { id: 'svc-1', title: 'Funnel Teardown', price: 1499, duration: 45, type: 'service', is_active: true, slug: 'funnel-teardown', meeting_mode: 'online' },
  { id: 'svc-2', title: 'Growth Sprint Workshop', price: 999, duration: 60, type: 'service', is_active: true, slug: 'growth-sprint', meeting_mode: 'online' },
  { id: 'svc-3', title: 'SEO Consultation', price: 0, duration: 30, type: 'service', is_active: true, slug: 'seo-consultation', meeting_mode: 'online' },
];

export const profileFixtures = () => ({
  '/host/riyakapoor': { host: HOST, services: SERVICES },
  '/reviews/riyakapoor': { reviews: [], count: 0, avg: 0 },
  '/products/host/riyakapoor': [],
  '/host/riyakapoor/testimonials': [],
  '/vendors/riyakapoor/badges': { badges: [] },
});

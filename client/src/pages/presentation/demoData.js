// Curated fallback so an externally shared link never shows an empty demo.
// Category personas re-skin the booking demo on slide 08.
export const FALLBACK_HOST = {
  username: 'slothstudio',
  name: 'Sloth Studio',
  tagline: 'Calm sessions, booked in seconds.',
  profile_image: '', // HostAvatar renders initials fallback on themeColor
  cover_image: '',   // HostCover renders theme gradient
  accent_color: '#960D32',
  services: [
    { id: 'd1', title: 'Discovery Call', slug: 'discovery-call', short_description: 'A quick, no-pressure fit check.', price: 0, duration: 20, meeting_mode: 'online' },
    { id: 'd2', title: 'Strategy Session', slug: 'strategy-session', short_description: 'A focused hour on your goals.', price: 1500, duration: 60, meeting_mode: 'online' },
    { id: 'd3', title: 'Deep Dive', slug: 'deep-dive', short_description: 'Half-day intensive.', price: 4000, duration: 180, meeting_mode: 'in_person' },
  ],
};

export const CATEGORY_DEMOS = [
  { key: 'coach', label: 'Coaches', icon: '🎯', host: { ...FALLBACK_HOST, name: 'Aarav Coaching', accent_color: '#269CEF',
    services: [{ id: 'c1', title: 'Clarity Call', slug: 'clarity-call', short_description: 'Reset your week.', price: 0, duration: 30, meeting_mode: 'online' },
               { id: 'c2', title: 'Coaching Hour', slug: 'coaching-hour', short_description: '1:1 deep work.', price: 2000, duration: 60, meeting_mode: 'online' }] } },
  { key: 'therapist', label: 'Therapists', icon: '🧠', host: { ...FALLBACK_HOST, name: 'Meera Wellness', accent_color: '#1DA1F2',
    services: [{ id: 't1', title: 'First Consultation', slug: 'first-consult', short_description: 'A gentle start.', price: 800, duration: 45, meeting_mode: 'online' },
               { id: 't2', title: 'Therapy Session', slug: 'therapy-session', short_description: 'Weekly support.', price: 1500, duration: 50, meeting_mode: 'online' }] } },
  { key: 'salon', label: 'Salons & Spas', icon: '💇', host: { ...FALLBACK_HOST, name: 'Bloom Studio', accent_color: '#db2777',
    services: [{ id: 's1', title: 'Haircut & Style', slug: 'haircut', short_description: 'Fresh look.', price: 600, duration: 45, meeting_mode: 'in_person' },
               { id: 's2', title: 'Spa Ritual', slug: 'spa-ritual', short_description: 'Full reset.', price: 2500, duration: 90, meeting_mode: 'in_person' }] } },
  { key: 'tutor', label: 'Tutors', icon: '📚', host: { ...FALLBACK_HOST, name: 'Ravi Tutoring', accent_color: '#059669',
    services: [{ id: 'e1', title: 'Trial Class', slug: 'trial-class', short_description: 'See the method.', price: 0, duration: 30, meeting_mode: 'online' },
               { id: 'e2', title: 'IELTS Session', slug: 'ielts-session', short_description: 'Band-boost hour.', price: 1200, duration: 60, meeting_mode: 'online' }] } },
];

// Deterministic-ish open slots for a given date; skips past times if date is today.
export function genSlots(dateISO) {
  const base = ['09:00', '10:30', '12:00', '14:00', '15:30', '17:00', '18:30'];
  const today = new Date().toISOString().slice(0, 10);
  if (dateISO !== today) return base;
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
  return base.filter((t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m > nowMin + 30; });
}

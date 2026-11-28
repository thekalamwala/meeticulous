/**
 * tests/HostProfile.test.jsx
 * Public creator profile page — theme color, services listing,
 * booking URL shape, social icons, loading/error states.
 */
import { render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('../services/api', () => ({
  getHostProfile: vi.fn(),
  getHostReviews: vi.fn().mockResolvedValue({ data: { reviews: [], count: 0, avg: 0 } }),
  getHostProducts: vi.fn().mockResolvedValue({ data: [] }),
  getHostCourses: vi.fn().mockResolvedValue({ data: [] }),
  getMembershipSpace: vi.fn().mockRejectedValue({ response: { status: 404 } }),
  getVendorBadges: vi.fn().mockResolvedValue({ data: { badges: [] } }),
  recordProfileView: vi.fn(),
}));

import { getHostProfile, getHostReviews, getHostProducts, getHostCourses, getMembershipSpace, recordProfileView } from '../services/api';
import HostProfile from '../pages/HostProfile';

const HOST = {
  id: 'v1', name: 'Jane Vendor', role: 'host', plan: 'creator',
  username: 'jane-vendor', profession: 'Life Coach', bio: 'I help people.',
  profile_image: '', cover_image: '', theme_color: '#2E1065',
  social_links: { linkedin: 'https://linkedin.com/in/jane', instagram: 'https://instagram.com/jane' },
  is_verified: true, badges: [], google_calendar_connected: false, location: 'Mumbai',
};

const SERVICES = [
  { id: 's1', title: 'Consultation', slug: 'consultation', price: 500, duration: 45, meeting_mode: 'online', is_active: true, short_description: 'A great session.' },
  { id: 's2', title: 'Workshop',     slug: 'workshop',     price: 0,   duration: 90, meeting_mode: 'offline',is_active: true, short_description: 'In-person workshop.' },
];

const renderProfile = (username = 'jane-vendor') =>
  render(
    <MemoryRouter initialEntries={[`/${username}`]}>
      <Routes>
        <Route path="/:profileSlug" element={<HostProfile />} />
      </Routes>
    </MemoryRouter>
  );

// ── Loading + error states ────────────────────────────────────────────────────

describe('HostProfile — loading/error', () => {
  test('shows brand preloader while loading', () => {
    getHostProfile.mockReturnValueOnce(new Promise(() => {})); // never resolves
    renderProfile();
    expect(document.querySelector('.pl-overlay')).toBeTruthy();
  });

  test('renders the branded noindex 404 (not thin 200 HTML) on 404', async () => {
    getHostProfile.mockRejectedValueOnce({ response: { status: 404 } });
    renderProfile('ghost-user');
    // A dead host slug must render the branded ErrorPage, which carries
    // <meta robots="noindex"> via ErrorLayout — otherwise the thin "Host not found"
    // HTML served at 200 gets flagged by Google as a soft 404.
    // #984 flat redesign dropped the "Error 404" eyebrow — assert the branded 404
    // title instead (still proves ErrorPage rendered, not the thin 200 HTML).
    // The robots meta is set imperatively by <Seo>'s useEffect, which flushes AFTER
    // the "vanishing act" text paints — so both assertions live in the SAME waitFor.
    // Asserting the meta outside it raced the effect and flaked under parallel CI load.
    await waitFor(() => {
      expect(screen.getByText(/vanishing act/i)).toBeTruthy();
      expect(
        document.querySelector('meta[name="robots"]')?.getAttribute('content')
      ).toMatch(/noindex/i);
    });
  });
});

// ── Profile info ──────────────────────────────────────────────────────────────

describe('HostProfile — profile info', () => {
  beforeEach(() => {
    getHostProfile.mockResolvedValue({ data: { host: HOST, services: SERVICES, availability: null } });
  });

  test('renders creator name', async () => {
    renderProfile();
    // Name renders twice (collapsed mobile bar + full card) — match either.
    await waitFor(() => expect(screen.getAllByText('Jane Vendor').length).toBeGreaterThan(0));
  });

  test('renders creator title/profession', async () => {
    renderProfile();
    // Subtitle is "category/profession, location" on one line.
    await waitFor(() => expect(screen.getAllByText('Life Coach, Mumbai').length).toBeGreaterThan(0));
  });

  test('no About stats block or summary line on the profile; the newest reviews show as quotes', async () => {
    getHostReviews.mockResolvedValueOnce({ data: { count: 3, avg: 4.67, reviews: [
      { id: 'r1', rating: 5, comment: 'Practical, specific, zero fluff.', created_at: '2026-11-01', profiles: { name: 'A' } },
      { id: 'r2', rating: 5, comment: 'Showed up prepared.', created_at: '2026-11-02', profiles: { name: 'B' } },
      { id: 'r3', rating: 4, comment: 'Good session overall.', created_at: '2026-11-03', profiles: { name: 'C' } },
    ] } });
    renderProfile();
    await waitFor(() => expect(screen.getByText('“Practical, specific, zero fluff.”')).toBeTruthy());
    // Founder 2026-11-28: the stats block and the summary line are not printed.
    expect(screen.queryByRole('heading', { level: 2, name: 'About Jane Vendor' })).toBeNull();
    expect(screen.queryByText('2 bookable services')).toBeNull();
    expect(screen.queryByText(/Book online.$/)).toBeNull(); // the summary line's tail
    expect(screen.getByText('“Showed up prepared.”')).toBeTruthy();
    expect(screen.queryByText('“Good session overall.”')).toBeNull(); // behind the toggle
  });

  test('renders bio text', async () => {
    renderProfile();
    await waitFor(() => expect(screen.getAllByText(/I help people/i).length).toBeGreaterThan(0));
  });

  test('renders location', async () => {
    renderProfile();
    // getAllByText: location also appears in the auto-FAQ answer ("based in Mumbai").
    await waitFor(() => expect(screen.getAllByText(/Mumbai/i).length).toBeGreaterThan(0));
  });

  test('renders verified badge icon', async () => {
    renderProfile();
    await waitFor(() => {
      // Verified icon is an SVG — check the container text renders
      expect(screen.getAllByText('Jane Vendor').length).toBeGreaterThan(0);
    });
  });
});

// ── Services listing ──────────────────────────────────────────────────────────

describe('HostProfile — services listing', () => {
  beforeEach(() => {
    getHostProfile.mockResolvedValue({ data: { host: HOST, services: SERVICES, availability: null } });
  });

  test('renders all service titles', async () => {
    renderProfile();
    await waitFor(() => {
      expect(screen.getByText('Consultation')).toBeTruthy();
      // Workshop is the free service, so it also appears as the intro-CTA subtitle.
      expect(screen.getAllByText('Workshop').length).toBeGreaterThan(0);
    });
  });

  test('shows price correctly — paid and free', async () => {
    renderProfile();
    await waitFor(() => {
      // ₹ and the number render as separate spans (baseline-aligned), so match the number.
      expect(screen.getByText('500')).toBeTruthy();
      expect(screen.getByText('Free')).toBeTruthy();
    });
  });

  test('shows duration for each service', async () => {
    renderProfile();
    await waitFor(() => {
      expect(screen.getByText(/45 min/i)).toBeTruthy();
      expect(screen.getByText(/90 min/i)).toBeTruthy();
    });
  });

  test('Book Now links use /:profileSlug/booking/:serviceSlug pattern', async () => {
    renderProfile();
    await waitFor(() => {
      const bookLinks = screen.getAllByRole('link', { name: /book now/i });
      bookLinks.forEach((link) => {
        expect(link.getAttribute('href')).toMatch(/\/jane-vendor\/booking\//);
        expect(link.getAttribute('href')).not.toMatch(/\/book$/); // old pattern gone
      });
    });
  });

  test('service detail links use /:profileSlug/:serviceSlug', async () => {
    // Redesign: the card no longer has a "View details" label — the service
    // title itself is the link to the service detail page.
    renderProfile();
    await waitFor(() => {
      const detailLinks = screen.getAllByRole('link', { name: /consultation|workshop/i });
      expect(detailLinks.length).toBeGreaterThan(0);
      detailLinks.forEach((link) => {
        expect(link.getAttribute('href')).toMatch(/\/jane-vendor\/(consultation|workshop)/);
      });
    });
  });

  test('no service thumbnails shown (per spec)', async () => {
    renderProfile();
    await waitFor(() => screen.getByText('Consultation'));
    // No <img> elements inside service cards that have alt text matching service title
    const imgs = document.querySelectorAll('img[alt="Consultation"], img[alt="Workshop"]');
    expect(imgs.length).toBe(0);
  });

  test('shows an empty state + request form when services array is empty', async () => {
    getHostProfile.mockResolvedValueOnce({ data: { host: HOST, services: [], availability: null } });
    renderProfile();
    await waitFor(() => expect(screen.getByText(/no sessions here yet/i)).toBeTruthy());
  });
});

// ── Theme color ───────────────────────────────────────────────────────────────

describe('HostProfile — theme color applied', () => {
  test('injects --profile-accent CSS variable with vendor color', async () => {
    getHostProfile.mockResolvedValue({ data: { host: HOST, services: SERVICES, availability: null } });
    renderProfile();
    await waitFor(() => screen.getAllByText('Jane Vendor'));
    // --profile-accent is set by a useEffect that runs after the name commits,
    // so poll for it rather than reading once (avoids an effect-timing race).
    await waitFor(() => {
      // Query the page root specifically — BrandPreloader locks body style,
      // so a bare [style] selector would match <body> instead.
      const root = document.querySelector('.host-profile');
      expect(root?.style?.getPropertyValue('--profile-accent')).toBe('#2E1065');
      expect(root?.style?.getPropertyValue('--profile-accent-text')).toBe('#ffffff');
    });
  });

  test('falls back to #960D32 when theme_color is null', async () => {
    const hostNoColor = { ...HOST, theme_color: null };
    getHostProfile.mockResolvedValue({ data: { host: hostNoColor, services: [], availability: null } });
    renderProfile();
    await waitFor(() => screen.getAllByText('Jane Vendor'));
    // Poll for the CSS var (applied by a post-commit useEffect) to avoid a race.
    await waitFor(() => {
      const root = document.querySelector('.host-profile');
      expect(root?.style?.getPropertyValue('--profile-accent')).toBe('#960D32');
    });
  });

  test('Book Now buttons use CSS var for theme color', async () => {
    getHostProfile.mockResolvedValue({ data: { host: HOST, services: SERVICES, availability: null } });
    renderProfile();
    await waitFor(() => screen.getAllByRole('link', { name: /book now/i }));
    const bookBtns = screen.getAllByRole('link', { name: /book now/i });
    bookBtns.forEach((btn) => {
      expect(btn.style.background).toContain('--profile-accent');
    });
  });
});

// ── Social proof (booking counts) ─────────────────────────────────────────────

describe('HostProfile — booking social proof', () => {
  test('shows host "Booked N times" when host.booking_count > 0', async () => {
    getHostProfile.mockResolvedValue({ data: { host: { ...HOST, booking_count: 212 }, services: SERVICES, availability: null } });
    renderProfile();
    await waitFor(() => expect(screen.getByText('212')).toBeTruthy());
  });

  test('hides the host count when booking_count is 0 / absent', async () => {
    getHostProfile.mockResolvedValue({ data: { host: HOST, services: SERVICES, availability: null } });
    renderProfile();
    await waitFor(() => screen.getAllByText('Jane Vendor'));
    expect(screen.queryByText(/booked \d+ time/i)).toBeNull();
  });

  test('shows per-service "Booked N×" when a service has a count', async () => {
    // Count on SERVICES[1] — SERVICES[0] leads as the featured hero (no count row there).
    const services = [SERVICES[0], { ...SERVICES[1], booking_count: 34 }];
    getHostProfile.mockResolvedValue({ data: { host: HOST, services, availability: null } });
    renderProfile();
    await waitFor(() => expect(screen.getByText(/Booked 34×/)).toBeTruthy());
  });
});

// (The free-intro CTA banner was removed from the profile in the redesign.)

// ── Profile tabs (/:username/products|courses|membership) ─────────────────────

const renderTab = (path) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/:profileSlug" element={<HostProfile />} />
        <Route path="/:profileSlug/products" element={<HostProfile tab="products" />} />
        <Route path="/:profileSlug/courses" element={<HostProfile tab="courses" />} />
        <Route path="/:profileSlug/membership" element={<HostProfile tab="membership" />} />
      </Routes>
    </MemoryRouter>
  );

// The first stat cell of the desktop card (aside) — its number + label.
const firstStat = () => {
  const label = document.querySelector('aside .uppercase.tracking-wider');
  return { label: label?.textContent, n: label?.previousSibling?.textContent };
};

describe('HostProfile — tabs', () => {
  beforeEach(() => {
    getHostProfile.mockResolvedValue({ data: { host: HOST, services: SERVICES, availability: null } });
  });
  afterEach(() => {
    getHostProducts.mockResolvedValue({ data: [] });
    getHostCourses.mockResolvedValue({ data: [] });
    getMembershipSpace.mockRejectedValue({ response: { status: 404 } });
  });

  test('a tab shows only when the host has an item of that type', async () => {
    getHostCourses.mockResolvedValue({ data: [{ id: 'c1', title: 'Breathwork 101', slug: 'breath', price: 0, lesson_count: 3 }] });
    renderTab('/jane-vendor');
    await waitFor(() => expect(screen.getAllByRole('tab', { name: 'Courses' }).length).toBe(1));
    expect(screen.queryByRole('tab', { name: 'Products' })).toBeNull();
    expect(screen.queryByRole('tab', { name: 'Membership' })).toBeNull();
  });

  test('products tab lists products and counts them in the card', async () => {
    getHostProducts.mockResolvedValue({ data: [{ id: 'p1', title: 'Meal plan PDF', price: 299, type: 'pdf' }] });
    renderTab('/jane-vendor/products');
    await waitFor(() => expect(screen.getByText('Meal plan PDF')).toBeTruthy());
    expect(firstStat()).toEqual({ label: 'Products', n: '1' });
    expect(screen.queryByText('Consultation')).toBeNull(); // services grid stays on /:username
  });

  test('courses tab shows the lesson count', async () => {
    getHostCourses.mockResolvedValue({ data: [{ id: 'c1', title: 'Breathwork 101', slug: 'breath', price: 499, lesson_count: 3 }] });
    renderTab('/jane-vendor/courses');
    await waitFor(() => expect(screen.getByText('Breathwork 101')).toBeTruthy());
    expect(screen.getByText('3 lessons')).toBeTruthy();
    expect(firstStat()).toEqual({ label: 'Courses', n: '1' });
  });

  test('membership tab shows tiers and the actual member count', async () => {
    getMembershipSpace.mockResolvedValue({ data: {
      host: { username: 'jane-vendor', name: 'Jane Vendor' },
      program: { name: 'Inner circle', blurb: 'Monthly calls.' },
      tiers: [{ id: 't1', name: 'Gold', type: 'paid', price_inr: 499, perks: ['Monthly call'] }],
      posts: [], viewer_membership: null, member_count: 42,
    } });
    renderTab('/jane-vendor/membership');
    await waitFor(() => expect(screen.getByText('Inner circle')).toBeTruthy());
    expect(screen.getByText('Monthly call')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Join' })).toBeTruthy();
    expect(firstStat()).toEqual({ label: 'Members', n: '42' });
  });

  test('products tab: own SEO, CollectionPage JSON-LD, no summary line, visible FAQ, slug links', async () => {
    getHostProducts.mockResolvedValue({ data: [{ id: 'p1', slug: 'meal-plan', title: 'Meal plan PDF', price: 299, type: 'pdf' }] });
    renderTab('/jane-vendor/products');
    await waitFor(() => expect(document.title).toBe('Digital products by Jane Vendor (1)'));
    expect(document.querySelector('link[rel="canonical"]').getAttribute('href')).toMatch(/\/jane-vendor\/products$/);
    const ld = [JSON.parse(document.querySelector('script[type="application/ld+json"]').textContent)].flat()[0];
    const types = ld['@graph'].map((n) => n['@type']);
    expect(types).toContain('CollectionPage');
    expect(types).toContain('FAQPage');
    expect(types).not.toContain('ProfilePage');
    // The summary is the meta description only — not printed above the tab.
    expect(document.querySelector('meta[name="description"]').getAttribute('content')).toMatch(/^1 digital product by Jane Vendor, from ₹299\./);
    expect(screen.queryByText(/^1 digital product by Jane Vendor, from ₹299\./)).toBeNull();
    expect(screen.getByText('How do I get my download after paying?')).toBeTruthy();
    expect(screen.getAllByRole('link', { name: 'Meal plan PDF' })[0].getAttribute('href')).toBe('/jane-vendor/products/meal-plan');
  });

  test('products tab: intro and how-buying-works sections (no host About block), h3 item titles, Updated date', async () => {
    getHostProducts.mockResolvedValue({ data: [{ id: 'p1', slug: 'meal-plan', title: 'Meal plan PDF', price: 299, type: 'pdf', updated_at: '2026-11-20T09:00:00Z' }] });
    renderTab('/jane-vendor/products');
    await waitFor(() => expect(screen.getByRole('heading', { level: 2, name: 'How buying works' })).toBeTruthy());
    expect(screen.getByRole('heading', { level: 2, name: "About Jane Vendor's digital products" })).toBeTruthy();
    expect(screen.queryByRole('heading', { level: 2, name: 'About Jane Vendor' })).toBeNull();
    expect(screen.getByRole('heading', { level: 3, name: 'Meal plan PDF' })).toBeTruthy();
    expect(screen.getByText('Updated 20 Nov 2026')).toBeTruthy();
  });

  test('a tab URL with nothing to show falls back to the profile', async () => {
    renderTab('/jane-vendor/courses');
    await waitFor(() => expect(screen.getAllByText('Consultation').length).toBeGreaterThan(0));
    expect(firstStat().label).toBe('Services');
  });

  test('a failed tab fetch (429/5xx) does not redirect — it offers a retry', async () => {
    getHostCourses.mockRejectedValue({ response: { status: 429 } });
    renderTab('/jane-vendor/courses');
    await waitFor(() => expect(screen.getByText("This didn't load.")).toBeTruthy());
    expect(firstStat().label).toBe('Courses');
  });
});

// ── Live preview hook (dashboard "Your page" iframe) ─────────────────────────────
describe('HostProfile — preview mode', () => {
  const realParent = window.parent;
  let parent;
  beforeEach(() => {
    getHostProfile.mockResolvedValue({ data: { host: HOST, services: SERVICES, availability: null } });
    parent = { postMessage: vi.fn() };
    Object.defineProperty(window, 'parent', { value: parent, configurable: true });
    window.history.replaceState(null, '', '/?preview=1');
    recordProfileView.mockClear();
  });
  afterEach(() => {
    Object.defineProperty(window, 'parent', { value: realParent, configurable: true });
    window.history.replaceState(null, '', '/');
  });

  test('announces ready, applies a same-origin draft, ignores other origins, skips view tracking', async () => {
    renderProfile();
    await waitFor(() => expect(screen.getAllByText('Jane Vendor').length).toBeGreaterThan(0));
    expect(parent.postMessage).toHaveBeenCalledWith({ type: 'mt:profile-preview-ready' }, window.location.origin);

    window.dispatchEvent(new MessageEvent('message', { origin: 'https://evil.example', data: { type: 'mt:profile-draft', host: { name: 'Hacked' } } }));
    window.dispatchEvent(new MessageEvent('message', { origin: window.location.origin, data: { type: 'mt:profile-draft', host: { name: 'Jane Draft' } } }));
    await waitFor(() => expect(screen.getAllByText('Jane Draft').length).toBeGreaterThan(0));
    expect(screen.queryByText('Hacked')).toBeNull();
    expect(recordProfileView).not.toHaveBeenCalled();
    expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex');
  });
});

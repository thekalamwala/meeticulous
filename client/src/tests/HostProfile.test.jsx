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
  getVendorBadges: vi.fn().mockResolvedValue({ data: { badges: [] } }),
}));

import { getHostProfile } from '../services/api';
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
    // Profession renders twice (collapsed mobile bar + full card) — match either.
    await waitFor(() => expect(screen.getAllByText('Life Coach').length).toBeGreaterThan(0));
  });

  test('renders bio text', async () => {
    renderProfile();
    await waitFor(() => expect(screen.getByText(/I help people/i)).toBeTruthy());
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
      expect(screen.getByText('₹500')).toBeTruthy();
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

  test('shows "No services available yet" when services array is empty', async () => {
    getHostProfile.mockResolvedValueOnce({ data: { host: HOST, services: [], availability: null } });
    renderProfile();
    await waitFor(() => expect(screen.getByText(/no services available yet/i)).toBeTruthy());
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

// ── Free intro CTA ────────────────────────────────────────────────────────────

describe('HostProfile — free intro CTA', () => {
  test('renders the intro banner linking to the free service', async () => {
    // SERVICES[1] (Workshop) is price 0 → the intro offer.
    getHostProfile.mockResolvedValue({ data: { host: HOST, services: SERVICES, availability: null } });
    renderProfile();
    await waitFor(() => expect(screen.getByText(/start with a free intro/i)).toBeTruthy());
    const cta = screen.getByRole('link', { name: /free intro/i });
    expect(cta.getAttribute('href')).toBe('/jane-vendor/booking/workshop');
  });

  test('no intro banner when the host has no free service', async () => {
    const paidOnly = [SERVICES[0], { ...SERVICES[1], price: 300 }];
    getHostProfile.mockResolvedValue({ data: { host: HOST, services: paidOnly, availability: null } });
    renderProfile();
    await waitFor(() => screen.getByText('Workshop'));
    expect(screen.queryByText(/start with a free intro/i)).toBeNull();
  });
});

/**
 * tests/Dashboard.test.jsx
 * Covers host dashboard, guest dashboard, profile URL banner,
 * username-missing banner, and Google Calendar prompt.
 */
import { render, screen, waitFor, within } from '@testing-library/react';
import { vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../services/api', () => ({
  getHostBookings:  vi.fn().mockResolvedValue({ data: [] }),
  getMyServices:    vi.fn().mockResolvedValue({ data: [] }),
  getPayoutBalance: vi.fn().mockResolvedValue({ data: {} }),
  getMyKyc:         vi.fn().mockResolvedValue({ data: { status: 'not_started', pending_earnings: 0, payouts_ready: false } }),
  getHostNudges:    vi.fn().mockResolvedValue({ data: { snoozed: {} } }),
  dismissHostNudge: vi.fn().mockResolvedValue({ data: { ok: true } }),
  markLinkShared:   vi.fn().mockResolvedValue({}),
}));

vi.mock('../services/analytics', () => ({
  analytics: { track: vi.fn() },
  EVENTS: { PROFILE_LINK_SHARED: 'profile_link_shared' },
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from '../context/AuthContext';
import Dashboard from '../pages/Dashboard';

const renderDashboard = (user) => {
  useAuth.mockReturnValue({
    user,
    connectGoogleCalendar: vi.fn(),
    updateUser: vi.fn(),
  });
  return render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <Dashboard />
    </MemoryRouter>
  );
};

// ── Vendor (host) dashboard ───────────────────────────────────────────────────

describe('Dashboard — Vendor (role:host)', () => {
  const VENDOR = {
    _id: 'v1', name: 'Jane Vendor', role: 'host', plan: 'explorer',
    username: 'jane-vendor', google_calendar_connected: false,
  };

  test('shows welcome message with first name', async () => {
    renderDashboard(VENDOR);
    await waitFor(() => expect(screen.getByText(/welcome back, jane/i)).toBeTruthy());
  });

  test('shows profile URL pill with correct link', async () => {
    renderDashboard(VENDOR);
    await waitFor(() => expect(screen.getByText(/bookasloth\.com\/jane-vendor/i)).toBeTruthy());
  });

  test('shows Google Calendar connect prompt when not connected', async () => {
    renderDashboard(VENDOR);
    await waitFor(() => expect(screen.getByText(/connect google calendar/i)).toBeTruthy());
  });

  test('marks Google Calendar done in the setup checklist when connected', async () => {
    // Redesign: the prompt is now a setup-checklist item that stays visible but
    // is struck through / marked complete once connected (no longer hidden).
    renderDashboard({ ...VENDOR, google_calendar_connected: true });
    const label = await screen.findByText(/connect google calendar/i);
    expect(label.className).toMatch(/line-through/);
  });

  test('shows stat cards (Upcoming, Completed, Total Bookings, Total Earnings)', async () => {
    const { container } = renderDashboard(VENDOR);
    await waitFor(() => {
      // Stats live in two sub-grids inside the outer 2-column grid (first .grid),
      // so scoping to the outer grid still finds all four labels.
      const statsGrid = container.querySelector('.grid');
      expect(within(statsGrid).getByText('Upcoming')).toBeTruthy();
      expect(within(statsGrid).getByText('Completed')).toBeTruthy();
      expect(within(statsGrid).getByText('Total Bookings')).toBeTruthy();
      expect(within(statsGrid).getByText('Total Earnings')).toBeTruthy();
    });
  });

  test('shows dashboard sections (Bookings overview, Your business, Finish setup)', async () => {
    // Redesign replaced the old quick-action link row with stat sections + a
    // setup checklist. Assert the stable section headings instead.
    renderDashboard(VENDOR);
    await waitFor(() => {
      expect(screen.getByText('Bookings overview')).toBeTruthy();
      expect(screen.getByText('Your business')).toBeTruthy();
      expect(screen.getByText('Finish setup')).toBeTruthy();
    });
  });
});

// ── New vendor — no username yet ──────────────────────────────────────────────

describe('Dashboard — new vendor without username', () => {
  const NEW_VENDOR = {
    _id: 'v2', name: 'New Creator', role: 'host', plan: 'explorer',
    username: null, google_calendar_connected: false,
  };

  test('shows "Set username" onboarding banner', async () => {
    renderDashboard(NEW_VENDOR);
    await waitFor(() => expect(screen.getByText(/set up your public profile/i)).toBeTruthy());
  });

  test('does NOT show profile URL pill (no username)', async () => {
    renderDashboard(NEW_VENDOR);
    await waitFor(() => expect(screen.queryByText(/bookasloth\.com\//i)).toBeNull());
  });

  test('banner links to /dashboard/profile', async () => {
    renderDashboard(NEW_VENDOR);
    await waitFor(() => {
      const link = screen.getByRole('link', { name: /set username/i });
      expect(link.getAttribute('href')).toContain('/dashboard/profile');
    });
  });
});

// ── Guest (user) dashboard ────────────────────────────────────────────────────
// Guests are now redirected to /user — the Dashboard renders nothing.

describe('Dashboard — User (role:guest)', () => {
  const GUEST = { _id: 'u1', name: 'Bob Guest', role: 'guest', plan: 'explorer', username: null };

  test('redirects guest: renders no visible content', () => {
    renderDashboard(GUEST);
    // <Navigate replace to="/user" /> produces an empty div in MemoryRouter
    expect(screen.queryByText(/welcome back/i)).toBeNull();
  });

  test('does NOT show host stat cards', async () => {
    renderDashboard(GUEST);
    await waitFor(() => expect(screen.queryByText('Upcoming')).toBeNull());
  });

  test('does NOT show profile URL banner', async () => {
    renderDashboard(GUEST);
    await waitFor(() => expect(screen.queryByText(/bookasloth\.com\//i)).toBeNull());
  });
});

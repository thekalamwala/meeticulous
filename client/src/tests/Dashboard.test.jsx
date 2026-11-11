/**
 * tests/Dashboard.test.jsx
 * Covers the reference Overview layout: greeting, summary cards, the exact
 * 11 dummy bookings, profile-completion panel, week/month calendar controls,
 * sidebar order and the new-meeting entry point.
 */
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../services/api', () => ({
  getPayoutBalance: vi.fn(() => Promise.resolve({ data: { available: 0, clearing: 0, pendingCompletion: 0 } })),
  // Default: the host has NO bookings (empty state). Individual tests override
  // with real-shaped bookings to exercise the calendar/counts.
  getHostBookings: vi.fn(() => Promise.resolve({ data: [] })),
  getMyServices: vi.fn(() => Promise.resolve({ data: [] })),
  getHostNudges: vi.fn(() => Promise.resolve({ data: { snoozed: {}, commissionPaid: 0 } })),
  getNotifications: vi.fn(() => Promise.resolve({ data: { notifications: [], unreadCount: 0 } })),
  getNotificationChannel: vi.fn(() => Promise.resolve({ data: {} })),
  markAllNotificationsRead: vi.fn(() => Promise.resolve({ data: {} })),
  markNotificationRead: vi.fn(() => Promise.resolve({ data: {} })),
  markLinkShared: vi.fn(() => Promise.resolve({})),
}));
import * as api from '../services/api';

// Mirror the component's Mon-first week anchor so date assertions aren't tied to
// a hardcoded calendar — the dashboard shows the *current* week now.
const startOfWeek = (base) => {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  const dow = (d.getDay() + 6) % 7;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - dow);
};
const MONDAY = startOfWeek(new Date());
const dayInWeek = (offset, h = 11, m = 0) => {
  const d = new Date(MONDAY);
  d.setDate(d.getDate() + offset);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
};
const fmtDay = (d) => `${d.getDate()} ${d.toLocaleDateString('en-GB', { month: 'short' })}`;

vi.mock('react-hot-toast', () => ({
  default: Object.assign(() => {}, { success: () => {}, error: () => {} }),
}));

const { auth } = vi.hoisted(() => ({ auth: { user: null } }));
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: auth.user, logout: vi.fn(), updateUser: vi.fn() }),
}));

import Dashboard from '../pages/Dashboard';
import OverviewLayout from '../components/common/OverviewLayout';

const HOST = {
  id: 'h1', name: 'Mohini Daf', email: 'mohini@example.com', role: 'host',
  is_host: true, plan: 'premium', username: 'mohini', kyc_status: 'approved',
  onboarding_completed: true, google_calendar_connected: true,
};

const renderPage = (user = HOST) => {
  auth.user = user;
  return render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <Dashboard />
    </MemoryRouter>,
  );
};

const renderShell = (user = HOST) => {
  auth.user = user;
  return render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <OverviewLayout><Dashboard /></OverviewLayout>
    </MemoryRouter>,
  );
};

beforeEach(() => { auth.user = HOST; api.getHostBookings.mockResolvedValue({ data: [] }); });

describe('Overview — real-data content', () => {
  it('greets the host and shows the reference subtitle', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: /good afternoon, mohini!/i })).toBeInTheDocument();
    expect(screen.getByText("Here's what's happening with your business today.")).toBeInTheDocument();
  });

  it('shows the three summary cards; money reads the real payout balance once loaded', async () => {
    renderPage();
    expect(screen.getByText('Available to withdraw')).toBeInTheDocument();
    expect(screen.getByText('Upcoming bookings')).toBeInTheDocument();
    expect(screen.getByText('Completed bookings')).toBeInTheDocument();
    // The clearing/pending labels are always present; the amounts fill in once
    // the balance resolves (available + clearing + pending = three ₹0.00 nodes).
    expect(screen.getByText('clearing')).toBeInTheDocument();
    expect(screen.getByText('pending')).toBeInTheDocument();
    expect((await screen.findAllByText('₹0.00')).length).toBeGreaterThanOrEqual(3);
  });

  it('shows an error state (not the empty state) when bookings fail to load', async () => {
    api.getHostBookings.mockRejectedValueOnce(new Error('network down'));
    renderPage();
    expect(await screen.findByText("Couldn't load your bookings")).toBeInTheDocument();
    // Critically: a failed fetch must NOT masquerade as "no bookings".
    expect(screen.queryByText('No bookings this week')).toBeNull();
    // And counts read '—' (unavailable), never a fabricated 0.
    const upcoming = screen.getByText('Upcoming bookings').closest('div').parentElement;
    expect(within(upcoming).getByText('—')).toBeInTheDocument();
  });

  it('shows the unavailable balance as — rather than ₹0.00 when it fails', async () => {
    api.getPayoutBalance.mockRejectedValueOnce(new Error('network down'));
    renderPage();
    expect(await screen.findByText('No bookings this week')).toBeInTheDocument(); // bookings resolved []
    // Balance never resolved → figures render as '—', not a misleading ₹0.00.
    const withdraw = screen.getByText('Available to withdraw').closest('div').parentElement;
    expect(within(withdraw).getAllByText('—').length).toBeGreaterThan(0);
    expect(within(withdraw).queryByText('₹0.00')).toBeNull();
  });

  it('derives upcoming/completed counts from the real bookings', async () => {
    api.getHostBookings.mockResolvedValueOnce({ data: [
      { id: 'u1', guest_name: 'A', scheduled_at: dayInWeek(10), status: 'confirmed' }, // future
      { id: 'u2', guest_name: 'B', scheduled_at: dayInWeek(11), status: 'confirmed' }, // future
      { id: 'c1', guest_name: 'C', scheduled_at: dayInWeek(-20), status: 'completed' }, // past, completed
    ] });
    renderPage();
    const upcoming = (await screen.findByText('Upcoming bookings')).closest('div').parentElement;
    await waitFor(() => expect(within(upcoming).getByText('2')).toBeInTheDocument());
    const completed = screen.getByText('Completed bookings').closest('div').parentElement;
    expect(within(completed).getByText('1')).toBeInTheDocument();
  });

  it('renders the host\'s real bookings on the calendar (no dummy data)', async () => {
    api.getHostBookings.mockResolvedValueOnce({ data: [
      { id: 'r1', guest_name: 'Aarav Mehta', scheduled_at: dayInWeek(2, 11, 0), status: 'confirmed', services: { duration: 60 } },
    ] });
    renderPage();
    expect(await screen.findByText('Aarav Mehta')).toBeInTheDocument();
    expect(screen.getByTitle(/Aarav Mehta · 11:00 am - 12:00 pm/)).toBeInTheDocument();
    // None of the old fabricated names leak in.
    expect(screen.queryByText('Kabir Mehta')).toBeNull();
  });

  it('shows a clean empty state when the host has no bookings', async () => {
    renderPage(); // default mock: []
    expect(await screen.findByText('No bookings this week')).toBeInTheDocument();
    // The calendar chrome is still present (layout preserved).
    expect(screen.getByRole('heading', { name: 'Calendar' })).toBeInTheDocument();
  });

  it('labels the current week', () => {
    renderPage();
    const sunday = new Date(MONDAY); sunday.setDate(sunday.getDate() + 6);
    expect(screen.getByText(`${fmtDay(MONDAY)} – ${fmtDay(sunday)} ${sunday.getFullYear()}`)).toBeInTheDocument();
    ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
      .forEach((day) => expect(screen.getByText(day)).toBeInTheDocument());
  });

  // Profile-completion rocket is parked (hidden in the toolbar, code kept).
  it('does not render the profile-completion rocket in the toolbar', () => {
    renderShell();
    expect(screen.queryByRole('button', { name: 'Profile completion' })).toBeNull();
    expect(screen.queryByText('Complete Your Profile')).toBeNull();
  });
});

describe('Overview — sidebar shell', () => {
  it('keeps the original two-level ConsoleSidebar (rail sections + panel) with Overview active', () => {
    renderShell();
    // Rail: the six existing section buttons, in order — NOT the flat pink sidebar.
    const rail = screen.getByRole('navigation', { name: 'Sections' });
    const sections = within(rail).getAllByRole('button').map((b) => b.getAttribute('aria-label'));
    expect(sections).toEqual(['Overview', 'Bookings', 'Catalog', 'Earnings', 'Chat', 'Settings']);
    // Panel: the active Overview page is current.
    const panel = screen.getByRole('navigation', { name: /overview pages/i });
    expect(within(panel).getByRole('link', { name: 'Overview' })).toHaveAttribute('aria-current', 'page');
  });

  it('switches between week and month views and steps the range', () => {
    renderPage();
    const monthLabel = (offset) =>
      new Date(new Date().getFullYear(), new Date().getMonth() + offset, 1)
        .toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    const weekLabel = (weeks) => {
      const mon = new Date(MONDAY); mon.setDate(mon.getDate() + weeks * 7);
      const sun = new Date(mon); sun.setDate(sun.getDate() + 6);
      return `${fmtDay(mon)} – ${fmtDay(sun)} ${sun.getFullYear()}`;
    };

    fireEvent.click(screen.getByRole('button', { name: 'This Month' }));
    expect(screen.getByText(monthLabel(0))).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
    expect(screen.getByText(monthLabel(1))).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'This Week' }));
    expect(screen.getByText(weekLabel(0))).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next week' }));
    expect(screen.getByText(weekLabel(1))).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Previous week' }));
    expect(screen.getByText(weekLabel(0))).toBeInTheDocument();
  });

  it('has no search bar, no new-booking button or rocket, and keeps the remaining toolbar actions', () => {
    renderShell();
    // The "Search anything..." bar was removed from the toolbar.
    expect(screen.queryByRole('searchbox')).toBeNull();
    expect(screen.queryByPlaceholderText('Search anything...')).toBeNull();
    // Add-a-new-booking button and the profile-completion rocket are parked (hidden).
    expect(screen.queryByRole('button', { name: /add a new booking/i })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Profile completion' })).toBeNull();
    // The remaining actions stay present and functional.
    expect(screen.getByRole('button', { name: /notifications/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Profile menu' })).toBeInTheDocument();
  });
});

describe('Overview — access', () => {
  it('renders nothing for a guest (redirects to /user)', () => {
    renderPage({ name: 'Bob Guest', role: 'guest', is_host: false });
    expect(screen.queryByText(/good afternoon/i)).toBeNull();
  });
});

describe('Overview — DEV preview mode', () => {
  it('shows sample bookings + payout WITHOUT calling the API', async () => {
    vi.stubEnv('VITE_UI_PREVIEW', 'true');
    api.getHostBookings.mockClear();
    api.getPayoutBalance.mockClear();
    try {
      renderPage();
      // A preview booking appears on the current-week calendar…
      expect(await screen.findByText('Ananya Iyer')).toBeInTheDocument();
      // …and neither data endpoint was hit.
      expect(api.getHostBookings).not.toHaveBeenCalled();
      expect(api.getPayoutBalance).not.toHaveBeenCalled();
    } finally {
      vi.stubEnv('VITE_UI_PREVIEW', '');
    }
  });
});

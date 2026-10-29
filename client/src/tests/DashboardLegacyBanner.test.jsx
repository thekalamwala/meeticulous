import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, test, expect, beforeEach } from 'vitest';

vi.mock('../services/api', () => ({
  getHostBookings: vi.fn(() => Promise.resolve({ data: [] })),
  getMyServices: vi.fn(() => Promise.resolve({ data: [] })),
  getGuestBookings: vi.fn(() => Promise.resolve({ data: [] })),
  getPayoutBalance: vi.fn(() => Promise.resolve({ data: {} })),
  getMyKyc: vi.fn(() => Promise.resolve({ data: { status: 'not_started', pending_earnings: 0, payouts_ready: false } })),
  getHostNudges: vi.fn(() => Promise.resolve({ data: { snoozed: {} } })),
  dismissHostNudge: vi.fn(() => Promise.resolve({ data: { ok: true } })),
  markLinkShared: vi.fn(() => Promise.resolve({})),
}));
vi.mock('../services/analytics', () => ({
  analytics: { track: vi.fn() },
  EVENTS: { PROFILE_LINK_SHARED: 'profile_link_shared' },
}));
vi.mock('react-hot-toast', () => ({ default: Object.assign(() => {}, { success: () => {}, error: () => {} }) }));

let mockUser;
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: mockUser, connectGoogleCalendar: vi.fn(), updateUser: vi.fn() }),
}));

import Dashboard from '../pages/Dashboard';
import { dismissHostNudge } from '../services/api';

const legacy = { name: 'Asha', role: 'host', plan: 'creator', subscription_status: 'active', has_payment_mandate: false };

const renderDash = () => render(<MemoryRouter><Dashboard /></MemoryRouter>);

beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); });

test('shows the auto-renew banner for a legacy paid vendor (no mandate)', async () => {
  mockUser = legacy;
  renderDash();
  await waitFor(() => expect(screen.getByText(/won't auto-renew/i)).toBeInTheDocument());
  expect(screen.getByRole('link', { name: /Set up auto-renew/i })).toBeInTheDocument();
});

test('hides the banner once a mandate exists', async () => {
  mockUser = { ...legacy, has_payment_mandate: true };
  renderDash();
  await waitFor(() => screen.getByText(/Welcome back/i));
  expect(screen.queryByText(/won't auto-renew/i)).not.toBeInTheDocument();
});

test('dismiss hides the banner and persists it server-side', async () => {
  mockUser = legacy;
  renderDash();
  await waitFor(() => screen.getByText(/won't auto-renew/i));
  fireEvent.click(screen.getByLabelText('Dismiss'));
  expect(screen.queryByText(/won't auto-renew/i)).not.toBeInTheDocument();
  // Server-tracked now (host_nudges), so a dismiss sticks across devices — no localStorage.
  expect(dismissHostNudge).toHaveBeenCalledWith('legacy');
});

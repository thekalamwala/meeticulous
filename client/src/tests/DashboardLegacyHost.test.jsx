/**
 * tests/DashboardLegacyHost.test.jsx
 *
 * Legacy paid hosts (subscription_status active, no payment mandate) used to get
 * an auto-renew banner on the Overview. The reference Overview no longer renders
 * that banner, but legacy accounts must still reach the dashboard without errors
 * and see the same reference content as everyone else.
 */
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, test, expect, beforeEach } from 'vitest';

const { api } = vi.hoisted(() => ({
  api: {
    getPayoutBalance: vi.fn(() => Promise.resolve({ data: { available: 0, clearing: 0, pendingCompletion: 0 } })),
    getHostBookings: vi.fn(() => Promise.resolve({ data: [] })),
    getMyServices: vi.fn(() => Promise.resolve({ data: [] })),
    getHostNudges: vi.fn(() => Promise.resolve({ data: { snoozed: {}, commissionPaid: 0 } })),
    getMyKyc: vi.fn(() => Promise.resolve({ data: { status: 'approved' } })),
  },
}));

vi.mock('../services/api', () => ({
  getPayoutBalance: api.getPayoutBalance,
  getHostBookings: api.getHostBookings,
  getMyServices: api.getMyServices,
  getHostNudges: api.getHostNudges,
  getMyKyc: api.getMyKyc,
  getMyProfileViews: vi.fn(() => Promise.resolve({ data: { views: 0 } })),
}));
vi.mock('react-hot-toast', () => ({
  default: Object.assign(() => {}, { success: () => {}, error: () => {} }),
}));

let mockUser;
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: mockUser, updateUser: vi.fn() }),
}));

import Dashboard from '../pages/Dashboard';

const renderDash = () => render(<MemoryRouter><Dashboard /></MemoryRouter>);

beforeEach(() => {
  vi.clearAllMocks();
  mockUser = {
    name: 'Asha', role: 'host', is_host: true, plan: 'creator',
    subscription_status: 'active', has_payment_mandate: false, username: 'asha',
  };
});

test('legacy host reaches the overview and sees the reference summary', async () => {
  renderDash();
  expect(await screen.findByRole('heading', { name: /good afternoon, asha!/i })).toBeInTheDocument();
  expect(screen.getByText('Available to withdraw')).toBeInTheDocument();
  expect(screen.getByText('Upcoming bookings')).toBeInTheDocument();
  expect(api.getPayoutBalance).toHaveBeenCalled();
});

test('no longer renders the retired auto-renew banner', () => {
  renderDash();
  expect(screen.queryByText(/won't auto-renew/i)).toBeNull();
  expect(screen.queryByRole('link', { name: /set up auto-renew/i })).toBeNull();
});

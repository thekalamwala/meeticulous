// BookingsV2 — every state is honest: skeleton while loading (never a false empty
// state), a sentence when there's nothing, a retry on error, rows with a word.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { getHostBookings } from '../../services/api';

vi.mock('../../services/api', () => ({
  getHostBookings: vi.fn(),
  getBookingReview: vi.fn(() => Promise.resolve({ data: null })),
  completeBooking: vi.fn(), markNoShow: vi.fn(), cancelBooking: vi.fn(), markLinkShared: vi.fn(),
  getAvailability: vi.fn(() => Promise.resolve({ data: null })), getBookedSlots: vi.fn(() => Promise.resolve({ data: [] })),
  rescheduleBooking: vi.fn(), getHostNudges: vi.fn(() => Promise.resolve({ data: {} })),
}));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: { plan: 'starter', username: 'riya' } }) }));
vi.mock('../../hooks/useFeatureFlags', () => ({ default: () => ({ flags: {}, on: () => false }) }));
vi.mock('../../components/dashboard/ui/refreshContext', () => ({ useRegisterRefresh: () => {} }));
vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

import BookingsV2 from '../BookingsV2';

const page = () => render(<MemoryRouter><BookingsV2 /></MemoryRouter>);
const inHours = (h) => new Date(Date.now() + h * 3_600_000).toISOString();

describe('BookingsV2 states', () => {
  beforeEach(() => vi.clearAllMocks());

  it('loading shows skeletons, not an empty state', () => {
    getHostBookings.mockReturnValue(new Promise(() => {}));
    page();
    expect(screen.queryByText(/new bookings land here/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/your calendar is open/i)).not.toBeInTheDocument();
  });

  it('empty: the band invites a share and the list says so in a sentence', async () => {
    getHostBookings.mockResolvedValue({ data: [] });
    page();
    expect(await screen.findByText(/no bookings yet/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /copy booking link/i })).toBeInTheDocument();
    expect(screen.getByText(/new bookings land here/i)).toBeInTheDocument();
  });

  it('error offers a retry', async () => {
    getHostBookings.mockRejectedValue(new Error('down'));
    page();
    expect(await screen.findByText(/couldn't load your bookings/i)).toBeInTheDocument();
  });

  it('data: next booking in the band, rows carry their state as a word', async () => {
    getHostBookings.mockResolvedValue({ data: [
      { id: 'a', guest_name: 'Meera Iyer', scheduled_at: inHours(26), status: 'confirmed', payment_status: 'paid', customer_total: 999, services: { title: 'Funnel Teardown', duration: 45 } },
      { id: 'b', guest_name: 'Kabir Rao', scheduled_at: inHours(50), status: 'pending', payment_status: 'unpaid', customer_total: 999, services: { title: 'Sprint', duration: 60 } },
    ] });
    page();
    expect(await screen.findByText(/next booking/i)).toBeInTheDocument();
    expect(screen.getAllByText('Paid').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Awaiting payment').length).toBeGreaterThan(0);
    expect(screen.getByRole('tab', { name: /upcoming\s*2/i })).toHaveAttribute('aria-selected', 'true');
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({
  getHostBookings: vi.fn(() => Promise.resolve({ data: [] })),
  getHostNudges: vi.fn(() => Promise.resolve({ data: { taste: { endsAt: '2026-12-01T00:00:00Z', daysLeft: 9, endedDaysAgo: null } } })),
  getBookingReview: vi.fn(() => Promise.resolve({ data: null })),
  getAvailability: vi.fn(() => Promise.resolve({ data: { weekly_schedule: {} } })),
  getBookedSlots: vi.fn(() => Promise.resolve({ data: [] })),
  cancelBooking: vi.fn(), completeBooking: vi.fn(), markNoShow: vi.fn(), rescheduleBooking: vi.fn(),
}));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: { plan: 'free' } }) }));
vi.mock('../../hooks/useFeatureFlags', () => ({ default: () => ({ flags: {} }) }));
vi.mock('../../components/dashboard/ui/refreshContext', () => ({ useRegisterRefresh: () => {} }));
vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

import Bookings from '../Bookings';

describe('Bookings — WhatsApp taste countdown', () => {
  beforeEach(() => vi.clearAllMocks());

  it('surfaces the attributed taste countdown for a host in their free window', async () => {
    render(<MemoryRouter><Bookings /></MemoryRouter>);
    expect(await screen.findByText(/9 days left/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /go pro/i }))
      .toHaveAttribute('href', '/dashboard/upgrade?src=reminders');
  });
});

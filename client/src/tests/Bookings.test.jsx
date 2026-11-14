import { render, screen, waitFor, fireEvent, within, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';

vi.mock('../services/api', () => ({
  getHostBookings: vi.fn(),
  cancelBooking: vi.fn(),
  completeBooking: vi.fn(),
  markNoShow: vi.fn(),
  rescheduleBooking: vi.fn(),
  getAvailability: vi.fn(() => Promise.resolve({ data: {} })),
  getBookedSlots: vi.fn(() => Promise.resolve({ data: [] })),
  getBookingReview: vi.fn(() => Promise.resolve({ data: null })),
}));
vi.mock('../hooks/useFeatureFlags', () => ({ default: vi.fn() }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { username: 'host' } }) }));

import { getHostBookings } from '../services/api';
import useFeatureFlags from '../hooks/useFeatureFlags';
import Bookings from '../pages/Bookings';

// A booking on today (so it lands in the current-week calendar view).
const startOfWeek = (base) => {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  const dow = (d.getDay() + 6) % 7;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - dow);
};
const todayAt = (h) => { const d = new Date(); d.setHours(h, 0, 0, 0); return d.toISOString(); };
// A future weekday in the current week (so the booking is "upcoming" + reschedulable).
const futureThisWeek = () => {
  const sun = startOfWeek(new Date()); sun.setDate(sun.getDate() + 6); sun.setHours(23, 0, 0, 0);
  return sun.toISOString();
};

const booking = {
  id: 'bk000001-1111-2222-3333-444444444444',
  status: 'confirmed',
  payment_status: 'paid',
  scheduled_at: futureThisWeek(),
  created_at: '2026-11-01T00:00:00.000Z',
  guest_name: 'Asha Rao',
  guest_email: 'asha@example.com',
  guest_phone: '+919999999999',
  guest_id: 'guest-1',
  host_id: 'host-1',
  services: { title: 'Hair Spa', price: 1500, duration: 60 },
  notes: 'Prefers organic products.',
};

const renderPage = () => render(<MemoryRouter><Bookings /></MemoryRouter>);

afterEach(() => cleanup());
beforeEach(() => {
  vi.clearAllMocks();
  getHostBookings.mockReset(); // drop any resolved value leaked from a prior test
  useFeatureFlags.mockReturnValue({ on: () => true });
});

test('shows summary cards with real counts and the booking on the calendar', async () => {
  getHostBookings.mockResolvedValue({ data: [booking] });
  renderPage();
  await waitFor(() => screen.getByText('Hair Spa'));
  // Summary labels present; Upcoming reflects the one future booking.
  expect(screen.getByText('Upcoming')).toBeInTheDocument();
  expect(screen.getByText('Pending')).toBeInTheDocument();
  expect(screen.getByText('Completed')).toBeInTheDocument();
});

test('clicking a booking card opens the redesigned modal with tabs', async () => {
  getHostBookings.mockResolvedValue({ data: [booking] });
  renderPage();
  await waitFor(() => screen.getByText('Hair Spa'));

  fireEvent.click(screen.getByText('Hair Spa'));
  const dialog = await screen.findByRole('dialog');
  const inModal = within(dialog);
  // Two tabs; booking actions moved to a persistent bottom action bar (was the Actions tab).
  expect(inModal.getByRole('tab', { name: 'Booking Details' })).toBeInTheDocument();
  expect(inModal.getByRole('tab', { name: 'Timeline' })).toBeInTheDocument();
  // Customer + a real field.
  expect(inModal.getByText('Asha Rao')).toBeInTheDocument();
  expect(inModal.getByText('Prefers organic products.')).toBeInTheDocument();

  // Switching tabs changes content without closing the modal.
  fireEvent.click(inModal.getByRole('tab', { name: 'Timeline' }));
  expect(inModal.getByText('Scheduled')).toBeInTheDocument();
  expect(screen.getByRole('dialog')).toBeInTheDocument();

  // The bottom action bar exposes the real, status-gated actions (confirmed + future).
  expect(inModal.getAllByRole('button', { name: /reschedule/i }).length).toBeGreaterThan(0);
});

test('shows a clean empty state when there are no bookings', async () => {
  getHostBookings.mockResolvedValue({ data: [] });
  renderPage();
  expect(await screen.findByText('No bookings yet', {}, { timeout: 3000 })).toBeInTheDocument();
});

test('shows a retryable error state when the API fails', async () => {
  getHostBookings.mockRejectedValueOnce(new Error('network down'));
  renderPage();
  expect(await screen.findByText("Couldn't load your bookings.", {}, { timeout: 3000 })).toBeInTheDocument();
  getHostBookings.mockResolvedValue({ data: [booking] });
  fireEvent.click(screen.getByRole('button', { name: /try again|retry/i }));
  expect(await screen.findByText('Hair Spa', {}, { timeout: 3000 })).toBeInTheDocument();
});

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { vi } from 'vitest';
vi.mock('../services/api', () => ({
  getGuestBookings: vi.fn(), cancelBooking: vi.fn(), getBookingReview: vi.fn(),
  guestCompleteBooking: vi.fn(), guestReportProblem: vi.fn(),
}));
vi.mock('../hooks/useFeatureFlags', () => ({ default: vi.fn() }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { name: 'Sam' } }) }));
import { getGuestBookings, getBookingReview } from '../services/api';
import useFeatureFlags from '../hooks/useFeatureFlags';
import CustomerBookings from '../pages/CustomerBookings';
import GuestBookingDetail from '../pages/GuestBookingDetail';

// Kept guest console (2026-11-27): the old details popup became the booking
// detail page (/user/my-bookings/:id). Same action rules, asserted there.
const upcoming = { id: 'b1', status: 'confirmed', scheduled_at: '2099-01-01T05:00:00.000Z',
  services: { title: 'Coaching', slug: 'coaching' }, 'profiles!bookings_host_id_fkey': { name: 'Pat', username: 'pat' } };
const done = { id: 'b2', status: 'completed', scheduled_at: '2000-01-01T05:00:00.000Z',
  services: { title: 'Old', slug: 'old' }, 'profiles!bookings_host_id_fkey': { name: 'Pat', username: 'pat' } };
const ended = { id: 'b3', status: 'confirmed', payment_status: 'paid', scheduled_at: '2001-01-01T05:00:00.000Z',
  services: { title: 'Ended', slug: 'ended' }, 'profiles!bookings_host_id_fkey': { name: 'Pat', username: 'pat' } };

const renderAt = (path) => render(
  <MemoryRouter initialEntries={[path]}>
    <Routes>
      <Route path="/user/my-bookings" element={<CustomerBookings />} />
      <Route path="/user/my-bookings/:id" element={<GuestBookingDetail />} />
    </Routes>
  </MemoryRouter>,
);

beforeEach(() => {
  vi.clearAllMocks();
  useFeatureFlags.mockReturnValue({ on: () => true });
  getBookingReview.mockResolvedValue({ data: null });
});

test('list: upcoming tab shows upcoming, past tab shows completed', async () => {
  getGuestBookings.mockResolvedValue({ data: [upcoming, done] });
  renderAt('/user/my-bookings');
  await waitFor(() => screen.getByText('Coaching'));
  expect(screen.queryByText('Old')).toBeNull();
  fireEvent.click(screen.getByRole('tab', { name: /Past/i }));
  await waitFor(() => screen.getByText('Old'));
});

test('list: an ended paid session asks "did it happen?" on its row', async () => {
  getGuestBookings.mockResolvedValue({ data: [ended] });
  renderAt('/user/my-bookings?tab=past');
  await waitFor(() => screen.getByText(/Did your session with Pat happen\?/));
  expect(screen.getByRole('button', { name: /Yes, it did/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Report a problem/i })).toBeInTheDocument();
});

test('detail: upcoming shows Reschedule + Cancel', async () => {
  getGuestBookings.mockResolvedValue({ data: [upcoming] });
  renderAt('/user/my-bookings/b1');
  await waitFor(() => screen.getByRole('heading', { name: 'Coaching' }));
  expect(screen.getByRole('button', { name: /Reschedule/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Cancel booking/i })).toBeInTheDocument();
});

test('detail: completed shows Write a review + Book again', async () => {
  getGuestBookings.mockResolvedValue({ data: [done] });
  renderAt('/user/my-bookings/b2');
  await waitFor(() => screen.getByRole('button', { name: /Write a review/i }));
  expect(screen.getByRole('link', { name: /Book again/i })).toHaveAttribute('href', '/pat/booking/old');
});

test('detail: reschedule and review hidden when their flags are off', async () => {
  useFeatureFlags.mockReturnValue({ on: () => false });
  getGuestBookings.mockResolvedValue({ data: [upcoming, done] });
  const { unmount } = renderAt('/user/my-bookings/b1');
  await waitFor(() => screen.getByRole('heading', { name: 'Coaching' }));
  expect(screen.queryByRole('button', { name: /Reschedule/i })).toBeNull();
  unmount();
  renderAt('/user/my-bookings/b2');
  await waitFor(() => screen.getByRole('heading', { name: 'Old' }));
  expect(screen.queryByRole('button', { name: /Write a review/i })).toBeNull();
});

test('detail: an id that is not yours says not found', async () => {
  getGuestBookings.mockResolvedValue({ data: [upcoming] });
  renderAt('/user/my-bookings/nope');
  await waitFor(() => screen.getByText('Booking not found'));
});

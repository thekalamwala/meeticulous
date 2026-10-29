import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
vi.mock('../services/api', () => ({
  getGuestBookings: vi.fn(), cancelBooking: vi.fn(), getBookingReview: vi.fn(),
}));
vi.mock('../hooks/useFeatureFlags', () => ({ default: vi.fn() }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { name: 'Sam' } }) }));
import { getGuestBookings, getBookingReview } from '../services/api';
import useFeatureFlags from '../hooks/useFeatureFlags';
import CustomerBookings from '../pages/CustomerBookings';

const upcoming = { id: 'b1', status: 'confirmed', scheduled_at: '2099-01-01T05:00:00.000Z',
  services: { title: 'Coaching', slug: 'coaching' }, 'profiles!bookings_host_id_fkey': { name: 'Pat', username: 'pat' } };
const done = { id: 'b2', status: 'completed', scheduled_at: '2000-01-01T05:00:00.000Z',
  services: { title: 'Old', slug: 'old' }, 'profiles!bookings_host_id_fkey': { name: 'Pat', username: 'pat' } };

const renderPage = () => render(<MemoryRouter><CustomerBookings /></MemoryRouter>);

beforeEach(() => {
  vi.clearAllMocks();
  useFeatureFlags.mockReturnValue({ on: () => true });
});

// Per-booking actions now live inside the Details modal (not inline on the card).
test('upcoming → Details modal shows Reschedule + Cancel', async () => {
  getGuestBookings.mockResolvedValue({ data: [upcoming] });
  getBookingReview.mockResolvedValue({ data: null });
  renderPage();
  // Upcoming booking now appears twice: the "next session" hero + the list row.
  await waitFor(() => screen.getAllByText('Coaching'));
  fireEvent.click(screen.getAllByRole('button', { name: /Details/i })[0]);
  await waitFor(() => screen.getByText('Booking details'));
  expect(screen.getByRole('button', { name: /Reschedule/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Cancel booking/i })).toBeInTheDocument();
});

test('completed → Details modal shows Write a review + Rebook', async () => {
  getGuestBookings.mockResolvedValue({ data: [done] });
  getBookingReview.mockResolvedValue({ data: null });
  renderPage();
  await waitFor(() => screen.getByText('Old'));
  fireEvent.click(screen.getByRole('button', { name: /Details/i }));
  await waitFor(() => screen.getByText('Booking details'));
  expect(screen.getByRole('button', { name: /Write a review/i })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Rebook/i })).toBeInTheDocument();
});

test('reschedule hidden in Details when flag off', async () => {
  useFeatureFlags.mockReturnValue({ on: () => false });
  getGuestBookings.mockResolvedValue({ data: [upcoming] });
  getBookingReview.mockResolvedValue({ data: null });
  renderPage();
  await waitFor(() => screen.getAllByText('Coaching'));
  fireEvent.click(screen.getAllByRole('button', { name: /Details/i })[0]);
  await waitFor(() => screen.getByText('Booking details'));
  expect(screen.queryByRole('button', { name: /Reschedule/i })).toBeNull();
});

test('review button hidden in Details when review flag off', async () => {
  useFeatureFlags.mockReturnValue({ on: () => false });
  getGuestBookings.mockResolvedValue({ data: [done] });
  getBookingReview.mockResolvedValue({ data: null });
  renderPage();
  await waitFor(() => screen.getByText('Old'));
  fireEvent.click(screen.getByRole('button', { name: /Details/i }));
  await waitFor(() => screen.getByText('Booking details'));
  expect(screen.queryByRole('button', { name: /Write a review/i })).toBeNull();
});

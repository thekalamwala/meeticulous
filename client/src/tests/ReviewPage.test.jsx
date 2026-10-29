/**
 * tests/ReviewPage.test.jsx
 * Dedicated /review/:bookingId page reached from the booking-completed email.
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('../services/api', () => ({
  getGuestBookings: vi.fn(),
  getBookingReview: vi.fn(),
  createReview:     vi.fn(),
  updateReview:     vi.fn(),
}));

vi.mock('../hooks/useFeatureFlags', () => ({
  default: () => ({ on: () => true, flags: {}, loading: false }),
}));

import { getGuestBookings, getBookingReview, createReview, updateReview } from '../services/api';
import ReviewPage from '../pages/ReviewPage';

const booking = (over = {}) => ({
  id: 'b1',
  status: 'completed',
  scheduled_at: '2026-06-01T10:00:00Z',
  services: { title: 'Consultation' },
  'profiles!bookings_host_id_fkey': { name: 'Jane', username: 'jane' },
  ...over,
});

const renderAt = (id = 'b1') =>
  render(
    <MemoryRouter initialEntries={[`/review/${id}`]}>
      <Routes>
        <Route path="/review/:bookingId" element={<ReviewPage />} />
      </Routes>
    </MemoryRouter>
  );

beforeEach(() => {
  vi.clearAllMocks();
});

test('renders the form for a completed, unreviewed booking and submits with the right payload', async () => {
  getGuestBookings.mockResolvedValue({ data: [booking()] });
  getBookingReview.mockResolvedValue({ data: null });
  createReview.mockResolvedValue({ data: { id: 'r1' } });

  renderAt('b1');

  expect(await screen.findByRole('heading', { name: /leave a review/i })).toBeInTheDocument();
  expect(screen.getByText(/Consultation/)).toBeInTheDocument();
  expect(screen.getByText(/Jane/)).toBeInTheDocument();

  await userEvent.click(screen.getByLabelText('Rate 5 stars'));
  await userEvent.click(screen.getByRole('button', { name: /submit review/i }));

  await waitFor(() =>
    expect(createReview).toHaveBeenCalledWith({
      booking_id: 'b1', rating: 5, comment: '', direction: 'guest_to_host',
    })
  );
  expect(await screen.findByText(/thank you/i)).toBeInTheDocument();
});

test('shows edit form (prefilled) when a review already exists', async () => {
  getGuestBookings.mockResolvedValue({ data: [booking()] });
  getBookingReview.mockResolvedValue({ data: { id: 'r1', rating: 4, comment: 'Great!' } });
  updateReview.mockResolvedValue({ data: { id: 'r1', rating: 4, comment: 'Great!' } });

  renderAt('b1');

  expect(await screen.findByRole('heading', { name: /edit your review/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /update review/i })).toBeInTheDocument();
  expect(createReview).not.toHaveBeenCalled();
});

test('shows a friendly error when the booking is not on the account', async () => {
  getGuestBookings.mockResolvedValue({ data: [] });

  renderAt('does-not-exist');

  expect(await screen.findByText(/couldn't find this booking/i)).toBeInTheDocument();
});

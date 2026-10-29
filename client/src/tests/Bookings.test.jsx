import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';

vi.mock('../services/api', () => ({
  getHostBookings: vi.fn(),
  cancelBooking: vi.fn(),
  completeBooking: vi.fn(),
  markNoShow: vi.fn(),
  rescheduleBooking: vi.fn(),
  getAvailability: vi.fn(),
  getBookedSlots: vi.fn(),
  getBookingReview: vi.fn(),
}));
vi.mock('../hooks/useFeatureFlags', () => ({ default: vi.fn() }));

import { getHostBookings, getBookingReview } from '../services/api';
import useFeatureFlags from '../hooks/useFeatureFlags';
import Bookings from '../pages/Bookings';

const mk = (idPrefix, iso, extra = {}) => ({
  id: `${idPrefix}-1111-2222-3333-444444444444`,
  status: 'confirmed',
  payment_status: 'paid',
  scheduled_at: iso,
  created_at: '2024-01-01T00:00:00.000Z',
  guest_name: `${idPrefix} guest`,
  guest_email: `${idPrefix}@example.com`,
  guest_phone: '+910000000000',
  services: { title: `${idPrefix} svc`, price: 500, duration: 30, meeting_mode: 'online' },
  ...extra,
});

// Server returns ascending scheduled_at; the page must present newest first.
const older = mk('old00000', '2020-01-01T05:00:00.000Z');
const mid   = mk('mid00000', '2050-06-15T05:00:00.000Z');
const newer = mk('new00000', '2099-12-31T05:00:00.000Z');

const renderPage = () => render(<MemoryRouter><Bookings /></MemoryRouter>);

beforeEach(() => {
  vi.clearAllMocks();
  useFeatureFlags.mockReturnValue({ on: () => true });
  getBookingReview.mockResolvedValue({ data: null });
});

test('every tab defaults to newest → oldest order', async () => {
  // Provided oldest-first (as the API delivers it).
  getHostBookings.mockResolvedValue({ data: [older, mid, newer] });
  renderPage();

  await waitFor(() => screen.getByText('#NEW00000'));
  const ids = screen.getAllByText(/^#(OLD|MID|NEW)00000$/).map((el) => el.textContent);
  expect(ids).toEqual(['#NEW00000', '#MID00000', '#OLD00000']);
});

test('row opens the redesigned details modal with all grouped sections', async () => {
  getHostBookings.mockResolvedValue({ data: [newer] });
  renderPage();

  await waitFor(() => screen.getByText('#NEW00000'));
  fireEvent.click(screen.getByRole('button', { name: /view details/i }));

  // Scope to the modal — section titles also exist as table column headers.
  const dialog = await screen.findByRole('dialog');
  const inModal = within(dialog);
  // Section titles render as <h4> headings (distinct from row labels like "Service").
  expect(inModal.getByRole('heading', { name: 'Schedule' })).toBeInTheDocument();
  expect(inModal.getByRole('heading', { name: 'Customer' })).toBeInTheDocument();
  expect(inModal.getByRole('heading', { name: 'Service' })).toBeInTheDocument();
  expect(inModal.getByRole('heading', { name: 'Payment' })).toBeInTheDocument();
  // A representative data point from a section is preserved.
  expect(inModal.getByText('new00000 guest')).toBeInTheDocument();
});

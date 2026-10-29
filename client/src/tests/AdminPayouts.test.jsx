import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { vi, test, expect, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import AdminPayouts from '../pages/admin/AdminPayouts';

// AdminPayouts reads useSearchParams, so it must render inside a Router.
const renderPayouts = () => render(<MemoryRouter><AdminPayouts /></MemoryRouter>);

vi.mock('../services/api', () => ({
  adminGetPayouts: vi.fn(() => Promise.resolve({ data: [
    { id: 'p1', amount: 500, status: 'pending', created_at: '2026-06-15T10:00:00Z',
      profiles: { name: 'Asha', username: 'asha', email: 'a@x.com' } },
  ] })),
  adminApprovePayout: vi.fn(() => Promise.resolve({ data: {} })),
  adminRejectPayout: vi.fn(() => Promise.resolve({ data: {} })),
  adminMarkPayoutPaid: vi.fn(() => Promise.resolve({ data: {} })),
  adminReleasePayoutRoute: vi.fn(() => Promise.resolve({ data: {} })),
}));
vi.mock('react-hot-toast', () => ({ default: Object.assign(() => {}, { success: () => {}, error: () => {} }) }));

import { adminApprovePayout, adminGetPayouts, adminReleasePayoutRoute } from '../services/api';

beforeEach(() => vi.clearAllMocks());

test('renders a pending payout row with vendor + amount', async () => {
  renderPayouts();
  await waitFor(() => expect(screen.getByText('Asha')).toBeInTheDocument());
  expect(screen.getByText(/500/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Approve' })).toBeInTheDocument();
});

test('approve calls the API', async () => {
  renderPayouts();
  await waitFor(() => screen.getByRole('button', { name: 'Approve' }));
  fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
  await waitFor(() => expect(adminApprovePayout).toHaveBeenCalledWith('p1'));
});

test('approved row exposes "Pay via Route" which calls the API', async () => {
  adminGetPayouts.mockResolvedValueOnce({ data: [
    { id: 'p2', amount: 900, status: 'approved', created_at: '2026-06-15T10:00:00Z',
      profiles: { name: 'Bina', username: 'bina', email: 'b@x.com' } },
  ] });
  renderPayouts();
  await waitFor(() => screen.getByRole('button', { name: 'Pay via Route' }));
  fireEvent.click(screen.getByRole('button', { name: 'Pay via Route' }));
  await waitFor(() => expect(adminReleasePayoutRoute).toHaveBeenCalledWith('p2'));
});

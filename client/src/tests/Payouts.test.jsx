import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import Payouts from '../pages/Payouts';

vi.mock('../services/api', () => ({
  getPayoutBalance: vi.fn(() => Promise.resolve({ data: { paidOut: 100, clearing: 300, pendingCompletion: 200 } })),
  getTransactions: vi.fn(() => Promise.resolve({ data: { data: [
    { id: 'b1', services: { title: 'Consult' }, guest_name: 'Asha', vendor_amount: 500, razorpay_transfer_id: 'trf_1', transfer_status: 'processed', transfer_released_at: '2026-08-01T00:00:00Z', scheduled_at: '2026-07-31T00:00:00Z' },
    { id: 'b2', services: { title: 'Coaching' }, guest_name: 'Ravi', vendor_amount: 250, razorpay_transfer_id: 'trf_2', transfer_status: 'pending', transfer_hold_until: '2026-08-10T00:00:00Z', scheduled_at: '2026-08-05T00:00:00Z' },
  ] } })),
  getMyKyc: vi.fn(() => Promise.resolve({ data: { status: 'approved' } })),
}));
vi.mock('react-hot-toast', () => ({ default: { error: vi.fn(), success: vi.fn() } }));

describe('Payouts — settlement statement', () => {
  it('shows the settlement summary and a row per payout with its status', async () => {
    render(<MemoryRouter><Payouts /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText('Total Paid Out')).toBeInTheDocument());
    expect(screen.getByText('₹100.00')).toBeInTheDocument();
    expect(screen.getByText('In Transit')).toBeInTheDocument();
    expect(screen.getByText('₹300.00')).toBeInTheDocument();
    expect(screen.getByText('Pending Completion')).toBeInTheDocument();

    // A settled and an in-transit payout row, each with the right badge.
    // DataTable renders a desktop table + mobile cards, so text can appear twice.
    expect(screen.getAllByText('Consult').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Settled').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Coaching').length).toBeGreaterThan(0);
    expect(screen.getAllByText('In transit').length).toBeGreaterThan(0);
  });

  it('is a statement, not a withdrawal request — no request button', async () => {
    render(<MemoryRouter><Payouts /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText('Total Paid Out')).toBeInTheDocument());
    expect(screen.queryByText(/Request Withdrawal/i)).toBeNull();
  });

  it('shows a verified confirmation bar when KYC is approved', async () => {
    render(<MemoryRouter><Payouts /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText(/payouts settle automatically/i)).toBeInTheDocument());
  });
});

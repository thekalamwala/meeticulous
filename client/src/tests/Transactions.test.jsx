import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { vi } from 'vitest';

// Invoices moved to their own /dashboard/invoices page; this page just lists
// transactions now.
vi.mock('../services/api', () => ({
  getTransactions: vi.fn(),
}));

import { getTransactions } from '../services/api';
import Transactions from '../pages/Transactions';

const tx = {
  id: 'tx000001-1111-2222-3333-444444444444',
  guest_name: 'Asha Rao',
  guest_email: 'asha@example.com',
  guest_phone: '+919999999999',
  services: { title: 'Strategy call', price: 1000, duration: 45 },
  scheduled_at: '2026-06-20T05:00:00.000Z',
  created_at: '2026-06-18T05:00:00.000Z',
  vendor_amount: 909.76,
  platform_fee_amount: 10,
  commission_applied: 50,
  tds_amount: 10,
  tcs_amount: 10,
  razorpay_fee_actual: 20.24,
  razorpay_tax_actual: 0,
  payment_status: 'paid',
  razorpay_order_id: 'order_ABC123',
  razorpay_payment_id: 'pay_XYZ789',
};

beforeEach(() => {
  vi.clearAllMocks();
  getTransactions.mockResolvedValue({ data: { data: [tx], total: 1, page: 1, limit: 20 } });
});

test('date filter sends a dateFrom bound to the API', async () => {
  render(<Transactions />);
  await waitFor(() => screen.getAllByText('Asha Rao'));

  // Initial load: no date bound.
  expect(getTransactions.mock.calls[0][0].dateFrom).toBeUndefined();

  fireEvent.change(screen.getByLabelText('Filter by date'), { target: { value: '7d' } });

  await waitFor(() => {
    const last = getTransactions.mock.calls.at(-1)[0];
    expect(last.dateFrom).toBeTruthy();
  });
});

test('clicking a row opens the premium detail modal with grouped sections', async () => {
  render(<Transactions />);
  await waitFor(() => screen.getAllByText('Asha Rao'));

  fireEvent.click(screen.getAllByText('Asha Rao')[0]);

  const dialog = await screen.findByRole('dialog');
  const inModal = within(dialog);
  expect(inModal.getByRole('heading', { name: 'Customer' })).toBeInTheDocument();
  expect(inModal.getByRole('heading', { name: 'Booking' })).toBeInTheDocument();
  expect(inModal.getByRole('heading', { name: 'Payment advice' })).toBeInTheDocument();
  expect(inModal.getByRole('heading', { name: 'Gateway reference' })).toBeInTheDocument();
  // Gateway ids preserved.
  expect(inModal.getByText('order_ABC123')).toBeInTheDocument();
  // v4 deduction breakdown: commission + gateway + TDS + TCS + net payout.
  expect(inModal.getByText('− Commission')).toBeInTheDocument();
  expect(inModal.getByText('− TDS (194-O, 1%)')).toBeInTheDocument();
  expect(inModal.getByText('− TCS (GST §52, 1%)')).toBeInTheDocument();
  expect(inModal.getByText('Net payout')).toBeInTheDocument();
});

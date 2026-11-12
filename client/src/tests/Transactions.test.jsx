import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { vi } from 'vitest';

// Invoices moved to their own /dashboard/invoices page; this page just lists
// transactions now (redesigned table UI — same getTransactions API).
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
  getTransactions.mockResolvedValue({ data: { data: [tx], total: 1, page: 1, limit: 12 } });
});

test('date filter defaults to This Month and clears to all-time', async () => {
  render(<Transactions />);
  await waitFor(() => screen.getAllByText('Asha Rao'));

  // Reference default is "This Month" → a dateFrom bound is sent on first load.
  expect(getTransactions.mock.calls[0][0].dateFrom).toBeTruthy();

  fireEvent.change(screen.getByLabelText('Filter by date'), { target: { value: '' } });

  await waitFor(() => {
    const last = getTransactions.mock.calls.at(-1)[0];
    expect(last.dateFrom).toBeUndefined();
  });
});

test('search filter is forwarded to the API', async () => {
  render(<Transactions />);
  await waitFor(() => screen.getAllByText('Asha Rao'));
  fireEvent.change(screen.getByLabelText('Search transactions'), { target: { value: 'asha' } });
  await waitFor(() => {
    expect(getTransactions.mock.calls.at(-1)[0].search).toBe('asha');
  });
});

test('renders the real transaction row (no dummy data) with the reference columns', async () => {
  render(<Transactions />);
  await waitFor(() => screen.getByText('Asha Rao'));
  expect(screen.getByText('Strategy call')).toBeInTheDocument();
  expect(screen.getByText('Razorpay')).toBeInTheDocument();      // real: razorpay_payment_id present
  // Footer shows the real total (split across spans) — match on textContent.
  expect(
    screen.getByText((_, el) => el?.tagName === 'P' && /Showing .* of\s*1\s*transactions/.test(el.textContent)),
  ).toBeInTheDocument();
  // Column headers from the reference.
  ['Date & Time', 'Customer', 'Service / Product', 'Type', 'Amount', 'Payment Method', 'Status', 'Actions']
    .forEach((h) => expect(screen.getByText(h)).toBeInTheDocument());
});

test('clicking a row opens the premium detail modal with grouped sections', async () => {
  render(<Transactions />);
  await waitFor(() => screen.getByText('Asha Rao'));

  fireEvent.click(screen.getByText('Asha Rao'));

  const dialog = await screen.findByRole('dialog');
  const inModal = within(dialog);
  expect(inModal.getByRole('heading', { name: 'Customer' })).toBeInTheDocument();
  expect(inModal.getByRole('heading', { name: 'Booking' })).toBeInTheDocument();
  expect(inModal.getByRole('heading', { name: 'Payment advice' })).toBeInTheDocument();
  expect(inModal.getByRole('heading', { name: 'Gateway reference' })).toBeInTheDocument();
  expect(inModal.getByText('order_ABC123')).toBeInTheDocument();
  expect(inModal.getByText('− Commission')).toBeInTheDocument();
  expect(inModal.getByText('− TDS (194-O, 1%)')).toBeInTheDocument();
  expect(inModal.getByText('− TCS (GST §52, 1%)')).toBeInTheDocument();
  expect(inModal.getByText('Net payout')).toBeInTheDocument();
});

test('shows a clean empty state when the API returns no transactions', async () => {
  getTransactions.mockResolvedValueOnce({ data: { data: [], total: 0, page: 1, limit: 12 } });
  render(<Transactions />);
  expect(await screen.findByText('No transactions found')).toBeInTheDocument();
  // No fabricated counts or pagination when empty.
  expect(screen.queryByText(/Showing/)).toBeNull();
});

test('shows a retryable error state when the API fails', async () => {
  getTransactions.mockRejectedValueOnce(new Error('network down'));
  render(<Transactions />);
  expect(await screen.findByText("Couldn't load your transactions.")).toBeInTheDocument();
  // Recover: next call succeeds on retry.
  getTransactions.mockResolvedValueOnce({ data: { data: [tx], total: 1, page: 1, limit: 12 } });
  fireEvent.click(screen.getByRole('button', { name: /try again|retry/i }));
  expect(await screen.findByText('Asha Rao')).toBeInTheDocument();
});

test('DEV preview mode renders sample transactions WITHOUT calling the API', async () => {
  vi.stubEnv('VITE_UI_PREVIEW', 'true');
  try {
    render(<Transactions />);
    // A preview customer appears…
    expect(await screen.findByText('Ananya Iyer')).toBeInTheDocument();
    // …and the backend was never hit with preview data.
    expect(getTransactions).not.toHaveBeenCalled();
  } finally {
    vi.stubEnv('VITE_UI_PREVIEW', '');
  }
});

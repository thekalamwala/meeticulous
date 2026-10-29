import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import AdminFinanceDashboard from '../AdminFinanceDashboard';
import AdminLedger from '../AdminLedger';

vi.mock('../../../services/api', () => ({
  adminFinanceSummary: vi.fn(() => Promise.resolve({ data: { metrics: {
    gross_collections: 1011.8, net_revenue: 60, available_business_cash: -928.2,
    outstanding_vendor_payables: 917.4, gst_liability: 10.8,
    platform_fee_revenue: 10, commission_revenue: 50, subscription_revenue: 0,
    razorpay_charges_orders: 23.6, razorpay_charges_subscriptions: 0,
    razorpay_receivable: 988.2, bank_balance: 0,
  } } })),
  adminFinanceAccounts: vi.fn(() => Promise.resolve({ data: { accounts: [
    { id: 'a1', code: '1000', name: 'Bank', type: 'ASSET', active: true, account_balances: { balance: 5000 } },
  ] } })),
  adminFinanceLedger: vi.fn(() => Promise.resolve({ data: { entries: [], total: 0, page: 1, limit: 25 } })),
}));
vi.mock('react-hot-toast', () => ({ default: { error: vi.fn(), success: vi.fn() } }));

describe('AdminFinanceDashboard', () => {
  it('renders metric cards with en-IN currency', async () => {
    render(<AdminFinanceDashboard />);
    await waitFor(() => expect(screen.getByText('Host Payables')).toBeTruthy());
    // en-IN INR formatting: ₹917.40 (no trailing thousands separator below 1000)
    expect(screen.getByText('₹917.40')).toBeTruthy();
    expect(screen.getByText('GST Liability')).toBeTruthy();
  });
});

describe('AdminLedger', () => {
  it('renders the account dropdown and selected balance', async () => {
    render(<AdminLedger />);
    // The <option> label is split across text nodes by the em-dash, so match loosely.
    await waitFor(() => expect(screen.getByText(/Bank/)).toBeTruthy());
    expect(screen.getByText('₹5,000.00')).toBeTruthy();
  });
});

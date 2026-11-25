/**
 * ReferEarn — characterisation tests.
 *
 * Written BEFORE touching the page, which is the point: it is money-adjacent
 * (rewards land in a payout balance), it has had no coverage at all, and it is
 * one of the two console pages nobody has edited since 3 Nov. That combination
 * is how a quiet regression ships.
 *
 * These assert what the page does TODAY. They are not a wishlist — if one fails
 * after a change, the change altered behaviour a host can see, and that should
 * be a decision rather than a surprise.
 */
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';

vi.mock('../services/api', () => ({ getMyReferrals: vi.fn() }));

import { getMyReferrals } from '../services/api';
import ReferEarn from '../pages/ReferEarn';

const payload = {
  username: 'ananyarao',
  stats: { total: 7, earned: 1500, pendingValue: 500 },
  referrals: [
    { id: 'r1', created_at: '2026-11-01T10:00:00Z', referred_plan: 'premium', cadence: 'yearly', reward_value: 500, status: 'rewarded' },
    { id: 'r2', created_at: '2026-11-05T10:00:00Z', referred_plan: null, cadence: null, reward_value: 0, status: 'pending' },
    { id: 'r3', created_at: '2026-11-06T10:00:00Z', referred_plan: 'premium', cadence: 'monthly', reward_value: 500, status: 'qualified' },
    { id: 'r4', created_at: '2026-11-07T10:00:00Z', referred_plan: null, cadence: null, reward_value: 0, status: 'rejected' },
  ],
};

const show = () => render(<MemoryRouter><ReferEarn /></MemoryRouter>);

beforeEach(() => {
  vi.clearAllMocks();
  getMyReferrals.mockResolvedValue({ data: payload });
});

describe('the link', () => {
  it('builds the referral link from the username', async () => {
    show();
    await waitFor(() => expect(screen.getByText(/\/\?ref=ananyarao/)).toBeInTheDocument());
  });

  it('says so plainly when there is no username to build one from', async () => {
    // A host without a username has no link. Showing a broken one would be
    // worse than saying why.
    getMyReferrals.mockResolvedValue({ data: { ...payload, username: '' } });
    show();
    await waitFor(() => expect(screen.getByText(/set a username to get your link/i)).toBeInTheDocument());
  });

  it('disables copy and share when there is no link', async () => {
    getMyReferrals.mockResolvedValue({ data: { ...payload, username: '' } });
    show();
    await waitFor(() => expect(screen.getByRole('button', { name: /copy/i })).toBeDisabled());
    expect(screen.getByRole('button', { name: /share/i })).toBeDisabled();
  });

  it('copies the link and confirms it', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    show();
    await waitFor(() => screen.getByRole('button', { name: /copy/i }));
    fireEvent.click(screen.getByRole('button', { name: /copy/i }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(expect.stringContaining('?ref=ananyarao')));
    await waitFor(() => expect(screen.getByRole('button', { name: /copied/i })).toBeInTheDocument());
  });
});

describe('the money on the page', () => {
  it('shows referred, earned and in-review', async () => {
    show();
    await waitFor(() => expect(screen.getByText('7')).toBeInTheDocument());
    // Earned and in-review are distinct figures and must not be conflated:
    // one is money a host has, the other is money that may yet be refused.
    // getAllBy: the same amounts also appear in the table's reward column,
    // which is correct — the stat cards summarise the rows.
    expect(screen.getAllByText(/1,500/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/500\.00/).length).toBeGreaterThan(0);
  });

  it('keeps saying KYC is required to withdraw', async () => {
    // Every host in production is currently unverified, so this sentence is
    // the difference between an expectation met and a support ticket.
    show();
    await waitFor(() => expect(screen.getByText(/complete kyc to withdraw/i)).toBeInTheDocument());
  });
});

describe('the referral lifecycle is shown in a host-readable way', () => {
  it('translates each raw status into words a host understands', async () => {
    show();
    // getAllBy throughout: DataTable renders a desktop table and a mobile card
    // list from the same rows, so every cell legitimately appears twice.
    await waitFor(() => expect(screen.getAllByText('Rewarded').length).toBeGreaterThan(0));
    expect(screen.getAllByText('Signed up').length).toBeGreaterThan(0);   // pending
    expect(screen.getAllByText('In review').length).toBeGreaterThan(0);    // qualified
    expect(screen.getAllByText('Not eligible').length).toBeGreaterThan(0); // rejected
    // The raw values must never reach the page.
    expect(screen.queryByText('qualified')).not.toBeInTheDocument();
  });

  it('shows a dash rather than a zero for a referral that earned nothing', async () => {
    // ₹0 reads as "we paid you nothing"; a dash reads as "not yet decided",
    // which is what a pending referral actually is.
    show();
    await waitFor(() => expect(screen.getAllByText('—').length).toBeGreaterThan(0));
  });
});

describe('states', () => {
  it('offers a retry when loading fails', async () => {
    getMyReferrals.mockRejectedValue(new Error('500'));
    show();
    await waitFor(() => expect(screen.getByText(/couldn’t load your referrals/i)).toBeInTheDocument());
  });

  it('invites a host with no referrals to share, rather than showing a bare table', async () => {
    getMyReferrals.mockResolvedValue({ data: { ...payload, referrals: [], stats: {} } });
    show();
    await waitFor(() => expect(screen.getByText(/no referrals yet/i)).toBeInTheDocument());
  });
});

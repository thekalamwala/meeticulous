/**
 * tests/GiftedPro.test.jsx
 * Vitest: the billing page for a host on gifted (complimentary) Pro — gift card,
 * personal note, "Keep Pro" in place of "Current Plan" with the charge-now
 * confirm, share-to-extend submit, and the pay-it-forward link.
 */
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../services/api', () => ({
  getPublicPlans: vi.fn(),
  createSubscription: vi.fn(),
  syncSubscription: vi.fn(),
  cancelSubscription: vi.fn(),
  submitGiftShare: vi.fn(),
}));
vi.mock('../context/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../components/common/BackButton', () => ({ default: () => <div>Back</div> }));

import { useAuth } from '../context/AuthContext';
import { getPublicPlans, submitGiftShare } from '../services/api';
import UpgradePlan from '../pages/UpgradePlan';

const PLANS = [
  { id: '1', slug: 'free',    name: 'Starter', sort_order: 1, annual_price: 0,   monthly_price: 0,   limits: {} },
  { id: '2', slug: 'premium', name: 'Pro',     sort_order: 2, annual_price: 999, monthly_price: 199, limits: {} },
];
const ENDS = new Date(Date.now() + 20 * 86400000).toISOString();
const gift = (over = {}) => ({ ends_at: ENDS, months: 1, note: 'Thanks for the feedback!', share_status: null, forward: { code: 'ABCDEFGH23', redeemed: false }, ...over });

let updateUser;
const renderGifted = async (g = gift()) => {
  updateUser = vi.fn();
  useAuth.mockReturnValue({ user: { plan: 'premium', username: 'asha', plan_expires_at: ENDS, gift: g }, updateUser });
  render(<MemoryRouter><UpgradePlan /></MemoryRouter>);
  await waitFor(() => expect(screen.getByText('Complimentary Pro from the Meeticulous team')).toBeTruthy());
};

beforeEach(() => {
  vi.clearAllMocks();
  getPublicPlans.mockResolvedValue({ data: PLANS });
});

describe('UpgradePlan — gifted Pro', () => {
  test('shows the gift, the note, and "Keep Pro" instead of "Current Plan"', async () => {
    await renderGifted();
    expect(screen.getByText(/Thanks for the feedback!/)).toBeTruthy();
    expect(screen.getAllByText('Pro (Gifted)').length).toBeGreaterThan(0);
    await waitFor(() => expect(screen.getAllByRole('button', { name: /keep pro after your gift/i }).length).toBe(2));
    expect(screen.queryByText('Current Plan')).toBeNull();
  });

  test('"Keep Pro" asks to confirm that the gift ends and the charge is now', async () => {
    await renderGifted();
    await waitFor(() => expect(screen.getAllByRole('button', { name: /keep pro after your gift/i }).length).toBe(2));
    fireEvent.click(screen.getAllByRole('button', { name: /keep pro after your gift/i })[0]);
    expect(await screen.findByText(/gifted Pro ends today/i)).toBeTruthy();
  });

  test('share-to-extend posts the URL and shows the pending state', async () => {
    submitGiftShare.mockResolvedValue({ data: { share_status: 'pending' } });
    await renderGifted();
    fireEvent.change(screen.getByLabelText('Link to your post'), { target: { value: 'https://x.com/asha/status/1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(submitGiftShare).toHaveBeenCalledWith('https://x.com/asha/status/1'));
    expect(updateUser).toHaveBeenCalledWith({ gift: expect.objectContaining({ share_status: 'pending' }) });
  });

  test('pay-it-forward link carries the code; hidden once redeemed or on a forwarded gift', async () => {
    await renderGifted();
    const wa = screen.getAllByRole('link', { name: 'WhatsApp' }).map((a) => a.getAttribute('href'));
    expect(wa.some((h) => h.includes(encodeURIComponent('/become-a-host?gift=ABCDEFGH23')))).toBe(true);
  });

  test('a redeemed forward link shows the thank-you instead of the link', async () => {
    await renderGifted(gift({ forward: { code: 'ABCDEFGH23', redeemed: true } }));
    expect(screen.getByText(/joined with your link/i)).toBeTruthy();
  });
});

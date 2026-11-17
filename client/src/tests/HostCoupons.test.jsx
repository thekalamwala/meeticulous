/**
 * tests/HostCoupons.test.jsx
 * Host coupon management: the disabled (flag-off) state, the empty state,
 * creating a coupon (payload parsing), and deactivating one.
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';

const { api } = vi.hoisted(() => ({
  api: {
    getHostCoupons: vi.fn(),
    createHostCoupon: vi.fn(() => Promise.resolve({ data: {} })),
    updateHostCoupon: vi.fn(() => Promise.resolve({ data: {} })),
    deleteHostCoupon: vi.fn(() => Promise.resolve({ data: { ok: true } })),
  },
}));
vi.mock('../services/api', () => api);
vi.mock('react-hot-toast', () => ({
  default: Object.assign(() => {}, { success: () => {}, error: () => {} }),
}));

import HostCoupons from '../pages/HostCoupons';

const renderPage = () => render(<MemoryRouter><HostCoupons /></MemoryRouter>);

beforeEach(() => vi.clearAllMocks());

describe('HostCoupons', () => {
  it('shows the Coming-to-Pro teaser when the coupons flag is off (404)', async () => {
    api.getHostCoupons.mockRejectedValueOnce({ response: { status: 404 } });
    renderPage();
    expect(await screen.findByText('Discount codes')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /notify me/i })).toBeInTheDocument();
  });

  it('shows the empty state and opens the create form', async () => {
    api.getHostCoupons.mockResolvedValueOnce({ data: [] });
    renderPage();
    expect(await screen.findByText(/no coupons yet/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /new coupon/i }));
    expect(screen.getByLabelText(/^Code/i)).toBeInTheDocument();
  });

  it('creates a coupon with a parsed numeric payload', async () => {
    api.getHostCoupons.mockResolvedValue({ data: [] });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /new coupon/i }));

    fireEvent.change(screen.getByLabelText(/^Code/i), { target: { value: 'WELCOME10' } });
    fireEvent.change(screen.getByLabelText(/percent off/i), { target: { value: '10' } });
    fireEvent.change(screen.getByLabelText(/minimum booking/i), { target: { value: '500' } });
    fireEvent.click(screen.getByRole('button', { name: /create coupon/i }));

    await waitFor(() => expect(api.createHostCoupon).toHaveBeenCalled());
    expect(api.createHostCoupon).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'WELCOME10', discount_type: 'percent', discount_value: 10, min_amount: 500 }),
    );
    // No max_redemptions / expires_at entered → omitted, not sent as empty strings.
    const payload = api.createHostCoupon.mock.calls[0][0];
    expect(payload).not.toHaveProperty('max_redemptions');
    expect(payload).not.toHaveProperty('expires_at');
  });

  it('deactivates an active coupon', async () => {
    api.getHostCoupons.mockResolvedValueOnce({
      data: [{ id: 'c1', code: 'SAVE20', discount_type: 'percent', discount_value: 20, active: true, times_redeemed: 0, max_redemptions: null, min_amount: 0, expires_at: null }],
    });
    renderPage();
    expect(await screen.findByText('SAVE20')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /deactivate/i }));
    await waitFor(() => expect(api.updateHostCoupon).toHaveBeenCalledWith('c1', { active: false }));
  });
});

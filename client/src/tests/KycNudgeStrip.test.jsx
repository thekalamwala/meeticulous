/**
 * tests/KycNudgeStrip.test.jsx
 * The self-fetching KYC strip used in the dashboard layout: it loads KYC +
 * services and renders the banner, and stays silent on a fetch error.
 */
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';

const { api } = vi.hoisted(() => ({
  api: { getMyKyc: vi.fn(), getMyServices: vi.fn() },
}));
vi.mock('../services/api', () => api);

import KycNudgeStrip from '../components/dashboard/KycNudgeStrip';

const render1 = () => render(<MemoryRouter><KycNudgeStrip /></MemoryRouter>);

beforeEach(() => vi.clearAllMocks());

describe('KycNudgeStrip', () => {
  it('renders the pre-earnings nudge when a host sells a paid service but is unverified', async () => {
    api.getMyKyc.mockResolvedValueOnce({ data: { status: 'none' } });
    api.getMyServices.mockResolvedValueOnce({ data: [{ price: 500, price_on_request: false }] });
    render1();
    expect(await screen.findByText(/complete verification to accept payments/i)).toBeInTheDocument();
  });

  it('renders the money-waiting nudge when earnings are held', async () => {
    api.getMyKyc.mockResolvedValueOnce({ data: { status: 'none', pending_earnings: 2500, payouts_ready: false } });
    api.getMyServices.mockResolvedValueOnce({ data: [] });
    render1();
    expect(await screen.findByText(/₹2,500 waiting — finish KYC to withdraw/i)).toBeInTheDocument();
  });

  it('stays silent on a fetch error', async () => {
    api.getMyKyc.mockRejectedValueOnce(new Error('down'));
    api.getMyServices.mockResolvedValueOnce({ data: [] });
    const { container } = render1();
    await waitFor(() => expect(api.getMyKyc).toHaveBeenCalled());
    expect(container.textContent).toBe('');
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({
  getHostBookings: vi.fn(() => Promise.resolve({ data: [] })),
  getHostNudges: vi.fn(() => Promise.resolve({ data: { commissionPaid: 3000 } })),
}));

const mockAuth = { current: {} };
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: mockAuth.current }),
}));

import Earnings from '../Earnings';

const renderEarnings = (user) => {
  mockAuth.current = user;
  return render(<MemoryRouter><Earnings /></MemoryRouter>);
};

describe('Earnings — commission meter', () => {
  beforeEach(() => { mockAuth.current = {}; });

  it('surfaces the attributed commission meter for a free host who has paid', async () => {
    renderEarnings({ name: 'Host', plan: 'free' });
    const cta = await screen.findByRole('link', { name: /go pro|keep every rupee/i });
    expect(cta).toHaveAttribute('href', '/dashboard/upgrade?src=earnings');
  });

  it('does not show the meter for a Pro host', async () => {
    renderEarnings({ name: 'Host', plan: 'premium' });
    // Let the page settle (unique subtitle), then assert no meter.
    await screen.findByText(/Track your revenue/i);
    expect(screen.queryByText(/in commission/i)).toBeNull();
  });
});

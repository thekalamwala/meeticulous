import { render, screen } from '@testing-library/react';
import { describe, test, expect, vi } from 'vitest';
import AdminInsights from '../AdminInsights';

vi.mock('../../../services/api', () => ({
  adminGetInsights: () => Promise.resolve({ data: {
    revenue: { total: 100, last30: 100, prev30: 0 },
    bookings: { total: 1, paid: 1, last30: 1 },
    conversion: { created: 1, paid: 1, rate: 100 },
    gmv: { total: 1691.4, last30: 1467.2, prev30: 224.2, bookings: 1392.4, products: 299, platformRevenue: 30, takeRate: 1.8 },
    activation: { activatedCount: 1, totalHosts: 3, activationRate: 33.3, new30: 1, medianTimeToFirstBookingDays: 2 },
    hosts: { total: 3, new30: 1 },
    guests: { total: 0 },
    generatedAt: new Date().toISOString(),
  } }),
}));

describe('AdminInsights GMV + activation tiles', () => {
  test('renders GMV total and activation rate', async () => {
    render(<AdminInsights />);
    expect(await screen.findByText('₹1,691.4')).toBeInTheDocument();
    expect(await screen.findByText('33.3%')).toBeInTheDocument();
  });
});

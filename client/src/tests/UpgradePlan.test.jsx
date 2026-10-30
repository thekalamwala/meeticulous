/**
 * tests/UpgradePlan.test.jsx
 * Vitest: plan-card CTAs are tier-aware. A higher tier than the current plan
 * reads "Upgrade to …", a lower tier reads "Downgrade to …", and the current
 * tier reads "Current Plan" / "Switch to <cadence>". Guards the regression
 * where a higher-tier user was offered a lower tier as an "Upgrade". The legacy
 * partner row (creator) is kept in the fixture precisely because it is the only
 * remaining way a host can sit BELOW the current plan and still see it listed.
 */
import { render, screen, waitFor } from '@testing-library/react';
import { vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../services/api', () => ({
  getPublicPlans: vi.fn(),
  createSubscription: vi.fn(),
  syncSubscription: vi.fn(),
  cancelSubscription: vi.fn(),
}));

vi.mock('../context/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../components/common/BackButton', () => ({ default: () => <div>Back</div> }));

import { useAuth } from '../context/AuthContext';
import { getPublicPlans } from '../services/api';
import UpgradePlan from '../pages/UpgradePlan';

// Annual prices so paid plans render a clickable CTA (annual is the default cadence).
const PLANS = [
  { id: '1', slug: 'free',    name: 'Sloth',                  sort_order: 1, annual_price: 0,    monthly_price: 0,      limits: { digital_products: 3 } },
  { id: '2', slug: 'creator', name: 'Pro (Partner)', sort_order: 2, annual_price: 1499, monthly_price: 229,    limits: { digital_products: -1 } },
  { id: '3', slug: 'premium', name: 'Pro',           sort_order: 3, annual_price: 3050, monthly_price: 338.13, limits: { digital_products: -1 } },
];

beforeEach(() => {
  vi.clearAllMocks();
  getPublicPlans.mockResolvedValue({ data: PLANS });
});

const renderFor = async (plan) => {
  useAuth.mockReturnValue({ user: { plan }, updateUser: vi.fn() });
  render(<MemoryRouter><UpgradePlan /></MemoryRouter>);
  await waitFor(() => expect(screen.getAllByText(/Pro/).length).toBeGreaterThan(0));
};

describe('UpgradePlan — tier-aware CTAs', () => {
  test('a premium host sees the lower partner tier as a downgrade, not an upgrade', async () => {
    await renderFor('premium');
    expect(screen.getByRole('button', { name: /downgrade to pro \(partner\)/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /upgrade to pro \(partner\)/i })).toBeNull();
  });

  test('a premium host sees its own tier as the current plan', async () => {
    await renderFor('premium');
    expect(screen.getAllByText('Current Plan').length).toBeGreaterThan(0);
  });

  test('a free host sees every paid tier as an upgrade', async () => {
    await renderFor('free');
    expect(screen.getByRole('button', { name: /upgrade to pro \(partner\)/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /upgrade to pro$/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /downgrade/i })).toBeNull();
  });

  test('legacy "explorer" alias is treated as the free starter tier (all paid plans are upgrades)', async () => {
    await renderFor('explorer');
    expect(screen.getByRole('button', { name: /upgrade to pro \(partner\)/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /upgrade to pro$/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /downgrade/i })).toBeNull();
  });
});

/**
 * tests/plansStepEmptyFallback.test.jsx
 * P1: a failed/empty getPublicPlans previously left every CTA null-guarded and
 * stranded the host on the last onboarding step. The fallback must offer a
 * retry AND a working "go live free" path (free activation needs no plans data).
 */
import { render, waitFor, screen, fireEvent } from '@testing-library/react';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('../services/api', () => ({
  getOnboardingStatus: vi.fn().mockResolvedValue({ data: { stepCompleted: 5, isComplete: false, slug: 'me' } }),
  getPublicPlans:      vi.fn(),
  activateFreePlan:    vi.fn().mockResolvedValue({ data: {} }),
  advanceToLive:       vi.fn().mockResolvedValue({ data: {} }),
  createSubscription:  vi.fn(),
  syncSubscription:    vi.fn(),
  getMe:               vi.fn().mockResolvedValue({ data: {} }),
}));
vi.mock('../utils/celebration', () => ({ fireCelebration: vi.fn() }));
vi.mock('../utils/loadRazorpay', () => ({ default: vi.fn().mockResolvedValue(true) }));

import { getPublicPlans, activateFreePlan } from '../services/api';
import PlansStep from '../pages/onboarding/PlansStep';

const renderPlans = () => render(
  <MemoryRouter initialEntries={['/vendor-register/me/plan']}>
    <Routes>
      <Route path="/vendor-register/:slug/plan" element={<PlansStep />} />
      <Route path="/vendor-register/:slug/live" element={<div data-testid="live">live</div>} />
    </Routes>
  </MemoryRouter>
);

beforeEach(() => {
  vi.clearAllMocks();
  activateFreePlan.mockResolvedValue({ data: {} });
  // useOnboardingGuard reads window.location.pathname directly (not React
  // Router), so the jsdom URL must match the /plan step or the guard bounces.
  window.history.pushState({}, '', '/vendor-register/me/plan');
});

describe('PlansStep empty/error fallback', () => {
  test('empty plans → shows Retry + Go live free instead of a dead screen', async () => {
    getPublicPlans.mockResolvedValue({ data: [] });
    renderPlans();
    await screen.findByRole('button', { name: /Retry/i });
    expect(screen.getByRole('button', { name: /Go live free/i })).toBeTruthy();
  });

  test('Retry re-fetches plans', async () => {
    getPublicPlans.mockResolvedValue({ data: [] });
    renderPlans();
    const retry = await screen.findByRole('button', { name: /Retry/i });
    expect(getPublicPlans).toHaveBeenCalledTimes(1);
    fireEvent.click(retry);
    await waitFor(() => expect(getPublicPlans).toHaveBeenCalledTimes(2));
  });

  test('Go live free activates the free plan even with no plans loaded', async () => {
    getPublicPlans.mockResolvedValue({ data: [] });
    renderPlans();
    fireEvent.click(await screen.findByRole('button', { name: /Go live free/i }));
    await waitFor(() => expect(activateFreePlan).toHaveBeenCalled());
    await screen.findByTestId('live');
  });
});

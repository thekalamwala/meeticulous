/**
 * tests/onboardingResume.test.jsx
 * Verifies ProtectedRoute's explicit resume map sends hosts to the right step.
 *
 * Strategy: render ProtectedRoute under a MemoryRouter that includes a
 * catch-all Route to capture where Navigate lands.  We read the resulting
 * rendered output (the "landed" route renders a sentinel element) rather
 * than spying on navigate directly.
 *
 * Covers (canonical map — single source of truth in useOnboardingGuard):
 *  - stepCompleted:3 → /preview
 *  - stepCompleted:1 → /claim
 *  - stepCompleted:4 → /preview (legacy in-flight rolls forward)
 *  - isComplete:true  → children render (no redirect)
 *  - no slug          → children render (legacy host, not trapped)
 *  - non-host         → children render, getOnboardingStatus never called
 */
import { render, waitFor, screen } from '@testing-library/react';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import React from 'react';

// --- Mock api module -------------------------------------------------------
vi.mock('../services/api', () => ({
  getOnboardingStatus: vi.fn(),
}));

// --- Mock AuthContext -------------------------------------------------------
const mockUser = vi.fn();

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: mockUser(), loading: false }),
}));

import { getOnboardingStatus } from '../services/api';
import ProtectedRoute from '../components/common/ProtectedRoute';

// Sentinel elements — each route in the test router renders a unique testid
// so we can assert where the user "landed" after ProtectedRoute redirects.
const Child       = () => <div data-testid="child">Protected child</div>;
const LandClaim   = () => <div data-testid="land-claim">claim</div>;
const LandAbout   = () => <div data-testid="land-about">about</div>;
const LandCategory = () => <div data-testid="land-category">category</div>;
const LandPreview = () => <div data-testid="land-preview">preview</div>;
const LandWhatsapp = () => <div data-testid="land-whatsapp">whatsapp</div>;
const LandPlan    = () => <div data-testid="land-plan">plan</div>;

function renderProtectedAt(initialPath = '/dashboard') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        {/* The protected routes the user is trying to reach. The resume gate
            only fires at the host-space ENTRY (/dashboard); deep dashboard
            routes and guest/review pages must always render their child. */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Child />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/profile"
          element={
            <ProtectedRoute>
              <Child />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/bookings"
          element={
            <ProtectedRoute>
              <Child />
            </ProtectedRoute>
          }
        />
        <Route
          path="/review/:bookingId"
          element={
            <ProtectedRoute>
              <Child />
            </ProtectedRoute>
          }
        />
        {/* Sentinel routes that capture where ProtectedRoute redirected to */}
        <Route path="/vendor-register/:slug/claim"    element={<LandClaim />} />
        <Route path="/vendor-register/:slug/about"    element={<LandAbout />} />
        <Route path="/vendor-register/:slug/category" element={<LandCategory />} />
        <Route path="/vendor-register/:slug/preview"  element={<LandPreview />} />
        <Route path="/vendor-register/:slug/whatsapp" element={<LandWhatsapp />} />
        <Route path="/vendor-register/:slug/plan"     element={<LandPlan />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ProtectedRoute resume map', () => {
  test('host with stepCompleted:3 (persona done) is redirected to /preview', async () => {
    mockUser.mockReturnValue({ role: 'host' });
    getOnboardingStatus.mockResolvedValue({
      data: { stepCompleted: 3, isComplete: false, slug: 'me' },
    });

    renderProtectedAt('/dashboard');

    await waitFor(() => {
      expect(screen.getByTestId('land-preview')).toBeTruthy();
    });
    // Must NOT have landed on children or an old route
    expect(screen.queryByTestId('child')).toBeNull();
  });

  test('host with stepCompleted:1 (Google done) is redirected to /claim', async () => {
    mockUser.mockReturnValue({ role: 'host' });
    getOnboardingStatus.mockResolvedValue({
      data: { stepCompleted: 1, isComplete: false, slug: 'me' },
    });

    renderProtectedAt('/dashboard');

    await waitFor(() => {
      expect(screen.getByTestId('land-claim')).toBeTruthy();
    });
    expect(screen.queryByTestId('child')).toBeNull();
  });

  test('host with stepCompleted:4 (legacy in-flight) is redirected to /preview', async () => {
    mockUser.mockReturnValue({ role: 'host' });
    getOnboardingStatus.mockResolvedValue({
      data: { stepCompleted: 4, isComplete: false, slug: 'me' },
    });

    renderProtectedAt('/dashboard');

    await waitFor(() => {
      expect(screen.getByTestId('land-preview')).toBeTruthy();
    });
    expect(screen.queryByTestId('child')).toBeNull();
  });

  test('host with isComplete:true passes through to children', async () => {
    mockUser.mockReturnValue({ role: 'host' });
    getOnboardingStatus.mockResolvedValue({
      data: { stepCompleted: 6, isComplete: true, slug: 'me' },
    });

    renderProtectedAt('/dashboard');

    await waitFor(() => {
      expect(screen.getByTestId('child')).toBeTruthy();
    });
  });

  test('host with no onboarding_slug (legacy host) passes through to children', async () => {
    mockUser.mockReturnValue({ role: 'host' });
    // Legacy host: slug is null — should not be redirected into onboarding
    getOnboardingStatus.mockResolvedValue({
      data: { stepCompleted: 0, isComplete: false, slug: null },
    });

    renderProtectedAt('/dashboard');

    await waitFor(() => {
      expect(screen.getByTestId('child')).toBeTruthy();
    });
  });

  test('non-host user passes through to children without calling getOnboardingStatus', async () => {
    mockUser.mockReturnValue({ role: 'guest' });

    renderProtectedAt('/dashboard');

    await waitFor(() => {
      expect(screen.getByTestId('child')).toBeTruthy();
    });
    expect(getOnboardingStatus).not.toHaveBeenCalled();
  });

  // ── Resume gate is confined to the host-space entry (/dashboard) ──────────
  // An incomplete host who intentionally opens a DEEP dashboard route must stay
  // there — the dashboard must never bounce a page the host chose to open.
  test('incomplete host on a deep dashboard route renders the page (no bounce, no status fetch)', async () => {
    mockUser.mockReturnValue({ role: 'host' });
    getOnboardingStatus.mockResolvedValue({
      data: { stepCompleted: 3, isComplete: false, slug: 'me' },
    });

    renderProtectedAt('/dashboard/profile');

    await waitFor(() => {
      expect(screen.getByTestId('child')).toBeTruthy();
    });
    expect(screen.queryByTestId('land-category')).toBeNull();
    // No onboarding check happens away from the entry route.
    expect(getOnboardingStatus).not.toHaveBeenCalled();
  });

  test('incomplete host on /dashboard/bookings renders the page (no bounce)', async () => {
    mockUser.mockReturnValue({ role: 'host' });
    getOnboardingStatus.mockResolvedValue({
      data: { stepCompleted: 1, isComplete: false, slug: 'me' },
    });

    renderProtectedAt('/dashboard/bookings');

    await waitFor(() => {
      expect(screen.getByTestId('child')).toBeTruthy();
    });
    expect(screen.queryByTestId('land-claim')).toBeNull();
    expect(getOnboardingStatus).not.toHaveBeenCalled();
  });

  test('incomplete host on a /review link renders the page (no bounce)', async () => {
    mockUser.mockReturnValue({ role: 'host' });
    getOnboardingStatus.mockResolvedValue({
      data: { stepCompleted: 2, isComplete: false, slug: 'me' },
    });

    renderProtectedAt('/review/abc123');

    await waitFor(() => {
      expect(screen.getByTestId('child')).toBeTruthy();
    });
    expect(screen.queryByTestId('land-about')).toBeNull();
    expect(getOnboardingStatus).not.toHaveBeenCalled();
  });
});

/**
 * tests/useOnboardingGuard.test.jsx
 * Verifies the server-truth resume guard redirects hosts to the correct step.
 */
import { render, waitFor } from '@testing-library/react';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

// --- Mock api module BEFORE importing the hook ---
vi.mock('../services/api', () => ({
  getOnboardingStatus: vi.fn(),
}));

import { getOnboardingStatus } from '../services/api';
import useOnboardingGuard from '../pages/onboarding/useOnboardingGuard';

// Minimal probe component: calls the hook, reports ready state via data-testid
const Probe = ({ onNavigate }) => {
  const ready = useOnboardingGuard();
  return <div data-testid="probe" data-ready={String(ready)} />;
};

// Capture navigate calls by wrapping in MemoryRouter and spying on navigate.
// We render inside a route that provides the :slug param.
function renderInRouter(path, initialEntry) {
  const navigateCalls = [];
  // We intercept by watching the MemoryRouter's internal navigate via the
  // Routes/Route — the easiest approach in react-router v6 without mocking the
  // whole module is to mount with an initialEntries path and assert the
  // resulting location via a Location component.

  let navigateSpy = null;

  const NavigateSpy = () => {
    const { useNavigate } = require('react-router-dom');
    navigateSpy = useNavigate();
    return null;
  };

  const { getByTestId } = render(
    <MemoryRouter initialEntries={[initialEntry || path]}>
      <Routes>
        <Route path={path} element={<><NavigateSpy /><Probe /></>} />
      </Routes>
    </MemoryRouter>
  );

  return { getByTestId, navigateCalls };
}

// ─── Simpler approach: mock useNavigate so we can capture calls ─────────────
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ slug: 'john' }),
  };
});

const mockNavigate = vi.fn();

beforeEach(() => {
  mockNavigate.mockClear();
  getOnboardingStatus.mockReset();
});

describe('useOnboardingGuard', () => {
  test('forward jump is blocked: step-1 host on plan page redirects back to claim', async () => {
    // stepCompleted=1 → furthest allowed = 'claim'. Landing on /plan is a jump
    // ahead → guard snaps back to the furthest reached step.
    getOnboardingStatus.mockResolvedValue({
      data: { stepCompleted: 1, isComplete: false, slug: 'john' },
    });

    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...window.location, pathname: '/vendor-register/john/plan' },
    });

    const ProbeComponent = () => {
      useOnboardingGuard();
      return <div data-testid="probe" />;
    };

    render(
      <MemoryRouter initialEntries={['/vendor-register/john/plan']}>
        <Routes>
          <Route path="/vendor-register/:slug/plan" element={<ProbeComponent />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(
        '/vendor-register/john/claim',
        { replace: true }
      );
    });
  });

  test('backward revisit is allowed: step-3 host on category page does not redirect', async () => {
    // stepCompleted=3 → furthest allowed = 'preview'. Visiting an EARLIER step
    // (category) is a legitimate Back navigation → render it, don't bounce forward.
    getOnboardingStatus.mockResolvedValue({
      data: { stepCompleted: 3, isComplete: false, slug: 'john' },
    });

    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...window.location, pathname: '/vendor-register/john/category' },
    });

    let capturedReady = false;
    const ProbeComponent = () => {
      const ready = useOnboardingGuard();
      capturedReady = ready;
      return <div data-testid="probe" data-ready={String(ready)} />;
    };

    const { getByTestId } = render(
      <MemoryRouter initialEntries={['/vendor-register/john/category']}>
        <Routes>
          <Route path="/vendor-register/:slug/category" element={<ProbeComponent />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(getByTestId('probe').getAttribute('data-ready')).toBe('true');
    });
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  test('host whose status isComplete is redirected to /dashboard', async () => {
    getOnboardingStatus.mockResolvedValue({
      data: { isComplete: true, stepCompleted: 6, slug: 'john' },
    });

    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...window.location, pathname: '/vendor-register/john/about' },
    });

    const ProbeComponent = () => {
      useOnboardingGuard();
      return <div data-testid="probe" />;
    };

    render(
      <MemoryRouter initialEntries={['/vendor-register/john/about']}>
        <Routes>
          <Route path="/vendor-register/:slug/about" element={<ProbeComponent />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true });
    });
  });

  test('host on the correct step sets ready=true without redirecting', async () => {
    // stepCompleted=1 → target='claim'; current page='claim' → no redirect
    getOnboardingStatus.mockResolvedValue({
      data: { stepCompleted: 1, isComplete: false, slug: 'john' },
    });

    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...window.location, pathname: '/vendor-register/john/claim' },
    });

    let capturedReady = false;
    const ProbeComponent = () => {
      const ready = useOnboardingGuard();
      capturedReady = ready;
      return <div data-testid="probe" data-ready={String(ready)} />;
    };

    const { getByTestId } = render(
      <MemoryRouter initialEntries={['/vendor-register/john/claim']}>
        <Routes>
          <Route path="/vendor-register/:slug/claim" element={<ProbeComponent />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(getByTestId('probe').getAttribute('data-ready')).toBe('true');
    });
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  test('after repeated API errors, fails open (ready=true) so the host is never blocked', async () => {
    getOnboardingStatus.mockRejectedValue(new Error('network error'));

    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...window.location, pathname: '/vendor-register/john/claim' },
    });

    const ProbeComponent = () => {
      const ready = useOnboardingGuard();
      return <div data-testid="probe" data-ready={String(ready)} />;
    };

    const { getByTestId } = render(
      <MemoryRouter initialEntries={['/vendor-register/john/claim']}>
        <Routes>
          <Route path="/vendor-register/:slug/claim" element={<ProbeComponent />} />
        </Routes>
      </MemoryRouter>
    );

    // 3 tries with backoff (~1.2s) before failing open — allow headroom.
    await waitFor(
      () => expect(getByTestId('probe').getAttribute('data-ready')).toBe('true'),
      { timeout: 3000 },
    );
    expect(getOnboardingStatus.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  test('a transient error recovers on retry and still enforces the redirect (no fail-open onto a wrong screen)', async () => {
    // First fetch fails, retry succeeds with a step-1 host — who must NOT be left
    // on /plan (a forward jump). The guard should recover and redirect to /claim
    // rather than failing open onto the wrong screen.
    getOnboardingStatus
      .mockRejectedValueOnce(new Error('blip'))
      .mockResolvedValue({ data: { stepCompleted: 1, isComplete: false, slug: 'john' } });

    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...window.location, pathname: '/vendor-register/john/plan' },
    });

    const ProbeComponent = () => {
      useOnboardingGuard();
      return <div data-testid="probe" />;
    };

    render(
      <MemoryRouter initialEntries={['/vendor-register/john/plan']}>
        <Routes>
          <Route path="/vendor-register/:slug/plan" element={<ProbeComponent />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(
      () => expect(mockNavigate).toHaveBeenCalledWith('/vendor-register/john/claim', { replace: true }),
      { timeout: 3000 },
    );
  });
});

import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { vi, test, expect, beforeEach, describe } from 'vitest';

vi.mock('../services/api', () => ({
  getPublicPlans: vi.fn(),
  activateFreePlan: vi.fn(() => Promise.resolve({ data: {} })),
  advanceToLive: vi.fn(() => Promise.resolve({ data: {} })),
  createSubscription: vi.fn(() => Promise.resolve({ data: { key: 'k', subscription_id: 'sub_1' } })),
  syncSubscription: vi.fn(() => Promise.resolve({ data: {} })),
  getMe: vi.fn(() =>
    Promise.resolve({ data: { name: 'Test Host', email: 'host@example.com', plan: 'premium' } })
  ),
  // useOnboardingGuard: stepCompleted=6 → RESUME[6]=undefined → target=null → no redirect
  getOnboardingStatus: vi.fn(() =>
    Promise.resolve({ data: { stepCompleted: 6, isComplete: false, slug: 'test' } })
  ),
}));
vi.mock('react-hot-toast', () => ({ default: Object.assign(() => {}, { success: () => {}, error: () => {} }) }));
// The publish celebration draws to a canvas (canvas-confetti); jsdom has no 2d
// context → an unhandled clearRect(null) error fails `vitest run`. Stub it out.
vi.mock('../utils/celebration', () => ({ fireCelebration: vi.fn() }));

import {
  getPublicPlans,
  activateFreePlan,
  advanceToLive,
  createSubscription,
  syncSubscription,
  getMe,
} from '../services/api';
import PlansStep from '../pages/onboarding/PlansStep';

// Two plans since v3.165. Pro (premium) is the only paid row → the
// hero, chosen by price rather than a hardcoded slug. Starter is the free fallback.
const PLANS = [
  { slug: 'free', name: 'Sloth', monthly_price: 0, annual_price: 0, limits: { services: -1, bookings_per_year: -1 }, commission_percentage: 5 },
  { slug: 'premium', name: 'Pro', monthly_price: 338.13, annual_price: 3050, limits: { services: -1, bookings_per_year: -1 }, commission_percentage: 0 },
];

// GST billing details on the host (#805): choosePaid now requires a place-of-supply
// state_code before creating the mandate, and passes a billing snapshot to
// createSubscription. The host's saved billing_details satisfy the gate.
const BILL = { state_code: 'MH', state: 'Maharashtra', name: 'Test Host' };

// Render the plans step alongside a sentinel /live route so we can assert navigation.
const renderStep = () => render(
  <MemoryRouter initialEntries={['/vendor-register/test/plans']}>
    <Routes>
      <Route path="/vendor-register/:slug/plans" element={<PlansStep />} />
      <Route path="/vendor-register/:slug/live" element={<div data-testid="live-page">live</div>} />
    </Routes>
  </MemoryRouter>
);

beforeEach(() => {
  vi.clearAllMocks();
  getPublicPlans.mockResolvedValue({ data: PLANS });
  getMe.mockResolvedValue({ data: { name: 'Test Host', email: 'host@example.com', plan: 'premium', billing_details: BILL } });
  // Use a function (not arrow) so `new window.Razorpay(opts)` works as a constructor.
  window.Razorpay = function () { return { open: vi.fn() }; };
  // Guard checks window.location.pathname for the current segment.
  Object.defineProperty(window, 'location', {
    writable: true,
    value: { ...window.location, pathname: '/vendor-register/test/plans' },
  });
});

test('Pro is the preselected hero; free Starter is a fallback', async () => {
  renderStep();
  await waitFor(() => screen.getByText('Pro'));           // hero card
  expect(screen.getByText('₹3,599')).toBeInTheDocument();    // annual price
  expect(screen.getByRole('button', { name: /Publish on Starter/ })).toBeInTheDocument(); // free fallback
});

test('hero "go live" opens a Pro ANNUAL subscription', async () => {
  renderStep();
  await waitFor(() => screen.getByText('Pro'));
  fireEvent.click(screen.getByRole('button', { name: /go live/ }));
  await waitFor(() => expect(createSubscription).toHaveBeenCalledWith({ plan: 'premium', cadence: 'annual', billing: BILL }));
});

test('renders other plans + monthly/annual cadence toggle in the drawer', async () => {
  renderStep();
  await waitFor(() => screen.getByText('Pro'));
  fireEvent.click(screen.getByRole('button', { name: /See all plans/ }));
  await waitFor(() => screen.getAllByText('Pro').length > 0);
  expect(screen.getByRole('button', { name: 'Monthly' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Annual/ })).toBeInTheDocument();
});

test('drawer paid plan opens an auto-renew subscription with the selected cadence', async () => {
  renderStep();
  await waitFor(() => screen.getByText('Pro'));
  fireEvent.click(screen.getByRole('button', { name: /See all plans/ }));
  await waitFor(() => screen.getAllByText('Pro').length > 0);
  fireEvent.click(screen.getByRole('button', { name: 'Choose Pro' }));
  await waitFor(() => expect(createSubscription).toHaveBeenCalledWith({ plan: 'premium', cadence: 'annual', billing: BILL }));
});

test('switching to monthly passes monthly cadence', async () => {
  renderStep();
  await waitFor(() => screen.getByText('Pro'));
  fireEvent.click(screen.getByRole('button', { name: /See all plans/ }));
  await waitFor(() => screen.getAllByText('Pro').length > 0);
  fireEvent.click(screen.getByRole('button', { name: 'Monthly' }));
  fireEvent.click(screen.getByRole('button', { name: 'Choose Pro' }));
  await waitFor(() => expect(createSubscription).toHaveBeenCalledWith({ plan: 'premium', cadence: 'monthly', billing: BILL }));
});

describe('free plan path', () => {
  test('calls activateFreePlan then navigates to /live', async () => {
    renderStep();
    await waitFor(() => screen.getByText('Pro'));
    fireEvent.click(screen.getByRole('button', { name: /Publish on Starter/ }));
    await waitFor(() => expect(activateFreePlan).toHaveBeenCalled());
    // After navigation the /live sentinel route renders
    await waitFor(() => expect(screen.getByTestId('live-page')).toBeInTheDocument());
  });

  test('does NOT call advanceToLive or markOnboardingComplete on free path', async () => {
    renderStep();
    await waitFor(() => screen.getByText('Pro'));
    fireEvent.click(screen.getByRole('button', { name: /Publish on Starter/ }));
    await waitFor(() => expect(activateFreePlan).toHaveBeenCalled());
    // Navigates but does NOT call advanceToLive (activate-free handles step advance server-side)
    expect(advanceToLive).not.toHaveBeenCalled();
  });
});

describe('paid plan success path', () => {
  // Helper: installs a window.Razorpay constructor that captures the options object.
  const makeRazorpayCapture = () => {
    let captured = null;
    window.Razorpay = function RazorpayMock(opts) {
      captured = opts;
      return { open: vi.fn() };
    };
    return () => captured;
  };

  test('handler calls syncSubscription → getMe → advanceToLive → navigate /live when plan is active', async () => {
    const getCapture = makeRazorpayCapture();
    // Both mount + handler getMe calls return a paid plan
    getMe.mockResolvedValue({ data: { name: 'Test Host', email: 'host@example.com', plan: 'premium', billing_details: BILL } });

    renderStep();
    await waitFor(() => screen.getByText('Pro'));
    fireEvent.click(screen.getByRole('button', { name: /go live/ }));
    await waitFor(() => expect(createSubscription).toHaveBeenCalled());

    const opts = getCapture();
    expect(opts?.handler).toBeTypeOf('function');

    // Simulate Razorpay success callback
    await act(async () => {
      await opts.handler();
    });

    expect(syncSubscription).toHaveBeenCalled();
    // getMe called at least twice: once on mount, once in handler
    expect(getMe).toHaveBeenCalledTimes(2);
    expect(advanceToLive).toHaveBeenCalled();
    // /live page renders after navigation
    await waitFor(() => expect(screen.getByTestId('live-page')).toBeInTheDocument());
  });

  test('handler does NOT navigate or call advanceToLive when getMe shows plan not yet active (webhook lag)', async () => {
    const getCapture = makeRazorpayCapture();
    // Both mount and handler getMe calls return no/free plan → webhook lag scenario
    getMe.mockResolvedValue({ data: { name: 'Test Host', email: 'host@example.com', plan: null, billing_details: BILL } });

    renderStep();
    await waitFor(() => screen.getByText('Pro'));
    fireEvent.click(screen.getByRole('button', { name: /go live/ }));
    await waitFor(() => expect(createSubscription).toHaveBeenCalled());

    const opts = getCapture();
    await act(async () => {
      await opts.handler();
    });

    expect(syncSubscription).toHaveBeenCalled();
    expect(advanceToLive).not.toHaveBeenCalled();
    // Still on plans page — live page NOT rendered
    expect(screen.queryByTestId('live-page')).toBeNull();
  });

  test('handler does NOT navigate or call advanceToLive when getMe ERRORS after payment (transient failure)', async () => {
    const getCapture = makeRazorpayCapture();
    // Mount getMe resolves (so the page renders); the post-payment getMe rejects.
    getMe
      .mockResolvedValueOnce({ data: { name: 'Test Host', email: 'host@example.com', plan: 'premium', billing_details: BILL } })
      .mockRejectedValue(new Error('network'));

    renderStep();
    await waitFor(() => screen.getByText('Pro'));
    fireEvent.click(screen.getByRole('button', { name: /go live/ }));
    await waitFor(() => expect(createSubscription).toHaveBeenCalled());

    const opts = getCapture();
    await act(async () => {
      await opts.handler();
    });

    // A transient getMe error must NOT be treated as success: no optimistic advance…
    expect(advanceToLive).not.toHaveBeenCalled();
    // …and no optimistic navigation to /live.
    expect(screen.queryByTestId('live-page')).toBeNull();
  });

  test('Razorpay options include modal.ondismiss', async () => {
    const getCapture = makeRazorpayCapture();

    renderStep();
    await waitFor(() => screen.getByText('Pro'));
    fireEvent.click(screen.getByRole('button', { name: /go live/ }));
    await waitFor(() => expect(createSubscription).toHaveBeenCalled());

    const opts = getCapture();
    expect(opts?.modal?.ondismiss).toBeTypeOf('function');
  });

  test('paid handler does NOT call markOnboardingComplete (only navigates to /live via advanceToLive)', async () => {
    const getCapture = makeRazorpayCapture();
    getMe.mockResolvedValue({ data: { name: 'Test Host', email: 'host@example.com', plan: 'premium', billing_details: BILL } });

    renderStep();
    await waitFor(() => screen.getByText('Pro'));
    fireEvent.click(screen.getByRole('button', { name: /go live/ }));
    await waitFor(() => expect(createSubscription).toHaveBeenCalled());

    const opts = getCapture();
    await act(async () => {
      await opts.handler();
    });

    expect(advanceToLive).toHaveBeenCalled();
    // markOnboardingComplete is NOT in the mock → confirm /live is reached, not /dashboard
    await waitFor(() => expect(screen.getByTestId('live-page')).toBeInTheDocument());
  });
});

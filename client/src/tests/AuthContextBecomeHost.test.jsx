import { render, screen, act } from '@testing-library/react';
import { vi, test, expect, beforeEach } from 'vitest';

// vi.mock factories are hoisted — define the spy via vi.hoisted so it exists
// before the factory runs.
const { becomeHostMock } = vi.hoisted(() => ({
  becomeHostMock: vi.fn(() =>
    Promise.resolve({ data: { id: 'g1', is_host: true, role: 'host', onboarding_slug: 'doc' } })
  ),
}));
vi.mock('../services/analytics', () => ({ analytics: { identify: vi.fn(), reset: vi.fn() } }));
vi.mock('../services/api', () => ({
  registerVendor: vi.fn(), registerUser: vi.fn(), loginUser: vi.fn(),
  loginWithPhone: vi.fn(), verifyOtpLogin: vi.fn(), setUserPassword: vi.fn(),
  getGoogleAuthUrl: vi.fn(), getVendorGoogleUrl: vi.fn(),
  getMe: vi.fn(() => Promise.resolve({ data: {} })),
  becomeHost: becomeHostMock,
}));
vi.mock('../services/supabaseClient', () => ({
  getSupabase: () => Promise.resolve({ auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }), setSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }), signOut: vi.fn() } }),
}));

import { AuthProvider, useAuth } from '../context/AuthContext';

function Probe() {
  const { mode, user, becomeHost } = useAuth();
  return (
    <div>
      <span data-testid="mode">{mode}</span>
      <span data-testid="ishost">{String(!!user?.is_host)}</span>
      <button onClick={() => becomeHost()}>go</button>
    </div>
  );
}

beforeEach(() => localStorage.clear());

test('becomeHost flips user.is_host and switches to hosting mode', async () => {
  render(<AuthProvider><Probe /></AuthProvider>);
  expect(screen.getByTestId('mode').textContent).toBe('traveling');
  await act(async () => { screen.getByText('go').click(); });
  expect(becomeHostMock).toHaveBeenCalled();
  expect(screen.getByTestId('ishost').textContent).toBe('true');
  expect(screen.getByTestId('mode').textContent).toBe('hosting');
  expect(localStorage.getItem('bas_active_mode')).toBe('hosting');
});

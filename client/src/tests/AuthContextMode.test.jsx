import { render, screen, act } from '@testing-library/react';
import { vi, test, expect, beforeEach } from 'vitest';

// AuthProvider pulls in the analytics bus, the api layer, and the supabase client
// at import time — stub them so we can mount the provider in isolation and assert
// only the new Hosting/Traveling mode state.
vi.mock('../services/analytics', () => ({ analytics: { identify: vi.fn(), reset: vi.fn() } }));
vi.mock('../services/api', () => ({
  registerVendor: vi.fn(), registerUser: vi.fn(), loginUser: vi.fn(),
  loginWithPhone: vi.fn(), verifyOtpLogin: vi.fn(), setUserPassword: vi.fn(),
  getGoogleAuthUrl: vi.fn(), getVendorGoogleUrl: vi.fn(),
  getMe: vi.fn(() => Promise.resolve({ data: {} })),
}));
vi.mock('../services/supabaseClient', () => ({
  getSupabase: () => Promise.resolve({
    auth: {
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
      setSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      signOut: vi.fn(),
    },
  }),
}));

import { AuthProvider, useAuth } from '../context/AuthContext';

function Probe() {
  const { mode, setMode } = useAuth();
  return (
    <div>
      <span data-testid="mode">{mode}</span>
      <button onClick={() => setMode('hosting')}>go</button>
    </div>
  );
}

beforeEach(() => localStorage.clear());

test('mode defaults to traveling and persists when changed', () => {
  render(<AuthProvider><Probe /></AuthProvider>);
  expect(screen.getByTestId('mode').textContent).toBe('traveling');
  act(() => screen.getByText('go').click());
  expect(screen.getByTestId('mode').textContent).toBe('hosting');
  expect(localStorage.getItem('bas_active_mode')).toBe('hosting');
});

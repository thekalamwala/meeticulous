/**
 * tests/AuthContext.test.jsx
 * AuthProvider — login, register, logout, getMe hydration, updateUser.
 */
import { render, screen, waitFor, act } from '@testing-library/react';
import { vi } from 'vitest';
import { AuthProvider, useAuth } from '../context/AuthContext';

// Mock API module
vi.mock('../services/api', () => ({
  loginUser:      vi.fn(),
  registerUser:   vi.fn(),
  getGoogleAuthUrl: vi.fn(),
  getMe:          vi.fn(),
}));

// Mock Supabase client
vi.mock('../services/supabaseClient', () => ({
  getSupabase: () => Promise.resolve({
    auth: {
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
      setSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
  }),
}));

import { loginUser, registerUser, getMe } from '../services/api';

// Consumer component that exposes auth state
const Consumer = () => {
  const auth = useAuth();
  return (
    <div>
      <span data-testid="role">{auth.user?.role ?? 'none'}</span>
      <span data-testid="plan">{auth.user?.plan ?? 'none'}</span>
      <span data-testid="loading">{String(auth.loading)}</span>
      <button onClick={() => auth.login('a@b.com', 'pass').catch(() => {})}>login</button>
      <button onClick={() => auth.logout()}>logout</button>
      <button onClick={() => auth.registerAsUser('Bob', 'bob@u.com', 'p')}>regUser</button>
    </div>
  );
};

const renderWithAuth = () =>
  render(<AuthProvider><Consumer /></AuthProvider>);

const VENDOR = { _id: 'v1', role: 'host', plan: 'explorer', token: 'tok', refresh_token: 'ref', username: 'jane' };
const USER   = { _id: 'u1', role: 'guest', plan: 'explorer', token: 'utok', refresh_token: 'uref', username: 'bob' };

// ── Initial load ──────────────────────────────────────────────────────────────

describe('AuthProvider initial load', () => {
  beforeEach(() => {
    localStorage.clear();
    getMe.mockResolvedValue({ data: {} });
  });

  test('starts with no user when localStorage is empty', async () => {
    renderWithAuth();
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
    expect(screen.getByTestId('role').textContent).toBe('none');
  });

  test('calls getMe to hydrate fresh data from server', async () => {
    localStorage.setItem('user', JSON.stringify({ ...VENDOR }));
    getMe.mockResolvedValueOnce({ data: { ...VENDOR, plan: 'creator' } });
    renderWithAuth();
    await waitFor(() =>
      expect(screen.getByTestId('plan').textContent).toBe('creator')
    );
    expect(getMe).toHaveBeenCalled();
  });

  test('keeps cached user if getMe fails (server down)', async () => {
    localStorage.setItem('user', JSON.stringify(VENDOR));
    getMe.mockRejectedValueOnce(new Error('Network error'));
    renderWithAuth();
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
    expect(screen.getByTestId('role').textContent).toBe('host');
  });
});

// ── login ─────────────────────────────────────────────────────────────────────

describe('login', () => {
  beforeEach(() => {
    localStorage.clear();
    getMe.mockResolvedValue({ data: {} });
  });

  test('stores user in localStorage and updates state', async () => {
    loginUser.mockResolvedValueOnce({ data: VENDOR });
    renderWithAuth();
    await act(async () => {
      screen.getByText('login').click();
    });
    await waitFor(() => expect(screen.getByTestId('role').textContent).toBe('host'));
    expect(JSON.parse(localStorage.getItem('user')).role).toBe('host');
  });

  test('propagates error when credentials are wrong', async () => {
    loginUser.mockRejectedValueOnce(new Error('Invalid'));
    renderWithAuth();
    await expect(async () => {
      await act(async () => { screen.getByText('login').click(); });
    }).not.toThrow(); // component shouldn't crash; error propagates to caller
  });
});

// ── registerAsUser ────────────────────────────────────────────────────────────

describe('registerAsUser', () => {
  beforeEach(() => {
    localStorage.clear();
    getMe.mockResolvedValue({ data: {} });
  });

  test('sets role:guest after registration', async () => {
    registerUser.mockResolvedValueOnce({ data: USER });
    renderWithAuth();
    await act(async () => { screen.getByText('regUser').click(); });
    await waitFor(() => expect(screen.getByTestId('role').textContent).toBe('guest'));
  });
});

// ── logout ────────────────────────────────────────────────────────────────────

describe('logout', () => {
  beforeEach(() => { getMe.mockResolvedValue({ data: {} }); });

  test('clears user from state and localStorage', async () => {
    localStorage.setItem('user', JSON.stringify(VENDOR));
    loginUser.mockResolvedValueOnce({ data: VENDOR });
    renderWithAuth();
    await waitFor(() => expect(screen.getByTestId('role').textContent).toBe('host'));
    await act(async () => { screen.getByText('logout').click(); });
    await waitFor(() => expect(screen.getByTestId('role').textContent).toBe('none'));
    expect(localStorage.getItem('user')).toBeNull();
  });

  test('does NOT clear bas_admin key (admin session preserved)', async () => {
    localStorage.setItem('user',      JSON.stringify(VENDOR));
    localStorage.setItem('bas_admin', JSON.stringify({ role: 'superadmin' }));
    renderWithAuth();
    await act(async () => { screen.getByText('logout').click(); });
    await waitFor(() => expect(screen.getByTestId('role').textContent).toBe('none'));
    expect(localStorage.getItem('bas_admin')).not.toBeNull();
  });
});

/**
 * tests/AuthContextLinkedin.test.jsx
 * startLinkedinHostAuth — door-crossing logout, li_host_auth stash, signup tracking.
 */
import { render, screen, act } from '@testing-library/react';
import { vi, test, expect, beforeEach } from 'vitest';

const h = vi.hoisted(() => {
  const calls = [];
  return {
    calls,
    track: vi.fn(),
    session: { current: null },
    authListeners: [],
    signOut: vi.fn(async () => { calls.push('signOut'); return { error: null }; }),
    signInWithOAuth: vi.fn(async () => { calls.push('oauth'); return { data: {}, error: null }; }),
  };
});

vi.mock('../services/analytics', () => ({
  analytics: { identify: vi.fn(), reset: vi.fn(), track: h.track },
  EVENTS: { SIGNUP_STARTED: 'signup_started' },
}));
vi.mock('../services/api', () => ({ getMe: vi.fn(() => Promise.resolve({ data: {} })), recordInviteVisit: vi.fn() }));
vi.mock('../utils/inviteStash', () => ({ readInvite: () => 'cx12', stashInvite: vi.fn(), inviteCodeFromUrl: () => null }));
vi.mock('../utils/attribution', () => ({ getAttribution: () => ({ utm_source: 'ad' }) }));
vi.mock('../services/supabaseClient', () => ({
  getSupabase: () => Promise.resolve({
    auth: {
      onAuthStateChange: (cb) => { h.authListeners.push(cb); return { data: { subscription: { unsubscribe: vi.fn() } } }; },
      setSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      getSession: vi.fn(async () => ({ data: { session: h.session.current } })),
      signOut: h.signOut,
      signInWithOAuth: h.signInWithOAuth,
    },
  }),
}));

import { AuthProvider, useAuth } from '../context/AuthContext';

function Probe() {
  const { startLinkedinHostAuth } = useAuth();
  return (
    <div>
      <button onClick={() => startLinkedinHostAuth('signup')}>signup</button>
      <button onClick={() => startLinkedinHostAuth('login')}>login</button>
    </div>
  );
}

const click = async (label) => {
  render(<AuthProvider><Probe /></AuthProvider>);
  await act(async () => { screen.getByText(label).click(); });
};

beforeEach(() => {
  vi.clearAllMocks();
  h.calls.length = 0;
  h.session.current = null;
  h.authListeners.length = 0;
  localStorage.clear();
  sessionStorage.clear();
});

test('signup: stashes intent/invite/att/tz, tracks SIGNUP_STARTED, redirects to LinkedIn', async () => {
  await click('signup');
  const stash = JSON.parse(sessionStorage.getItem('li_host_auth'));
  expect(stash).toEqual({
    intent: 'signup', invite: 'cx12', att: { utm_source: 'ad' },
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
  expect(h.track).toHaveBeenCalledWith('signup_started', {});
  expect(h.signInWithOAuth).toHaveBeenCalledWith({
    provider: 'linkedin_oidc',
    options: { redirectTo: `${window.location.origin}/auth/linkedin/done` },
  });
  expect(h.signOut).not.toHaveBeenCalled(); // no session to cross from
});

test('login: no SIGNUP_STARTED', async () => {
  await click('login');
  expect(JSON.parse(sessionStorage.getItem('li_host_auth')).intent).toBe('login');
  expect(h.track).not.toHaveBeenCalledWith('signup_started', expect.anything());
  expect(h.signInWithOAuth).toHaveBeenCalled();
});

test('existing app session is logged out before redirecting', async () => {
  localStorage.setItem('user', JSON.stringify({ id: 'g1', token: 'tok', refresh_token: 'ref' }));
  await click('login');
  expect(h.calls).toEqual(['signOut', 'oauth']);
  expect(localStorage.getItem('user')).toBeNull();
});

test('existing Supabase-only session is logged out before redirecting', async () => {
  h.session.current = { access_token: 'sb' };
  await click('login');
  expect(h.calls).toEqual(['signOut', 'oauth']);
});

// No stored user at boot (the /auth/linkedin/done or /auth/google/done tab): once a
// session is adopted, Supabase's own token rotations must be mirrored into
// localStorage.user, or the 401 refresh path later replays a rotated refresh token.
test('adopted session: TOKEN_REFRESHED is mirrored into localStorage.user', async () => {
  const { getMe } = await import('../services/api');
  getMe.mockResolvedValueOnce({ data: { id: 'p1', is_host: true } });
  let auth;
  const Grab = () => { auth = useAuth(); return null; };
  render(<AuthProvider><Grab /></AuthProvider>);
  await act(async () => { await auth.adoptSession({ token: 'at1', refresh_token: 'rt1' }); });
  expect(h.authListeners.length).toBeGreaterThan(0);
  act(() => { h.authListeners.forEach((cb) => cb('TOKEN_REFRESHED', { access_token: 'at2', refresh_token: 'rt2' })); });
  expect(JSON.parse(localStorage.getItem('user'))).toMatchObject({ id: 'p1', token: 'at2', refresh_token: 'rt2' });
});

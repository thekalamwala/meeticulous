/**
 * tests/LinkedinAuthDone.test.jsx
 * /auth/linkedin/done — finishes the Supabase linkedin_oidc session, asks the
 * server to create/upgrade/log in the host, adopts the session, routes by `new`.
 */
import { StrictMode } from 'react';
import { render, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { vi, test, expect, beforeEach, describe } from 'vitest';

const h = vi.hoisted(() => {
  const calls = [];
  return {
    calls,
    exchange: vi.fn(async () => { calls.push('exchange'); return { data: { session: { access_token: 'xat', refresh_token: 'xrt' } }, error: null }; }),
    signOut: vi.fn(async () => { calls.push('signOut'); return { error: null }; }),
    setSession: vi.fn(async ({ access_token, refresh_token }) => {
      calls.push('setSession');
      return { data: { session: { access_token, refresh_token } }, error: null };
    }),
    linkedinHostAuth: vi.fn(async () => { calls.push('api'); return { data: { profile: { id: 'p1' }, new: '0' } }; }),
    adoptSession: vi.fn(async () => { calls.push('adopt'); return {}; }),
  };
});

vi.mock('../services/supabaseClient', () => ({
  getSupabase: () => Promise.resolve({ auth: { exchangeCodeForSession: h.exchange, signOut: h.signOut, setSession: h.setSession } }),
}));
vi.mock('../services/api', () => ({ linkedinHostAuth: h.linkedinHostAuth }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ adoptSession: h.adoptSession }) }));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../components/common/Seo', () => ({ default: () => null }));
vi.mock('../components/common/PetalSpinner', () => ({ default: () => null }));

import LinkedinAuthDone from '../pages/LinkedinAuthDone';

let landed = null;
const Where = () => { landed = useLocation(); return null; };

function renderAt(url, { strict = false } = {}) {
  window.history.replaceState(null, '', url);
  const tree = (
    <MemoryRouter initialEntries={['/auth/linkedin/done']}>
      <Routes>
        <Route path="/auth/linkedin/done" element={<LinkedinAuthDone />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>
  );
  return render(strict ? <StrictMode>{tree}</StrictMode> : tree);
}

const landedAt = async (path) => {
  await waitFor(() => expect(landed && landed.pathname + landed.search).toBe(path));
};

const apiError = (status, code) => Object.assign(new Error('x'), { response: { status, data: code ? { code } : {} } });

beforeEach(() => {
  landed = null;
  h.calls.length = 0;
  vi.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
});

describe('success', () => {
  test('code in query → exchange, then API, then adoptSession, in that order', async () => {
    sessionStorage.setItem('li_host_auth', JSON.stringify({ intent: 'signup', invite: 'cx12', tz: 'Asia/Kolkata' }));
    renderAt('/auth/linkedin/done?code=abc');
    await landedAt('/dashboard');
    expect(h.calls).toEqual(['exchange', 'api', 'adopt']);
    expect(h.exchange).toHaveBeenCalledWith('abc');
    expect(h.linkedinHostAuth).toHaveBeenCalledWith({ intent: 'signup', invite: 'cx12', tz: 'Asia/Kolkata' }, 'xat');
    expect(h.adoptSession).toHaveBeenCalledWith({ token: 'xat', refresh_token: 'xrt' });
    expect(sessionStorage.getItem('li_host_auth')).toBeNull();
    expect(h.signOut).not.toHaveBeenCalled();
  });

  test('hash tokens (implicit flow) → setSession, then API, then adoptSession', async () => {
    renderAt('/auth/linkedin/done#access_token=hat&refresh_token=hrt&token_type=bearer');
    await landedAt('/dashboard');
    expect(h.exchange).not.toHaveBeenCalled();
    expect(h.setSession).toHaveBeenCalledWith({ access_token: 'hat', refresh_token: 'hrt' });
    expect(h.calls).toEqual(['setSession', 'api', 'adopt']);
    expect(h.linkedinHostAuth).toHaveBeenCalledWith({}, 'hat');
    expect(h.adoptSession).toHaveBeenCalledWith({ token: 'hat', refresh_token: 'hrt' });
    // tokens scrubbed from the address bar
    expect(window.location.hash).toBe('');
  });

  test('new=1 → onboarding-guarded /dashboard (ignores a resume path)', async () => {
    sessionStorage.setItem('mt_after_host_login', '/submit-review');
    h.linkedinHostAuth.mockResolvedValueOnce({ data: { profile: {}, new: '1' } });
    renderAt('/auth/linkedin/done?code=abc');
    await landedAt('/dashboard');
  });

  test('returning host resumes the stashed path', async () => {
    sessionStorage.setItem('mt_after_host_login', '/submit-review');
    renderAt('/auth/linkedin/done?code=abc');
    await landedAt('/submit-review');
  });

  test('runs exactly once under StrictMode', async () => {
    renderAt('/auth/linkedin/done?code=abc', { strict: true });
    await landedAt('/dashboard');
    expect(h.exchange).toHaveBeenCalledTimes(1);
    expect(h.linkedinHostAuth).toHaveBeenCalledTimes(1);
    expect(h.adoptSession).toHaveBeenCalledTimes(1);
  });
});

describe('failure → redirect, signOut, no adopt', () => {
  const expectFailed = async (error) => {
    await landedAt(`/login-as-vendor?error=${error}`);
    expect(h.signOut).toHaveBeenCalled();
    expect(h.adoptSession).not.toHaveBeenCalled();
    expect(localStorage.getItem('user')).toBeNull();
  };

  test.each([
    [409, 'email_has_account', 'email_has_account'],
    [503, 'feature_disabled', 'linkedin_off'],
    [400, 'email_unverified', 'email_unverified'],
    [400, 'no_linkedin_identity', 'auth_failed'],
    [400, 'no_email', 'auth_failed'],
    [403, 'superadmin', 'auth_failed'],
    [404, undefined, 'auth_failed'],
  ])('API %s %s → error=%s', async (status, code, error) => {
    sessionStorage.setItem('li_host_auth', JSON.stringify({ intent: 'login' }));
    h.linkedinHostAuth.mockRejectedValueOnce(apiError(status, code));
    renderAt('/auth/linkedin/done?code=abc');
    await expectFailed(error);
    expect(sessionStorage.getItem('li_host_auth')).toBeNull();
  });

  test('hash path: setSession runs before the API and before signOut, so failure revokes', async () => {
    h.linkedinHostAuth.mockImplementationOnce(async () => { h.calls.push('api'); throw apiError(409, 'email_has_account'); });
    renderAt('/auth/linkedin/done#access_token=hat&refresh_token=hrt');
    await expectFailed('email_has_account');
    expect(h.calls).toEqual(['setSession', 'api', 'signOut']);
    expect(h.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  test('hash path: setSession error → auth_failed, API never called', async () => {
    h.setSession.mockResolvedValueOnce({ data: { session: null }, error: new Error('invalid JWT') });
    renderAt('/auth/linkedin/done#access_token=bad&refresh_token=bad');
    await expectFailed('auth_failed');
    expect(h.linkedinHostAuth).not.toHaveBeenCalled();
  });

  test('network error → auth_failed', async () => {
    h.linkedinHostAuth.mockRejectedValueOnce(new Error('Network Error'));
    renderAt('/auth/linkedin/done?code=abc');
    await expectFailed('auth_failed');
  });

  test('exchange error → auth_failed, API never called', async () => {
    h.exchange.mockResolvedValueOnce({ data: { session: null }, error: new Error('bad code') });
    renderAt('/auth/linkedin/done?code=abc');
    await expectFailed('auth_failed');
    expect(h.linkedinHostAuth).not.toHaveBeenCalled();
  });

  test('error_code in query → auth_failed', async () => {
    renderAt('/auth/linkedin/done?error=access_denied&error_code=bad_oauth_state');
    await expectFailed('auth_failed');
    expect(h.linkedinHostAuth).not.toHaveBeenCalled();
  });

  test('error_code in hash → auth_failed', async () => {
    renderAt('/auth/linkedin/done#error=server_error&error_code=unexpected_failure');
    await expectFailed('auth_failed');
    expect(h.linkedinHostAuth).not.toHaveBeenCalled();
  });

  test('nothing in the URL → auth_failed', async () => {
    renderAt('/auth/linkedin/done');
    await expectFailed('auth_failed');
    expect(h.linkedinHostAuth).not.toHaveBeenCalled();
  });

  test('adoptSession failure → auth_failed + signOut, no half-adopted user', async () => {
    h.adoptSession.mockImplementationOnce(async ({ token }) => {
      localStorage.setItem('user', JSON.stringify({ token }));
      throw new Error('getMe failed');
    });
    renderAt('/auth/linkedin/done?code=abc');
    await landedAt('/login-as-vendor?error=auth_failed');
    expect(h.signOut).toHaveBeenCalled();
    expect(localStorage.getItem('user')).toBeNull();
  });
});

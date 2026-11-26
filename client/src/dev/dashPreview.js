// DEV-ONLY dashboard preview — see the host dashboard without signing in.
//
// Why: host sign-in is Google OAuth with a callback fixed to localhost:5000, so a
// second local checkout (another port) can't sign in, and the redesign needs to be
// looked at page by page. This is NOT an auth flow: nothing is authenticated and no
// request leaves the browser. A fake host is put in localStorage and every API call
// is answered from ./dashPreviewFixtures.js (made-up data).
//
// Safety: active only when BOTH `import.meta.env.DEV` (Vite dev server; it is the
// literal `false` in production builds, so this whole branch is dropped) AND
// VITE_DASH_PREVIEW=1 in client/.env. Writes are swallowed locally, so the preview
// can never change real data.
//
// Use: VITE_DASH_PREVIEW=1 (and optionally VITE_DASH_PREVIEW_PLAN=pro) in
// client/.env, run the dev server, open /dashboard. Unknown endpoints answer []
// and log "[dash-preview] no fixture" so it is obvious what to add.
import { buildEmptyFixtures, buildFixtures } from './dashPreviewFixtures';

// Never under the test runner: Vitest loads client/.env too, so a developer with
// the preview switched on would otherwise run every test against fixtures.
export const DASH_PREVIEW = import.meta.env.DEV && import.meta.env.MODE !== 'test'
  && import.meta.env.VITE_DASH_PREVIEW === '1';

export function installDashPreview(api) {
  if (!DASH_PREVIEW) return;
  // Per-tab switches for checking every state without a restart:
  //   ?dash_plan=pro|starter   ?dash_state=loading|error|empty|off
  // Remembered for the tab (sessionStorage), so in-app navigation keeps them.
  const pick = (k) => {
    try {
      const v = new URLSearchParams(window.location.search).get(k);
      if (v) sessionStorage.setItem(k, v);
      return sessionStorage.getItem(k);
    } catch { return null; }
  };
  const planPick = pick('dash_plan');
  const state = pick('dash_state');
  const pro = planPick ? planPick === 'pro' : import.meta.env.VITE_DASH_PREVIEW_PLAN === 'pro';
  const fixtures = { ...buildFixtures({ pro }), ...(state === 'empty' ? buildEmptyFixtures({ pro }) : {}) };
  // loading/error apply to page data only, never to the session or the flags.
  const SHELL = ['/auth/me', '/feature-flags', '/notifications', '/notifications/channel', '/support/unread', '/onboarding/status'];

  try {
    localStorage.setItem('user', JSON.stringify({ ...fixtures['/auth/me'], token: 'dash-preview' }));
  } catch { /* storage blocked — the dashboard will just show logged out */ }

  api.defaults.adapter = async (config) => {
    const method = (config.method || 'get').toUpperCase();
    const path = String(config.url || '').split('?')[0];
    // State checks (dev only): set window.__DASH_PREVIEW_STATE = { '/crm/customers':
    // { status: 403, data: {...} } | { delay: 4000 } } to see loading / error / locked
    // states. Keys match a path prefix.
    const hook = Object.entries(window.__DASH_PREVIEW_STATE || {}).find(([k]) => path.startsWith(k))?.[1];
    if (hook?.delay) await new Promise((r) => { setTimeout(r, hook.delay); });
    if (hook?.status) {
      const err = new Error(`[dash-preview] ${hook.status} ${path}`);
      err.response = { status: hook.status, data: hook.data || {}, config };
      throw err;
    }
    if (hook && 'data' in hook) return { data: hook.data, status: 200, statusText: 'OK', headers: {}, config, request: {} };
    let data;
    if (method === 'GET' && !SHELL.includes(path)) {
      if (state === 'loading') return new Promise(() => {});
      if (state === 'error') {
        const err = new Error('dash-preview: simulated failure');
        err.config = config;
        err.response = { status: 500, data: { message: 'Simulated' }, config };
        throw err;
      }
    }
    if (method === 'GET') {
      data = fixtures[path];
      if (data === undefined) {
        // eslint-disable-next-line no-console
        console.info(`[dash-preview] no fixture for GET ${path}`);
        data = [];
      }
    } else {
      data = { success: true, preview: true }; // never reaches a server
    }
    // A fixture that is an Error simulates a failed read (error-state screenshots).
    if (data instanceof Error) throw Object.assign(data, { config, response: { status: 500, data: {} } });
    // A fixture can stand for a failing endpoint, so error states can be seen.
    if (data && data.__previewError) {
      return Promise.reject(Object.assign(new Error(`[dash-preview] ${data.__previewError}`), {
        config, response: { status: data.__previewError, data: { message: 'Preview error' }, headers: {}, config },
      }));
    }
    return { data, status: 200, statusText: 'OK', headers: {}, config, request: {} };
  };
  // eslint-disable-next-line no-console
  console.info(`[dash-preview] on (${pro ? 'Pro' : 'Starter'}) — sample data, no requests leave the browser`);
}

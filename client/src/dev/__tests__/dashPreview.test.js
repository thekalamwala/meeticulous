import { describe, it, expect, vi, afterEach } from 'vitest';
import axios from 'axios';

// The preview must be inert unless explicitly switched on, and when on it must
// never let a request reach a server.
afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); localStorage.clear(); });

describe('dashPreview', () => {
  it('does nothing unless VITE_DASH_PREVIEW=1', async () => {
    vi.stubEnv('VITE_DASH_PREVIEW', '');
    const { installDashPreview, DASH_PREVIEW } = await import('../dashPreview');
    const api = axios.create();
    const before = api.defaults.adapter;
    installDashPreview(api);
    expect(DASH_PREVIEW).toBe(false);
    expect(api.defaults.adapter).toBe(before);
    expect(localStorage.getItem('user')).toBeNull();
  });

  it('answers from fixtures and swallows writes when on', async () => {
    vi.stubEnv('VITE_DASH_PREVIEW', '1');
    const { installDashPreview } = await import('../dashPreview');
    const api = axios.create({ baseURL: 'http://localhost:9/api' });
    installDashPreview(api);

    const { data: kyc } = await api.get('/kyc/me?x=1');
    expect(kyc.status).toBe('not_started');
    const { data: unknown } = await api.get('/nope');
    expect(unknown).toEqual([]);
    const { data: wrote } = await api.post('/bookings/abc/confirm', {});
    expect(wrote.preview).toBe(true);
    expect(JSON.parse(localStorage.getItem('user')).token).toBe('dash-preview');
  });
});

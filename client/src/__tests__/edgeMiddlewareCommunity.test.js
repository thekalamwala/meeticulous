import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import middleware from '../../middleware.js';

const GOOGLEBOT = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
const CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const req = (path, ua) => new Request(`https://meeticulous.com${path}`, { headers: { 'user-agent': ua } });
const prerenderCalls = (fetchMock) => fetchMock.mock.calls.map(([u]) => String(u)).filter((u) => u.includes('/prerender/'));

let fetchMock;
beforeEach(() => {
  fetchMock = vi.fn(async (url) => (String(url).includes('/prerender/')
    ? new Response('<html>community</html>', { status: 200, headers: { 'Cache-Control': 'public, max-age=120, s-maxage=300' } })
    : new Response(JSON.stringify({ found: true, current: 'some-host' }), { status: 200 })));
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe('edge: community crawler routing', () => {
  it('Googlebot on /community/t/x gets the prerender', async () => {
    const res = await middleware(req('/community/t/x', GOOGLEBOT));
    expect(prerenderCalls(fetchMock)).toEqual(['https://meeticulous-api.onrender.com/prerender/community/t/x']);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('community');
  });

  it('bingbot and AI crawlers on /community get the prerender too', async () => {
    await middleware(req('/community', 'Mozilla/5.0 (compatible; bingbot/2.0)'));
    await middleware(req('/community/s/help', 'GPTBot/1.1'));
    expect(prerenderCalls(fetchMock)).toHaveLength(2);
  });

  it('Googlebot on /some-host is unchanged: no prerender', async () => {
    await middleware(req('/some-host', GOOGLEBOT));
    expect(prerenderCalls(fetchMock)).toEqual([]);
  });

  it('a normal browser on /community does not hit the prerender', async () => {
    const res = await middleware(req('/community', CHROME));
    expect(prerenderCalls(fetchMock)).toEqual([]);
    expect(res).toBeUndefined(); // continues to the SPA
  });

  it.each([
    [404, null],
    [410, null],
    [301, 'https://meeticulous.com/community/t/x'],
  ])('passes the prerender status %i through for community', async (status, location) => {
    fetchMock.mockImplementation(async () => new Response(status === 301 ? null : 'gone', {
      status,
      headers: { 'Cache-Control': 'public, max-age=60', ...(location ? { Location: location } : {}) },
    }));
    const res = await middleware(req('/community/p/x', GOOGLEBOT));
    expect(res.status).toBe(status);
    if (location) expect(res.headers.get('location')).toBe(location);
    expect(fetchMock.mock.calls[0][1].redirect).toBe('manual');
  });

  it('a prerender 5xx falls through to the SPA', async () => {
    fetchMock.mockImplementation(async () => new Response('err', { status: 500 }));
    const res = await middleware(req('/community/t/x', GOOGLEBOT));
    expect(res).toBeUndefined();
  });
});

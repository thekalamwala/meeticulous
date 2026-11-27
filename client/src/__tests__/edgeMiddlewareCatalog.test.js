import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import middleware from '../../middleware.js';

const GOOGLEBOT = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
const CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const req = (path, ua) => new Request(`https://meeticulous.com${path}`, { headers: { 'user-agent': ua } });
const prerenderCalls = (fetchMock) => fetchMock.mock.calls.map(([u]) => String(u)).filter((u) => u.includes('/prerender/'));

let prerender; // what the prerender answers this test
let fetchMock;
beforeEach(() => {
  prerender = () => new Response('<html>shell</html>', { status: 200 });
  fetchMock = vi.fn(async (url) => (String(url).includes('/prerender/') ? prerender() : new Response('{}', { status: 200 })));
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe('edge: catalog item URLs', () => {
  it('old /:u/product/:key 301s to /:u/products/:key for everyone, keeping the query, no API call', async () => {
    const res = await middleware(req('/jane/product/3f2b8c1e-9d4a-4e6b-8f1a-2c3d4e5f6a7b?dl=tok', CHROME));
    expect(res.status).toBe(301);
    expect(res.headers.get('location')).toBe('https://meeticulous.com/jane/products/3f2b8c1e-9d4a-4e6b-8f1a-2c3d4e5f6a7b?dl=tok');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('old /:u/course/:key 301s to /:u/courses/:key', async () => {
    const res = await middleware(req('/jane/course/demo-ux-101', GOOGLEBOT));
    expect(res.status).toBe(301);
    expect(res.headers.get('location')).toBe('https://meeticulous.com/jane/courses/demo-ux-101');
  });

  it('a reserved first segment is never treated as a host (dashboard/product/add-new)', async () => {
    const res = await middleware(req('/dashboard/product/add-new', CHROME));
    expect(res?.status).not.toBe(301);
  });

  it('social bot on /:u/products/:slug gets the prerender shell', async () => {
    const res = await middleware(req('/jane/products/brand-kit', 'facebookexternalhit/1.1'));
    expect(prerenderCalls(fetchMock)).toEqual(['https://meeticulous-api.onrender.com/prerender/jane/products/brand-kit']);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('shell');
  });

  it('Googlebot gets the prerender 301 for a non-canonical key…', async () => {
    prerender = () => new Response(null, { status: 301, headers: { Location: 'https://meeticulous.com/jane/products/brand-kit' } });
    const res = await middleware(req('/jane/products/demo-brand-kit', GOOGLEBOT));
    expect(res.status).toBe(301);
    expect(res.headers.get('location')).toBe('https://meeticulous.com/jane/products/brand-kit');
  });

  it('…but the baked page (not the shell) on a canonical 200', async () => {
    const res = await middleware(req('/jane/courses/ux-101', GOOGLEBOT));
    expect(prerenderCalls(fetchMock)).toHaveLength(1);
    expect(res).toBeUndefined(); // continues to the baked static page
  });

  it('a person on /:u/products/:slug never hits the prerender', async () => {
    const res = await middleware(req('/jane/products/brand-kit', CHROME));
    expect(prerenderCalls(fetchMock)).toEqual([]);
    expect(res).toBeUndefined();
  });
});

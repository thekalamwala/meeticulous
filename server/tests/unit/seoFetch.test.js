// server/tests/unit/seoFetch.test.js
const { fetchUrl } = require('../../services/seo/seoFetch');

describe('seoFetch', () => {
  afterEach(() => { global.fetch = undefined; });

  test('returns status, body, timing and a normal-browser UA request (not a bot UA Cloudflare blocks)', async () => {
    let sentHeaders;
    global.fetch = jest.fn(async (url, init) => {
      sentHeaders = init.headers;
      return { status: 200, url, headers: new Map([['content-type', 'text/html']]), text: async () => '<title>ok</title>' };
    });
    const r = await fetchUrl('https://bookasloth.com/');
    expect(r.status).toBe(200);
    expect(r.body).toContain('ok');
    expect(r.responseMs).toBeGreaterThanOrEqual(0);
    expect(String(sentHeaders['User-Agent'])).toMatch(/Chrome/);
    expect(String(sentHeaders['User-Agent'])).toContain('BookASlothSEOBot');
    expect(String(sentHeaders['User-Agent'])).not.toMatch(/ClaudeBot/i);
  });

  test('captures fetch errors without throwing', async () => {
    global.fetch = jest.fn(async () => { throw new Error('ECONNREFUSED'); });
    const r = await fetchUrl('https://bookasloth.com/x');
    expect(r.status).toBeNull();
    expect(r.error).toMatch(/ECONNREFUSED/);
  });
});

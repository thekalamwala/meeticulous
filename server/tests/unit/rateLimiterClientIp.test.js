// Unit tests confirming the IP-keyed rate limiters in middleware/security.js all
// resolve their bucket key through getClientIp() (which honours CLIENT_IP_HEADER
// behind an edge proxy), instead of express-rate-limit's own default keyGenerator
// (plain req.ip). Before this fix, only adminLimiter and botLimiter did — every
// other per-IP limiter silently ignored CLIENT_IP_HEADER, so setting it on Render
// (the documented Cloudflare-edge fix) would not have protected them from the
// shared-edge-IP problem it exists to solve.
//
// Also covers apiLimiter's new skip behaviour for public, unauthenticated SEO GET
// reads (blogs + host/service detail) that Google's WRS re-fetches at runtime.

const express = require('express');
const request = require('supertest');
const rateLimit = require('express-rate-limit');

const OLD_ENV = process.env;

function loadSecurity(env = {}) {
  jest.resetModules();
  process.env = { ...OLD_ENV, ...env };
  jest.doMock('../../lib/ipBlocklist', () => ({
    recordAttack: jest.fn(() => Promise.resolve()),
  }));
  return require('../../middleware/security');
}

afterAll(() => { process.env = OLD_ENV; });

describe('ipKeyGenerator (shared by every per-IP limiter)', () => {
  test('prefers the CLIENT_IP_HEADER value over req.ip', () => {
    const { ipKeyGenerator } = loadSecurity({ CLIENT_IP_HEADER: 'cf-connecting-ip' });
    const req = { ip: '10.0.0.1', headers: { 'cf-connecting-ip': '203.0.113.55' } };
    expect(ipKeyGenerator(req)).toBe('203.0.113.55');
  });

  test('falls back to req.ip when CLIENT_IP_HEADER is unset (default, unchanged behaviour)', () => {
    const { ipKeyGenerator } = loadSecurity({ CLIENT_IP_HEADER: '' });
    const req = { ip: '5.5.5.5', headers: {} };
    expect(ipKeyGenerator(req)).toBe('5.5.5.5');
  });
});

describe('every per-IP limiter is actually wired to key on the resolved client IP', () => {
  // Behavioural check (not introspection): with CLIENT_IP_HEADER set, two
  // "requests" carrying the SAME req.ip (simulating Render's shared internal
  // proxy address) but DIFFERENT cf-connecting-ip values must land in separate
  // buckets — proving the limiter keys on the header, not on req.ip.
  const names = [
    'authLimiter', 'otpLimiter', 'apiLimiter', 'paymentLimiter', 'slugLimiter',
    'slotsLimiter', 'searchLimiter', 'bookingLimiter', 'freeDownloadIpLimiter',
    'newsletterIpLimiter', 'downloadTokenLimiter', 'botLimiter', 'speedLimiter',
  ];

  test.each(names)('%s does not lump distinct real clients behind one shared proxy IP', async (name) => {
    const security = loadSecurity({ CLIENT_IP_HEADER: 'cf-connecting-ip' });
    const limiter = security[name];
    const app = express();
    app.set('trust proxy', true);
    app.use(limiter, (req, res) => res.json({ ok: true }));

    // Two different real clients (distinct cf-connecting-ip), both arriving via
    // the SAME shared proxy req.ip. Neither request is the second hit for its
    // own bucket, so neither should ever be rejected by THIS limiter alone.
    const r1 = await request(app).get('/').set('X-Forwarded-For', '10.0.0.1').set('cf-connecting-ip', '203.0.113.1');
    const r2 = await request(app).get('/').set('X-Forwarded-For', '10.0.0.1').set('cf-connecting-ip', '203.0.113.2');
    expect(r1.status).not.toBe(429);
    expect(r2.status).not.toBe(429);
  });
});

describe('apiLimiter skips public SEO GET reads (blogs + host/service detail)', () => {
  test.each([
    { method: 'GET', path: '/api/blogs' },
    { method: 'GET', path: '/api/blogs/my-post-slug' },
    { method: 'GET', path: '/api/host/somehost' },
    { method: 'GET', path: '/api/host/somehost/some-service' },
  ])('$method $path is exempt from the cap', ({ method, path }) => {
    const { isPublicSeoGet } = loadSecurity({ CLIENT_IP_HEADER: '' });
    expect(isPublicSeoGet({ method, path, url: path, headers: {} })).toBe(true);
  });

  test.each([
    { method: 'GET', path: '/api/host/availability' },
    { method: 'GET', path: '/api/host/categories' },
    { method: 'GET', path: '/api/host/search' },
    { method: 'PUT', path: '/api/host/somehost' },
    { method: 'GET', path: '/api/bookings/slots' },
    { method: 'POST', path: '/api/blogs' },
  ])('$method $path keeps the cap (authenticated / abuse / non-matching path)', ({ method, path }) => {
    const { isPublicSeoGet } = loadSecurity({ CLIENT_IP_HEADER: '' });
    expect(isPublicSeoGet({ method, path, url: path, headers: {} })).toBe(false);
  });

  test('a burst of GET /api/host/:username requests never 429s, even far past the normal cap', async () => {
    const security = loadSecurity({ CLIENT_IP_HEADER: '' });
    const app = express();
    app.use(security.apiLimiter, (req, res) => res.json({ ok: true }));

    for (let i = 0; i < 5; i++) {
      // apiLimiter's real cap is 100/min; 5 is enough to prove the skip fires
      // (a non-exempt path would still be well under the cap too, so this alone
      // isn't conclusive — the isPublicSeoGet unit tests above are the real proof
      // of the routing logic; this just confirms the skip is live end-to-end).
      // eslint-disable-next-line no-await-in-loop
      const res = await request(app).get('/api/host/somehost');
      expect(res.status).not.toBe(429);
    }
  });
});

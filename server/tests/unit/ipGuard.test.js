// Unit tests for ipGuard + offenseTracker + getClientIp. ipBlocklist is mocked so
// these tests focus purely on the middleware behaviour (enforcement, exemptions,
// fail-open, 429 → offense recording, header-based client IP).

const OLD_ENV = process.env;

function mockRes() {
  const res = { statusCode: 200, body: undefined, _finish: null };
  res.status = jest.fn((c) => { res.statusCode = c; return res; });
  res.json = jest.fn((b) => { res.body = b; return res; });
  res.on = jest.fn((ev, cb) => { if (ev === 'finish') res._finish = cb; });
  return res;
}

function load({ env = {}, blocklist = {}, jwtVerify } = {}) {
  jest.resetModules();
  process.env = { ...OLD_ENV, IP_BLOCK_ENABLED: 'true', ...env };
  const mock = {
    isBlocked: blocklist.isBlocked || jest.fn(() => false),
    recordRateLimitViolation: blocklist.recordRateLimitViolation || jest.fn(() => Promise.resolve()),
  };
  jest.doMock('../../lib/ipBlocklist', () => mock);
  // Admin JWT verifier (used by the offense-tracker admin exemption). Default
  // rejects — i.e. no valid admin token — so anonymous traffic is still tracked.
  jest.doMock('../../services/adminAuthService', () => ({
    jwtVerify: jwtVerify || jest.fn(() => { throw new Error('no token'); }),
  }));
  // loadTestMode is real; default off. Allow override via env if a test needs it.
  const mod = require('../../middleware/ipGuard');
  return { mod, mock };
}

afterAll(() => { process.env = OLD_ENV; });

describe('ipGuard enforcement', () => {
  test('403s a banned IP and does not call next', () => {
    const { mod } = load({ blocklist: { isBlocked: jest.fn(() => true) } });
    const req = { ip: '1.2.3.4', path: '/api/host/services', headers: {} };
    const res = mockRes();
    const next = jest.fn();

    mod.ipGuard(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: 'Access denied.' });
    expect(next).not.toHaveBeenCalled();
  });

  test('passes a non-banned IP through', () => {
    const { mod } = load({ blocklist: { isBlocked: jest.fn(() => false) } });
    const req = { ip: '1.2.3.4', path: '/api/host/services', headers: {} };
    const res = mockRes();
    const next = jest.fn();

    mod.ipGuard(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  test('never blocks the Razorpay webhook path even if the IP is banned', () => {
    const isBlocked = jest.fn(() => true);
    const { mod } = load({ blocklist: { isBlocked } });
    const req = { ip: '1.2.3.4', path: '/api/payment/webhook', headers: {} };
    const res = mockRes();
    const next = jest.fn();

    mod.ipGuard(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
    expect(isBlocked).not.toHaveBeenCalled(); // exempt short-circuits before the lookup
  });

  test('never blocks the health probe', () => {
    const { mod } = load({ blocklist: { isBlocked: jest.fn(() => true) } });
    const req = { ip: '1.2.3.4', path: '/health', headers: {} };
    const res = mockRes();
    const next = jest.fn();

    mod.ipGuard(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  test('never blocks the public blog endpoint (prerender build fetch)', () => {
    const { mod } = load({ blocklist: { isBlocked: jest.fn(() => true) } });
    const res = mockRes();
    const next = jest.fn();
    mod.ipGuard({ ip: '1.2.3.4', path: '/api/blogs', headers: {} }, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  // Regression: the real sitemap routes are `/sitemap.xml`, `/sitemap-hosts.xml`,
  // `/sitemap-services-2.xml`, … — the '.'/'-' after the prefix. The old matcher
  // only accepted '/' or '?', so a banned build IP still 403'd every sitemap file
  // and killed the deploy. All of these must be exempt (never 403).
  test.each([
    '/sitemap.xml',
    '/sitemap-pages.xml',
    '/sitemap-hosts.xml',
    '/sitemap-hosts-2.xml',
    '/sitemap-services.xml',
    '/sitemap-blog.xml',
  ])('never blocks the prerender sitemap file %s even when the IP is banned', (path) => {
    const { mod } = load({ blocklist: { isBlocked: jest.fn(() => true) } });
    const res = mockRes();
    const next = jest.fn();
    mod.ipGuard({ ip: '1.2.3.4', path, headers: {} }, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  test('a bare non-exempt lookalike (/sitemapper-evil) is NOT exempt', () => {
    const isBlocked = jest.fn(() => true);
    const { mod } = load({ blocklist: { isBlocked } });
    const res = mockRes();
    mod.ipGuard({ ip: '1.2.3.4', path: '/sitemapper-evil', headers: {} }, res, jest.fn());
    // 'r' after '/sitemap' is not a boundary char → not exempt → blocked.
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('disabled (IP_BLOCK_ENABLED=false) passes everything through', () => {
    const { mod } = load({ env: { IP_BLOCK_ENABLED: 'false' }, blocklist: { isBlocked: jest.fn(() => true) } });
    const req = { ip: '1.2.3.4', path: '/api/host/services', headers: {} };
    const res = mockRes();
    const next = jest.fn();

    mod.ipGuard(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  test('fails open if the blocklist throws', () => {
    const { mod } = load({ blocklist: { isBlocked: jest.fn(() => { throw new Error('cache boom'); }) } });
    const req = { ip: '1.2.3.4', path: '/api/host/services', headers: {} };
    const res = mockRes();
    const next = jest.fn();

    mod.ipGuard(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});

describe('offenseTracker', () => {
  test('records a rate-limit violation when the response is 429', () => {
    const recordRateLimitViolation = jest.fn(() => Promise.resolve());
    const { mod } = load({ blocklist: { recordRateLimitViolation } });
    const req = { ip: '9.8.7.6', path: '/api/auth/login', headers: {} };
    const res = mockRes();
    const next = jest.fn();

    mod.offenseTracker(req, res, next);
    expect(next).toHaveBeenCalled();

    res.statusCode = 429;
    res._finish(); // simulate response finishing

    expect(recordRateLimitViolation).toHaveBeenCalledWith('9.8.7.6');
  });

  test('does NOT record a 429 on an exempt path (sitemap) — the build burst must not auto-ban', () => {
    const recordRateLimitViolation = jest.fn(() => Promise.resolve());
    const { mod } = load({ blocklist: { recordRateLimitViolation } });
    const req = { ip: '3.81.219.26', path: '/sitemap-hosts.xml', headers: {} };
    const res = mockRes();

    mod.offenseTracker(req, res, jest.fn());
    res.statusCode = 429;
    res._finish();

    expect(recordRateLimitViolation).not.toHaveBeenCalled();
  });

  test('does NOT record on a normal 200 response', () => {
    const recordRateLimitViolation = jest.fn(() => Promise.resolve());
    const { mod } = load({ blocklist: { recordRateLimitViolation } });
    const req = { ip: '9.8.7.6', path: '/api/auth/login', headers: {} };
    const res = mockRes();

    mod.offenseTracker(req, res, jest.fn());
    res.statusCode = 200;
    res._finish();

    expect(recordRateLimitViolation).not.toHaveBeenCalled();
  });

  test('does NOT record a 429 from an authenticated admin (exempt from auto-ban)', () => {
    const recordRateLimitViolation = jest.fn(() => Promise.resolve());
    const { mod } = load({
      blocklist: { recordRateLimitViolation },
      jwtVerify: jest.fn(() => ({ type: 'admin', sub: 'a1' })), // valid admin token
    });
    const req = { ip: '9.8.7.6', path: '/api/admin/crm/leads', headers: { authorization: 'Bearer good' } };
    const res = mockRes();

    mod.offenseTracker(req, res, jest.fn());
    res.statusCode = 429;
    res._finish();

    expect(recordRateLimitViolation).not.toHaveBeenCalled();
  });

  test('DOES record a 429 when the bearer token is not a valid admin token', () => {
    const recordRateLimitViolation = jest.fn(() => Promise.resolve());
    const { mod } = load({
      blocklist: { recordRateLimitViolation },
      jwtVerify: jest.fn(() => { throw new Error('bad signature'); }),
    });
    const req = { ip: '9.8.7.6', path: '/api/admin/crm/leads', headers: { authorization: 'Bearer forged' } };
    const res = mockRes();

    mod.offenseTracker(req, res, jest.fn());
    res.statusCode = 429;
    res._finish();

    expect(recordRateLimitViolation).toHaveBeenCalledWith('9.8.7.6');
  });

  test('DOES record a 429 for a non-admin token type (e.g. a vendor token)', () => {
    const recordRateLimitViolation = jest.fn(() => Promise.resolve());
    const { mod } = load({
      blocklist: { recordRateLimitViolation },
      jwtVerify: jest.fn(() => ({ type: 'vendor' })),
    });
    const req = { ip: '9.8.7.6', path: '/api/host/services', headers: { authorization: 'Bearer vendor' } };
    const res = mockRes();

    mod.offenseTracker(req, res, jest.fn());
    res.statusCode = 429;
    res._finish();

    expect(recordRateLimitViolation).toHaveBeenCalledWith('9.8.7.6');
  });
});

describe('isPublicHostRead — public host/service detail GETs are exempt', () => {
  test.each([
    '/api/host/somehost',
    '/api/host/somehost/some-service-slug',
  ])('%s (GET) is exempt', (path) => {
    const { mod } = load({ blocklist: { isBlocked: jest.fn(() => true) } });
    const res = mockRes();
    const next = jest.fn();
    mod.ipGuard({ ip: '1.2.3.4', method: 'GET', path, headers: {} }, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  test.each([
    '/api/host/availability',
    '/api/host/categories',
    '/api/host/search',
    '/api/host/username',
    '/api/host/services',
  ])('%s (GET) is NOT exempt (reserved sub-route, auth-gated or a write path)', (path) => {
    const { mod } = load({ blocklist: { isBlocked: jest.fn(() => true) } });
    const res = mockRes();
    const next = jest.fn();
    mod.ipGuard({ ip: '1.2.3.4', method: 'GET', path, headers: {} }, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  test('a PUT to /api/host/:username is NOT exempt even though the path shape matches', () => {
    const { mod } = load({ blocklist: { isBlocked: jest.fn(() => true) } });
    const res = mockRes();
    const next = jest.fn();
    mod.ipGuard({ ip: '1.2.3.4', method: 'PUT', path: '/api/host/somehost', headers: {} }, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('offenseTracker does not record a 429 from a public host/service read', () => {
    const recordRateLimitViolation = jest.fn(() => Promise.resolve());
    const { mod } = load({ blocklist: { recordRateLimitViolation } });
    const req = { ip: '9.8.7.6', method: 'GET', path: '/api/host/somehost/some-service', headers: {} };
    const res = mockRes();

    mod.offenseTracker(req, res, jest.fn());
    res.statusCode = 429;
    res._finish();

    expect(recordRateLimitViolation).not.toHaveBeenCalled();
  });
});

describe('prerender build exemption (x-prerender-token)', () => {
  const TOKEN = 'build-secret-abc123';

  test('a banned IP with the correct token passes through (build runner never banned)', () => {
    const isBlocked = jest.fn(() => true);
    const { mod } = load({ env: { PRERENDER_BUILD_TOKEN: TOKEN }, blocklist: { isBlocked } });
    const req = { ip: '1.2.3.4', path: '/api/host/sndatarkar', headers: { 'x-prerender-token': TOKEN } };
    const res = mockRes();
    const next = jest.fn();

    mod.ipGuard(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
    expect(isBlocked).not.toHaveBeenCalled(); // identity exemption short-circuits before the lookup
  });

  test('a banned IP with a WRONG token is still blocked', () => {
    const { mod } = load({ env: { PRERENDER_BUILD_TOKEN: TOKEN }, blocklist: { isBlocked: jest.fn(() => true) } });
    const req = { ip: '1.2.3.4', path: '/api/host/sndatarkar', headers: { 'x-prerender-token': 'nope' } };
    const res = mockRes();

    mod.ipGuard(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('the token header is inert when PRERENDER_BUILD_TOKEN is unset (fails safe)', () => {
    // Empty string is falsy → isPrerenderBuild treats it as unset, same as absent.
    const { mod } = load({ env: { PRERENDER_BUILD_TOKEN: '' }, blocklist: { isBlocked: jest.fn(() => true) } });
    const req = { ip: '1.2.3.4', path: '/api/host/sndatarkar', headers: { 'x-prerender-token': TOKEN } };
    const res = mockRes();

    mod.ipGuard(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('an authed write route (/api/host/services) is NOT exempted by identity without a token', () => {
    const { mod } = load({ env: { PRERENDER_BUILD_TOKEN: TOKEN }, blocklist: { isBlocked: jest.fn(() => true) } });
    const req = { ip: '1.2.3.4', path: '/api/host/services', headers: {} };
    const res = mockRes();

    mod.ipGuard(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(403); // path is not exempt; no token → still ban-enforced
  });

  test('offenseTracker does NOT record a 429 from the build runner (correct token)', () => {
    const recordRateLimitViolation = jest.fn(() => Promise.resolve());
    const { mod } = load({ env: { PRERENDER_BUILD_TOKEN: TOKEN }, blocklist: { recordRateLimitViolation } });
    const req = { ip: '3.81.219.26', path: '/api/host/sndatarkar', headers: { 'x-prerender-token': TOKEN } };
    const res = mockRes();

    mod.offenseTracker(req, res, jest.fn());
    res.statusCode = 429;
    res._finish();

    expect(recordRateLimitViolation).not.toHaveBeenCalled();
  });

  test('offenseTracker DOES record a 429 when the token is wrong', () => {
    const recordRateLimitViolation = jest.fn(() => Promise.resolve());
    const { mod } = load({ env: { PRERENDER_BUILD_TOKEN: TOKEN }, blocklist: { recordRateLimitViolation } });
    const req = { ip: '3.81.219.26', path: '/api/host/sndatarkar', headers: { 'x-prerender-token': 'nope' } };
    const res = mockRes();

    mod.offenseTracker(req, res, jest.fn());
    res.statusCode = 429;
    res._finish();

    expect(recordRateLimitViolation).toHaveBeenCalledWith('3.81.219.26');
  });
});

describe('getClientIp', () => {
  test('uses req.ip when no CLIENT_IP_HEADER is configured', () => {
    const { mod } = load();
    expect(mod.getClientIp({ ip: '5.5.5.5', headers: {} })).toBe('5.5.5.5');
  });

  test('reads the configured header (first value) when set', () => {
    const { mod } = load({ env: { CLIENT_IP_HEADER: 'cf-connecting-ip' } });
    const req = { ip: '10.0.0.1', headers: { 'cf-connecting-ip': '203.0.113.7, 70.41.3.18' } };
    expect(mod.getClientIp(req)).toBe('203.0.113.7');
  });

  test('falls back to req.ip when the configured header is absent', () => {
    const { mod } = load({ env: { CLIENT_IP_HEADER: 'cf-connecting-ip' } });
    expect(mod.getClientIp({ ip: '10.0.0.1', headers: {} })).toBe('10.0.0.1');
  });
});

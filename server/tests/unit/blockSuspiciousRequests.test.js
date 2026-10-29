'use strict';
/**
 * blockSuspiciousRequests — a hit auto-bans the client IP for 24h, so a false
 * positive locks a real user out. Regression: 2026-10-05 the founder's IP was
 * banned importing a cold-call CSV whose WhatsApp cell held "..." (bare `..`
 * matched anywhere in the JSON body). Path traversal is now URL/query-only and
 * must have a real traversal shape (`../`, `..\`, `%2e%2e%2f`).
 */
jest.mock('../../lib/ipBlocklist', () => ({
  isBlocked: jest.fn(() => false),
  recordAttack: jest.fn(() => Promise.resolve()),
  recordRateLimitViolation: jest.fn(() => Promise.resolve()),
}));

const ipBlocklist = require('../../lib/ipBlocklist');
const { blockSuspiciousRequests } = require('../../middleware/security');

function mockRes() {
  const res = { statusCode: 200 };
  res.status = jest.fn((c) => { res.statusCode = c; return res; });
  res.json = jest.fn(() => res);
  return res;
}

function run({ url = '/api/x', query = {}, body = {} }) {
  const req = { url, query, body, ip: '203.0.113.7', headers: {} };
  const res = mockRes();
  const next = jest.fn();
  blockSuspiciousRequests(req, res, next);
  return { res, next };
}

beforeEach(() => ipBlocklist.recordAttack.mockClear());

describe('blockSuspiciousRequests', () => {
  test('dots in a JSON body pass and never ban', () => {
    const { res, next } = run({
      url: '/api/admin/crm/cold-calls/import',
      body: { note: 'see you.. Currently...', whatsapp: '...', name: 'Dr.. Mehta', path: '../notes' },
    });
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
    expect(ipBlocklist.recordAttack).not.toHaveBeenCalled();
  });

  test('bare ".." in the query (no slash) passes', () => {
    const { next } = run({ url: '/api/x?q=wait..what', query: { q: 'wait..what' } });
    expect(next).toHaveBeenCalled();
    expect(ipBlocklist.recordAttack).not.toHaveBeenCalled();
  });

  test('GET /x?file=../../etc/passwd is blocked and bans', () => {
    const { res, next } = run({ url: '/x?file=../../etc/passwd', query: { file: '../../etc/passwd' } });
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(ipBlocklist.recordAttack).toHaveBeenCalledWith('203.0.113.7', 'pattern');
  });

  test('URL-encoded traversal in the path is blocked', () => {
    const { res } = run({ url: '/static/%2e%2e%2f%2e%2e%2fsecret' });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(ipBlocklist.recordAttack).toHaveBeenCalled();
  });

  test('backslash traversal in the query is blocked', () => {
    const { res } = run({ url: '/x', query: { f: '..\\..\\windows' } });
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('"<script" in the body is still blocked', () => {
    const { res, next } = run({ body: { bio: 'hi <script>alert(1)</script>' } });
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(ipBlocklist.recordAttack).toHaveBeenCalled();
  });

  test('SQLi hint in the body is still blocked', () => {
    const { res } = run({ body: { q: "1 UNION SELECT password FROM users" } });
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

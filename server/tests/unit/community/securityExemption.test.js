'use strict';
jest.mock('../../../lib/ipBlocklist', () => ({
  isBlocked: jest.fn(() => false),
  recordAttack: jest.fn(() => Promise.resolve()),
  recordRateLimitViolation: jest.fn(() => Promise.resolve()),
}));
const ipBlocklist = require('../../../lib/ipBlocklist');
const { blockSuspiciousRequests } = require('../../../middleware/security');

function run({ method = 'POST', url, body = {}, query = {} }) {
  const req = { method, url, originalUrl: url, query, body, ip: '203.0.113.7', headers: {} };
  const res = { status: jest.fn(() => res), json: jest.fn(() => res) };
  const next = jest.fn();
  blockSuspiciousRequests(req, res, next);
  return { res, next };
}
beforeEach(() => ipBlocklist.recordAttack.mockClear());

describe('community WAF exemption', () => {
  test('SQL-keyword prose in community POST passes, no ban', () => {
    const { next } = run({ url: '/api/community/items', body: { body: 'insert into my calendar, then drop table talk' } });
    expect(next).toHaveBeenCalled();
    expect(ipBlocklist.recordAttack).not.toHaveBeenCalled();
  });
  test('XSS in community POST still 400', () => {
    const { res, next } = run({ url: '/api/community/items', body: { body: '<script>x</script>' } });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
    expect(ipBlocklist.recordAttack).toHaveBeenCalled();
  });
  test('path traversal in community URL still 400', () => {
    const { res } = run({ url: '/api/community/items/../../etc', body: {} });
    expect(res.status).toHaveBeenCalledWith(400);
  });
  test('community GET query SQL pattern still blocked', () => {
    const { res } = run({ method: 'GET', url: '/api/community/items?q=union select', query: { q: 'union select' } });
    expect(res.status).toHaveBeenCalledWith(400);
  });
  test('outside community unchanged', () => {
    const { res } = run({ url: '/api/bookings', body: { note: 'insert into' } });
    expect(res.status).toHaveBeenCalledWith(400);
  });
  test('lookalike prefix is not exempt', () => {
    const { res } = run({ url: '/api/communityx/items', body: { body: 'insert into' } });
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

// Unit tests for the admin IP-block controller. lib/ipBlocklist is mocked so we
// test validation, status codes, and the allowlist-conflict path in isolation.

const OLD_ENV = process.env;

function mockRes() {
  const res = { statusCode: 200, body: undefined };
  res.status = jest.fn((c) => { res.statusCode = c; return res; });
  res.json = jest.fn((b) => { res.body = b; return res; });
  return res;
}

function load(blocklist = {}) {
  jest.resetModules();
  process.env = { ...OLD_ENV };
  const mock = {
    listBans: blocklist.listBans || jest.fn(async () => []),
    listAllow: blocklist.listAllow || jest.fn(async () => []),
    addBan: blocklist.addBan || jest.fn(async () => ({ ok: true })),
    removeBan: blocklist.removeBan || jest.fn(async () => ({ ok: true })),
    addAllow: blocklist.addAllow || jest.fn(async () => ({ ok: true })),
    removeAllow: blocklist.removeAllow || jest.fn(async () => ({ ok: true })),
  };
  jest.doMock('../../lib/ipBlocklist', () => mock);
  const ctrl = require('../../controllers/ipBlockController');
  return { ctrl, mock };
}

afterAll(() => { process.env = OLD_ENV; });

describe('addBlocked', () => {
  test('rejects a non-IP string with 400', async () => {
    const { ctrl, mock } = load();
    const res = mockRes();
    await ctrl.addBlocked({ body: { ip: 'not-an-ip' }, admin: { username: 'founder' } }, res);
    expect(res.statusCode).toBe(400);
    expect(mock.addBan).not.toHaveBeenCalled();
  });

  test('blocks a valid IP and returns 201 with manual source', async () => {
    const { ctrl, mock } = load();
    const res = mockRes();
    await ctrl.addBlocked({ body: { ip: '203.0.113.5', reason: 'spam' }, admin: { username: 'founder' } }, res);
    expect(res.statusCode).toBe(201);
    expect(mock.addBan).toHaveBeenCalledWith('203.0.113.5', expect.objectContaining({
      source: 'manual', reason: 'spam', createdBy: 'founder',
    }));
  });

  test('permanent=true bans with no TTL', async () => {
    const { ctrl, mock } = load();
    const res = mockRes();
    await ctrl.addBlocked({ body: { ip: '203.0.113.5', permanent: true }, admin: {} }, res);
    expect(mock.addBan).toHaveBeenCalledWith('203.0.113.5', expect.objectContaining({ ttlMs: null }));
  });

  test('returns 409 when the IP is on the allowlist', async () => {
    const { ctrl } = load({ addBan: jest.fn(async () => ({ ok: false, skipped: 'allowlisted' })) });
    const res = mockRes();
    await ctrl.addBlocked({ body: { ip: '203.0.113.5' }, admin: {} }, res);
    expect(res.statusCode).toBe(409);
  });
});

describe('listBlocked', () => {
  test('filters out expired bans and returns the active ones', async () => {
    const listBans = jest.fn(async () => ([
      { ip: '1.1.1.1', source: 'auto', created_at: '2026-06-27T10:00:00Z', expires_at: new Date(Date.now() + 3600000).toISOString() },
      { ip: '2.2.2.2', source: 'auto', created_at: '2026-06-27T09:00:00Z', expires_at: new Date(Date.now() - 1000).toISOString() },
      { ip: '3.3.3.3', source: 'manual', created_at: '2026-06-27T11:00:00Z', expires_at: null },
    ]));
    const { ctrl } = load({ listBans });
    const res = mockRes();
    await ctrl.listBlocked({}, res);
    const ips = res.body.blocked.map((b) => b.ip);
    expect(ips).toContain('1.1.1.1');
    expect(ips).toContain('3.3.3.3');
    expect(ips).not.toContain('2.2.2.2'); // expired
  });
});

describe('removeBlocked', () => {
  test('rejects an invalid IP param', async () => {
    const { ctrl, mock } = load();
    const res = mockRes();
    await ctrl.removeBlocked({ params: { ip: 'bogus' } }, res);
    expect(res.statusCode).toBe(400);
    expect(mock.removeBan).not.toHaveBeenCalled();
  });

  test('unblocks a valid IP', async () => {
    const { ctrl, mock } = load();
    const res = mockRes();
    await ctrl.removeBlocked({ params: { ip: '203.0.113.5' } }, res);
    expect(mock.removeBan).toHaveBeenCalledWith('203.0.113.5');
    expect(res.body.message).toMatch(/unblocked/i);
  });
});

describe('allowlist', () => {
  test('addAllow validates and stores a note', async () => {
    const { ctrl, mock } = load();
    const res = mockRes();
    await ctrl.addAllow({ body: { ip: '198.51.100.7', note: 'office' }, admin: { username: 'founder' } }, res);
    expect(res.statusCode).toBe(201);
    expect(mock.addAllow).toHaveBeenCalledWith('198.51.100.7', expect.objectContaining({ note: 'office', createdBy: 'founder' }));
  });
});

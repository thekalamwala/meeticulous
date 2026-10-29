// Unit tests for the IP blocklist brain. The DB layer is replaced via the
// test-only __setStore seam with a trivial in-memory fake, so these tests exercise
// the real cache, lazy-expiry, allowlist-wins, and offense-threshold logic with no
// Supabase dependency.

const OLD_ENV = process.env;

// Small thresholds make the threshold tests fast and obvious.
function loadFresh(env = {}) {
  jest.resetModules();
  process.env = { ...OLD_ENV };
  Object.assign(process.env, {
    IP_BLOCK_ENABLED: 'true',
    IP_BAN_GENERAL_MAX: '3',
    IP_BAN_GENERAL_WINDOW_MS: '60000',
    IP_BAN_GENERAL_TTL_MS: '3600000',
    IP_BAN_ADMIN_MAX: '2',
    IP_BAN_ADMIN_WINDOW_MS: '60000',
    IP_BAN_ADMIN_TTL_MS: '1800000',
    IP_BAN_ATTACK_TTL_MS: '3600000',
  }, env);
  const mod = require('../../lib/ipBlocklist');
  mod.__setStore(makeFakeStore());
  return mod;
}

// In-memory fake of the Supabase-backed store.
function makeFakeStore(seed = {}) {
  const banRows = [...(seed.bans || [])];
  const allowRows = [...(seed.allow || [])];
  return {
    bans: banRows,
    allow: allowRows,
    async fetchBans() { return banRows; },
    async fetchAllow() { return allowRows; },
    async upsertBan(row) {
      const i = banRows.findIndex((r) => r.ip === row.ip);
      if (i >= 0) banRows[i] = { ...banRows[i], ...row };
      else banRows.push({ ...row });
    },
    async deleteBan(ip) {
      const i = banRows.findIndex((r) => r.ip === ip);
      if (i >= 0) banRows.splice(i, 1);
    },
    async upsertAllow(row) {
      const i = allowRows.findIndex((r) => r.ip === row.ip);
      if (i >= 0) allowRows[i] = { ...allowRows[i], ...row };
      else allowRows.push({ ...row });
    },
    async deleteAllow(ip) {
      const i = allowRows.findIndex((r) => r.ip === ip);
      if (i >= 0) allowRows.splice(i, 1);
    },
  };
}

afterAll(() => { process.env = OLD_ENV; });

describe('isBlocked / addBan / removeBan', () => {
  test('a manually banned IP is blocked; removing it clears the block', async () => {
    const m = loadFresh();
    expect(m.isBlocked('1.2.3.4')).toBe(false);

    await m.addBan('1.2.3.4', { reason: 'test', source: 'manual' });
    expect(m.isBlocked('1.2.3.4')).toBe(true);

    await m.removeBan('1.2.3.4');
    expect(m.isBlocked('1.2.3.4')).toBe(false);
  });

  test('a ban whose expires_at is in the past is treated as not blocked (lazy expiry)', async () => {
    const m = loadFresh();
    await m.addBan('5.6.7.8', { source: 'auto', expiresAt: new Date(Date.now() - 1000).toISOString() });
    expect(m.isBlocked('5.6.7.8')).toBe(false);
  });

  test('blank / missing IP is never blocked', () => {
    const m = loadFresh();
    expect(m.isBlocked('')).toBe(false);
    expect(m.isBlocked(null)).toBe(false);
    expect(m.isBlocked(undefined)).toBe(false);
  });
});

describe('allowlist wins', () => {
  test('an allowlisted IP is never blocked and cannot be banned', async () => {
    const m = loadFresh();
    await m.addAllow('9.9.9.9', { note: 'office' });

    const r = await m.addBan('9.9.9.9', { source: 'manual' });
    expect(r.ok).toBe(false);
    expect(r.skipped).toBe('allowlisted');
    expect(m.isBlocked('9.9.9.9')).toBe(false);
  });

  test('allowlisting an IP lifts an existing ban', async () => {
    const m = loadFresh();
    await m.addBan('8.8.8.8', { source: 'manual' });
    expect(m.isBlocked('8.8.8.8')).toBe(true);

    await m.addAllow('8.8.8.8', {});
    expect(m.isBlocked('8.8.8.8')).toBe(false);

    await m.removeAllow('8.8.8.8');
    expect(m.isBlocked('8.8.8.8')).toBe(false); // ban was deleted, not just shadowed
  });
});

describe('general auto-ban (rate-limit violations)', () => {
  test('bans only after reaching the configured threshold', async () => {
    const m = loadFresh(); // max = 3
    await m.recordRateLimitViolation('7.7.7.7');
    await m.recordRateLimitViolation('7.7.7.7');
    expect(m.isBlocked('7.7.7.7')).toBe(false); // 2 < 3

    await m.recordRateLimitViolation('7.7.7.7');
    expect(m.isBlocked('7.7.7.7')).toBe(true); // 3 → banned
  });

  test('allowlisted IPs never accrue offenses or get banned', async () => {
    const m = loadFresh();
    await m.addAllow('1.1.1.1', {});
    for (let i = 0; i < 10; i++) await m.recordRateLimitViolation('1.1.1.1');
    expect(m.isBlocked('1.1.1.1')).toBe(false);
  });
});

describe('admin-login auto-lockout', () => {
  test('locks the IP after the admin threshold and resets on success', async () => {
    const m = loadFresh(); // admin max = 2
    await m.recordAdminLoginFailure('2.2.2.2');
    expect(m.isBlocked('2.2.2.2')).toBe(false);

    m.resetAdminLoginFailures('2.2.2.2'); // a successful login wipes the counter
    await m.recordAdminLoginFailure('2.2.2.2');
    expect(m.isBlocked('2.2.2.2')).toBe(false); // counter was reset, so 1 < 2

    await m.recordAdminLoginFailure('2.2.2.2');
    expect(m.isBlocked('2.2.2.2')).toBe(true); // 2 → locked
  });
});

describe('attack-pattern ban', () => {
  test('a single suspicious hit bans immediately', async () => {
    const m = loadFresh();
    await m.recordAttack('6.6.6.6', 'sqli');
    expect(m.isBlocked('6.6.6.6')).toBe(true);
  });
});

describe('private/reserved IPs are never banned (shared-edge-IP lockout guard)', () => {
  test.each([
    '10.0.0.1',        // Render's internal proxy range (the documented incident)
    '172.16.0.5',
    '172.31.255.1',
    '192.168.1.1',
    '127.0.0.1',
    '169.254.1.1',
    '::1',
    '::ffff:10.0.0.1',
    'fe80::1',
    'fd00::1',
  ])('addBan skips %s and isBlocked never reports it as banned', async (ip) => {
    const m = loadFresh();
    const r = await m.addBan(ip, { reason: 'test', source: 'manual' });
    expect(r.ok).toBe(false);
    expect(r.skipped).toBe('private-range');
    expect(m.isBlocked(ip)).toBe(false);
  });

  test('auto-ban thresholds never produce a ban for a private IP', async () => {
    const m = loadFresh(); // general max = 3
    await m.recordRateLimitViolation('10.0.0.1');
    await m.recordRateLimitViolation('10.0.0.1');
    await m.recordRateLimitViolation('10.0.0.1');
    expect(m.isBlocked('10.0.0.1')).toBe(false);
  });

  test('recordAttack never bans a private IP', async () => {
    const m = loadFresh();
    await m.recordAttack('10.0.0.1', 'sqli');
    expect(m.isBlocked('10.0.0.1')).toBe(false);
  });

  test('a private IP already sitting in the DB (pre-existing bad row) is never treated as blocked', async () => {
    jest.resetModules();
    process.env = { ...OLD_ENV, IP_BLOCK_ENABLED: 'true' };
    const m = require('../../lib/ipBlocklist');
    m.__setStore(makeFakeStore({ bans: [{ ip: '10.0.0.1', source: 'auto', expires_at: null }] }));
    await m.refresh();
    expect(m.isBlocked('10.0.0.1')).toBe(false);
  });

  test('isPrivateOrReservedIp is exported and classifies a normal public IP as false', () => {
    const m = loadFresh();
    expect(m.isPrivateOrReservedIp('203.0.113.1')).toBe(false);
    expect(m.isPrivateOrReservedIp('10.1.2.3')).toBe(true);
  });
});

describe('refresh()', () => {
  test('loads bans + allowlist from the store and skips already-expired bans', async () => {
    jest.resetModules();
    process.env = { ...OLD_ENV, IP_BLOCK_ENABLED: 'true' };
    const m = require('../../lib/ipBlocklist');
    m.__setStore(makeFakeStore({
      bans: [
        { ip: '203.0.113.1', source: 'manual', expires_at: null }, // permanent
        { ip: '203.0.113.2', source: 'auto', expires_at: new Date(Date.now() - 1000).toISOString() }, // expired
      ],
      allow: [{ ip: '203.0.113.9', note: 'ops' }],
    }));

    await m.refresh();

    expect(m.isBlocked('203.0.113.1')).toBe(true);
    expect(m.isBlocked('203.0.113.2')).toBe(false); // expired → not loaded
    expect(m.isAllowed('203.0.113.9')).toBe(true);
  });
});

describe('master kill-switch', () => {
  test('IP_BLOCK_ENABLED=false disables all auto-ban recording', async () => {
    const m = loadFresh({ IP_BLOCK_ENABLED: 'false' });
    for (let i = 0; i < 10; i++) await m.recordRateLimitViolation('3.3.3.3');
    await m.recordAttack('3.3.3.3');
    expect(m.isBlocked('3.3.3.3')).toBe(false);
  });
});

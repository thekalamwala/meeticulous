'use strict';
// Unit coverage for inviteService. supabaseAdmin is a controllable chainable stub
// so we exercise the deterministic logic (validate-before-stamp, write-once guard,
// bot skip) without a DB.

// Each test installs its own stub via setStub() before requiring the service fresh.
let stub;
jest.mock('../config/supabase', () => ({ get supabaseAdmin() { return global.__sb; } }));

// Chainable query builder. Terminal calls (maybeSingle/single) resolve `result`.
// update()/insert() capture their payload on `calls` for assertions.
function makeBuilder(store) {
  const calls = { updatePayload: null, insertPayload: null, isFilters: {} };
  const b = {
    _calls: calls,
    select() { return b; },
    order() { return b; },
    eq() { return b; },
    is(col, val) { calls.isFilters[col] = val; return b; },
    insert(p) { calls.insertPayload = p; return b; },
    update(p) { calls.updatePayload = p; return b; },
    maybeSingle: async () => ({ data: store.row ?? null, error: store.error ?? null }),
    single: async () => ({ data: store.row ?? null, error: store.error ?? null }),
    then: undefined,
  };
  return b;
}

function setStub({ existsRow = null, updateError = null } = {}) {
  const builders = [];
  global.__sb = {
    from: jest.fn(() => {
      const b = makeBuilder({ row: existsRow, error: updateError });
      builders.push(b);
      return b;
    }),
    rpc: jest.fn(async () => ({ error: null })),
  };
  return builders;
}

const load = () => { jest.resetModules(); return require('../services/inviteService'); };

describe('inviteService.slugExists', () => {
  test('true when a row is returned, false when null', async () => {
    setStub({ existsRow: { slug: 'social' } });
    let svc = load();
    expect(await svc.slugExists('social')).toBe(true);

    setStub({ existsRow: null });
    svc = load();
    expect(await svc.slugExists('nope')).toBe(false);
  });
});

describe('inviteService.stampInviteSlug', () => {
  test('no-ops on unknown slug (never stamps a bogus source)', async () => {
    const builders = setStub({ existsRow: null });   // slugExists -> false
    const svc = load();
    await svc.stampInviteSlug('p1', 'ghost');
    // No profiles.update should have captured a payload.
    expect(builders.every((b) => b._calls.updatePayload === null)).toBe(true);
  });

  test('stamps known slug with write-once guard (invite_slug IS NULL)', async () => {
    const builders = setStub({ existsRow: { slug: 'social' } }); // slugExists -> true
    const svc = load();
    await svc.stampInviteSlug('p1', 'social');
    const updated = builders.find((b) => b._calls.updatePayload);
    expect(updated._calls.updatePayload).toEqual({ invite_slug: 'social' });
    expect(updated._calls.isFilters).toHaveProperty('invite_slug', null);
  });
});

describe('inviteService.recordVisit', () => {
  test('bot UA skips the RPC entirely', async () => {
    setStub({ existsRow: { slug: 'social' } });
    const svc = load();
    await svc.recordVisit('social', '1.2.3.4', 'facebookexternalhit/1.1');
    expect(global.__sb.rpc).not.toHaveBeenCalled();
  });

  test('genuine hit calls the atomic increment RPC', async () => {
    setStub({ existsRow: { slug: 'social' } });
    const svc = load();
    await svc.recordVisit('social', '9.9.9.9', 'Mozilla/5.0 (real human)');
    expect(global.__sb.rpc).toHaveBeenCalledWith('increment_invite_visit', { p_slug: 'social' });
  });
});

describe('inviteService.createLink', () => {
  test('rejects a reserved slug before any insert', async () => {
    setStub({ existsRow: null });
    const svc = load();
    await expect(svc.createLink({ slug: 'admin', label: 'x' })).rejects.toMatchObject({ code: 'RESERVED' });
  });

  test('rejects a malformed slug', async () => {
    setStub({ existsRow: null });
    const svc = load();
    await expect(svc.createLink({ slug: 'A!', label: 'x' })).rejects.toMatchObject({ code: 'BAD_SLUG' });
  });
});

// reservedSlugService.checkAvailability — the reason ladder (format →
// reserved_route(L1) → reserved_admin(L2) → taken(L3) → ok). Supabase + L3 are
// mocked; the contract under test is layer precedence + normalization, not the
// query builder.
let mockDynamicRows = [];
jest.mock('../../config/supabase', () => ({
  supabaseAdmin: {
    from: () => ({
      select: () => ({ is: () => Promise.resolve({ data: mockDynamicRows }) }),
    }),
  },
}));
jest.mock('../../services/usernameService', () => ({ usernameOwner: jest.fn() }));

const svc = require('../../services/reservedSlugService');
const usernameService = require('../../services/usernameService');

beforeEach(() => {
  jest.clearAllMocks();
  mockDynamicRows = [];
  svc._clearCache();
  usernameService.usernameOwner.mockResolvedValue(null);
});

describe('checkAvailability reason ladder', () => {
  test('format error wins first (too short)', async () => {
    const r = await svc.checkAvailability('ab');
    expect(r).toMatchObject({ ok: false, reason: 'format' });
  });

  test('L1 reserved route — normalized, beats DB', async () => {
    const r = await svc.checkAvailability('Admin');
    expect(r).toMatchObject({ ok: false, reason: 'reserved_route', normalized: 'admin' });
    expect(usernameService.usernameOwner).not.toHaveBeenCalled();
  });

  test('L1 catches confusable/zero-width variants', async () => {
    expect((await svc.checkAvailability('ＡＤＭＩＮ')).reason).toBe('reserved_route');
    expect((await svc.checkAvailability('ad​min')).reason).toBe('reserved_route'); // ZWSP
  });

  test('adult-content blocked beats DB layers', async () => {
    mockDynamicRows = [{ slug: 'bestpornhub', is_prefix: false }];
    const r = await svc.checkAvailability('bestpornhub');
    expect(r).toMatchObject({ ok: false, reason: 'blocked', normalized: 'bestpornhub' });
    expect(usernameService.usernameOwner).not.toHaveBeenCalled();
  });

  test('L2 admin reservation (exact)', async () => {
    mockDynamicRows = [{ slug: 'acme', is_prefix: false }];
    const r = await svc.checkAvailability('acme');
    expect(r).toMatchObject({ ok: false, reason: 'reserved_admin', normalized: 'acme' });
  });

  test('L2 prefix reservation blocks acme-corp but not acmecorp', async () => {
    mockDynamicRows = [{ slug: 'acme', is_prefix: true }];
    expect((await svc.checkAvailability('acme-corp')).reason).toBe('reserved_admin');
    svc._clearCache();
    expect((await svc.checkAvailability('acmecorp')).ok).toBe(true);
  });

  test('L3 taken by someone else', async () => {
    usernameService.usernameOwner.mockResolvedValue('other-id');
    const r = await svc.checkAvailability('jane-doe', { selfUserId: 'me' });
    expect(r.reason).toBe('taken');
  });

  test('L3 self-owned is ok (idempotent re-claim)', async () => {
    usernameService.usernameOwner.mockResolvedValue('me');
    const r = await svc.checkAvailability('jane-doe', { selfUserId: 'me' });
    expect(r).toMatchObject({ ok: true, reason: 'ok' });
  });

  test('clean available name passes', async () => {
    const r = await svc.checkAvailability('jane-doe');
    expect(r).toMatchObject({ ok: true, reason: 'ok', normalized: 'jane-doe' });
  });
});

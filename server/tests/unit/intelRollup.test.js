/**
 * intel-rollup / intel-prune — the pure logic.
 *
 * Two properties carry most of the weight here:
 *   * an ambiguous attribution records NOTHING, because a guess written as a
 *     fact is worse than a visible gap;
 *   * a prune whose archive failed refuses to delete, because raw events cost
 *     disk while losing them costs the ability to ever recompute that day.
 */
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: jest.fn(), rpc: jest.fn(), storage: { from: jest.fn() } } }));

const { fold, resolveAttribution, istDay, istDayBounds, ATTRIBUTION_WINDOW_MS } = require('../../services/intelRollup');
const { toJsonl } = require('../../services/intelArchive');

const HOST = 'host-1';
const ev = (over = {}) => ({
  host_id: HOST,
  visitor_id: 'v1',
  event: 'host_profile_viewed',
  occurred_at: '2026-11-17T06:00:00.000Z',
  source: 'instagram',
  medium: 'social',
  device_type: 'mobile',
  ...over,
});

describe('IST days, not UTC', () => {
  it('puts a late-evening IST event in that IST day, not the next UTC one', () => {
    // 19:00 UTC on the 17th = 00:30 IST on the 18th.
    expect(istDay(new Date('2026-11-17T19:00:00.000Z'))).toBe('2026-11-18');
    // 17:00 UTC = 22:30 IST, still the 17th — the host's busiest hour.
    expect(istDay(new Date('2026-11-17T17:00:00.000Z'))).toBe('2026-11-17');
  });

  it('bounds a day at IST midnight', () => {
    const { from, to } = istDayBounds('2026-11-17');
    expect(from).toBe('2026-11-16T18:30:00.000Z');
    expect(to).toBe('2026-11-17T18:30:00.000Z');
  });
});

describe('fold', () => {
  it('counts each event into its own column', () => {
    const { daily } = fold([
      ev({ event: 'host_profile_viewed' }),
      ev({ event: 'service_viewed', visitor_id: 'v2' }),
      ev({ event: 'booking_started', visitor_id: 'v2' }),
      ev({ event: 'checkout_started', visitor_id: 'v2' }),
      ev({ event: 'profile_link_clicked', visitor_id: 'v3' }),
    ]);
    expect(daily.get(HOST)).toMatchObject({
      profile_views: 1, service_views: 1, booking_starts: 1, checkout_starts: 1, link_clicks: 1,
    });
  });

  it('counts a visitor once a day however many events they fire', () => {
    const { daily } = fold([ev(), ev(), ev({ event: 'service_viewed' })]);
    expect(daily.get(HOST).unique_visitors).toBe(1);
  });

  it('separates new visitors from returning ones', () => {
    const prior = new Set([`${HOST}|returning`]);
    const { daily } = fold([ev({ visitor_id: 'returning' }), ev({ visitor_id: 'fresh' })], prior);
    expect(daily.get(HOST)).toMatchObject({ unique_visitors: 2, new_visitors: 1 });
  });

  it('keeps hosts apart', () => {
    const { daily } = fold([ev(), ev({ host_id: 'host-2', visitor_id: 'v9' })]);
    expect(daily.size).toBe(2);
    expect(daily.get('host-2').profile_views).toBe(1);
  });

  it('breaks visitors down by dimension', () => {
    const { dims } = fold([
      ev({ visitor_id: 'a', source: 'instagram', device_type: 'mobile' }),
      ev({ visitor_id: 'b', source: 'instagram', device_type: 'desktop' }),
    ]);
    const src = dims.find((d) => d.dim_type === 'source' && d.dim_value === 'instagram');
    expect(src.visitors).toBe(2);
    expect(dims.filter((d) => d.dim_type === 'device')).toHaveLength(2);
  });

  it('leaves an unknown dimension out rather than bucketing it as empty', () => {
    const { dims } = fold([ev({ source: null, campaign: null, referrer_host: null })]);
    expect(dims.some((d) => d.dim_value === '' || d.dim_value === 'null')).toBe(false);
    expect(dims.some((d) => d.dim_type === 'source')).toBe(false);
  });
});

describe('attribution records a fact or nothing', () => {
  const booking = { id: 'bk1', host_id: HOST, service_id: 's1', created_at: '2026-11-17T06:30:00.000Z' };
  const candidate = (over = {}) => ev({
    event: 'checkout_started', service_id: 's1', occurred_at: '2026-11-17T06:00:00.000Z', ...over,
  });

  it('attributes when exactly one candidate fits', () => {
    const [row] = resolveAttribution([booking], [candidate()]);
    expect(row).toMatchObject({ booking_id: 'bk1', confidence: 'high', first_source: 'instagram' });
  });

  it('records nothing when two guests are indistinguishable', () => {
    // The known limitation, asserted so it stays a known gap rather than
    // silently becoming a 50/50 guess.
    const two = [candidate({ visitor_id: 'a' }), candidate({ visitor_id: 'b' })];
    expect(resolveAttribution([booking], two)).toEqual([]);
  });

  it('records nothing when no candidate fits', () => {
    expect(resolveAttribution([booking], [])).toEqual([]);
  });

  it('ignores a candidate outside the two-hour window', () => {
    const old = candidate({ occurred_at: new Date(Date.parse(booking.created_at) - ATTRIBUTION_WINDOW_MS - 1000).toISOString() });
    expect(resolveAttribution([booking], [old])).toEqual([]);
  });

  it('never attributes an event that happened after the booking', () => {
    const after = candidate({ occurred_at: '2026-11-17T07:00:00.000Z' });
    expect(resolveAttribution([booking], [after])).toEqual([]);
  });

  it('never attributes across hosts', () => {
    expect(resolveAttribution([booking], [candidate({ host_id: 'host-2' })])).toEqual([]);
  });
});

describe('archive format', () => {
  it('writes JSON Lines so a replay can stream instead of parsing a whole object', () => {
    const text = toJsonl([{ a: 1 }, { a: 2 }]);
    expect(text.split('\n')).toHaveLength(2);
    expect(JSON.parse(text.split('\n')[1])).toEqual({ a: 2 });
  });
});

describe('prune never deletes what it could not archive', () => {
  const { pruneDay } = require('../../services/intelPrune');
  const { supabaseAdmin } = require('../../config/supabase');

  it('declines to delete when the archive throws', async () => {
    // Storage missing, bucket absent, outage — all the same answer.
    supabaseAdmin.from.mockReturnValue({
      select: () => ({ gte: () => ({ lt: () => ({ order: () => Promise.resolve({ data: [ev()], error: null }) }) }) }),
      delete: jest.fn(),
    });
    supabaseAdmin.storage.from.mockReturnValue({
      upload: jest.fn().mockResolvedValue({ error: { message: 'Bucket not found' } }),
    });

    const r = await pruneDay('2026-10-01');
    expect(r).toMatchObject({ deleted: 0, skipped: 'archive_failed' });
  });

  it('does nothing at all for a day with no events', async () => {
    supabaseAdmin.from.mockReturnValue({
      select: () => ({ gte: () => ({ lt: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) }) }),
      delete: jest.fn(),
    });
    const r = await pruneDay('2026-10-01');
    expect(r).toMatchObject({ deleted: 0, skipped: 'empty' });
  });
});

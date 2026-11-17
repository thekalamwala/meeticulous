/**
 * analyticsIngest — the brakes.
 *
 * Every case here is really the same assertion: a guest mid-booking never pays
 * for our telemetry. Nothing throws, nothing 4xxes, and each brake can stop
 * ingest on its own.
 */
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: jest.fn() } }));
jest.mock('../../services/featureFlags', () => ({ isFeatureEnabled: jest.fn() }));
jest.mock('../../utils/adminAlert', () => ({ adminAlert: jest.fn().mockResolvedValue(undefined) }));

const { supabaseAdmin } = require('../../config/supabase');
const { isFeatureEnabled } = require('../../services/featureFlags');
const { adminAlert } = require('../../utils/adminAlert');
const ingestSvc = require('../../services/analyticsIngest');
const { ingest, normalise, setCachedSize, MAX_BATCH, RATE_MAX_EVENTS, SIZE_BUDGET_BYTES } = ingestSvc;

const ORIGIN = 'https://meeticulous.com';
const HOST = '11111111-1111-4111-8111-111111111111';

let upsert;
const evt = (over = {}) => ({
  event: 'host_profile_viewed',
  host_id: HOST,
  visitor_id: 'v-1',
  ingest_id: `i-${Math.random()}`,
  occurred_at: new Date().toISOString(),
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  ingestSvc.__test.resetBuckets();
  ingestSvc.__test.resetSize();
  isFeatureEnabled.mockResolvedValue(true);
  upsert = jest.fn().mockResolvedValue({ error: null });
  supabaseAdmin.from.mockReturnValue({ upsert });
});

describe('normalise', () => {
  it('drops an event the catalog does not know', () => {
    expect(normalise(evt({ event: 'totally_made_up' }))).toBeNull();
  });

  it('drops an event with no host, visitor or ingest id', () => {
    expect(normalise(evt({ host_id: null }))).toBeNull();
    expect(normalise(evt({ visitor_id: null }))).toBeNull();
    expect(normalise(evt({ ingest_id: null }))).toBeNull();
  });

  it('clamps a lying clock to now instead of dropping the event', () => {
    const now = Date.parse('2026-11-17T12:00:00.000Z');
    const row = normalise(evt({ occurred_at: '2019-01-01T00:00:00.000Z' }), { now });
    // A wrong timestamp is still a real event — keep it, correct it.
    expect(row.occurred_at).toBe(new Date(now).toISOString());
  });

  it('keeps a timestamp inside the skew window untouched', () => {
    const now = Date.parse('2026-11-17T12:00:00.000Z');
    const at = new Date(now - 60 * 60 * 1000).toISOString();
    expect(normalise(evt({ occurred_at: at }), { now }).occurred_at).toBe(at);
  });

  it('truncates to the column widths so a long value cannot error the insert', () => {
    const row = normalise(evt({ referrer_host: 'x'.repeat(400), route: 'r'.repeat(200), link_type: 'l'.repeat(99) }));
    expect(row.referrer_host).toHaveLength(253);
    expect(row.route).toHaveLength(64);
    expect(row.link_type).toHaveLength(32);
  });

  it('accepts both events added for Intelligence', () => {
    expect(normalise(evt({ event: 'profile_link_clicked', link_type: 'instagram' }))).not.toBeNull();
    expect(normalise(evt({ event: 'service_shared', channel: 'whatsapp' }))).not.toBeNull();
  });
});

describe('brakes', () => {
  it('drops everything from an origin that is not production', async () => {
    const r = await ingest({ events: [evt()], origin: 'http://localhost:5173' });
    expect(r).toMatchObject({ accepted: 0, reason: 'origin' });
    expect(upsert).not.toHaveBeenCalled();
  });

  it('writes nothing while the kill flag is off', async () => {
    isFeatureEnabled.mockResolvedValue(false);
    const r = await ingest({ events: [evt()], origin: ORIGIN });
    expect(r).toMatchObject({ accepted: 0, reason: 'flag_off' });
    expect(upsert).not.toHaveBeenCalled();
  });

  it('stops over the size budget and tells the founder exactly once', async () => {
    setCachedSize(SIZE_BUDGET_BYTES + 1);
    const a = await ingest({ events: [evt()], origin: ORIGIN });
    const b = await ingest({ events: [evt()], origin: ORIGIN });
    expect(a.reason).toBe('size_budget');
    expect(b.reason).toBe('size_budget');
    expect(upsert).not.toHaveBeenCalled();
    expect(adminAlert).toHaveBeenCalledTimes(1);
  });

  it('caps a runaway visitor without refusing the request', async () => {
    const batch = Array.from({ length: MAX_BATCH }, () => evt());
    let last;
    for (let i = 0; i < Math.ceil(RATE_MAX_EVENTS / MAX_BATCH) + 2; i += 1) {
      last = await ingest({ events: batch, origin: ORIGIN });
    }
    expect(last).toMatchObject({ accepted: 0, reason: 'rate' });
  });

  it('never accepts more than one batch at a time', async () => {
    const r = await ingest({ events: Array.from({ length: 50 }, () => evt()), origin: ORIGIN });
    expect(r.accepted).toBe(MAX_BATCH);
    expect(upsert.mock.calls[0][0]).toHaveLength(MAX_BATCH);
  });
});

describe('failure is always quiet', () => {
  it('swallows a missing table so the code is safe to deploy before v3.217', async () => {
    upsert.mockResolvedValue({ error: { message: 'relation "analytics_events" does not exist' } });
    const r = await ingest({ events: [evt()], origin: ORIGIN });
    expect(r).toMatchObject({ accepted: 0, reason: 'db' });
  });

  it('swallows a thrown database error', async () => {
    upsert.mockRejectedValue(new Error('connection reset'));
    await expect(ingest({ events: [evt()], origin: ORIGIN })).resolves.toMatchObject({ reason: 'db' });
  });

  it('dedupes on ingest_id rather than letting a replayed beacon double-count', async () => {
    await ingest({ events: [evt()], origin: ORIGIN });
    expect(supabaseAdmin.from).toHaveBeenCalledWith('analytics_events');
    expect(upsert.mock.calls[0][1]).toEqual({ onConflict: 'ingest_id', ignoreDuplicates: true });
  });
});

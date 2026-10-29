jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: jest.fn() } }));
jest.mock('../../services/featureFlags', () => ({ isFeatureEnabled: jest.fn() }));
jest.mock('../../services/planService', () => ({
  resolveVendorPlan: jest.fn(() => 'professional'),
  getLimit: jest.fn(),
}));

const { supabaseAdmin } = require('../../config/supabase');
const featureFlags = require('../../services/featureFlags');
const planService = require('../../services/planService');
const { scheduleFollowups } = require('../../services/followups/followupService');

// profiles fetch → { plan, plan_expires_at }; then upsert capture.
const profilesQuery = (row) => ({
  select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: row, error: null }) }) }),
});
const captureUpsert = (sink) => ({
  upsert: (rows, opts) => { sink.rows = rows; sink.opts = opts; return Promise.resolve({ error: null }); },
});

const booking = {
  id: 'b1', host_id: 'h1', guest_id: 'g1', guest_name: 'Ada',
  guest_email: 'ada@x.com', guest_phone: '+91', services: { title: 'Tarot' },
  profiles: { name: 'Mystic', username: 'mystic' },
};
const completedAt = '2026-07-01T00:00:00.000Z';

beforeEach(() => jest.clearAllMocks());

test('Studio host (followup_flows 2) schedules both steps with correct due dates', async () => {
  featureFlags.isFeatureEnabled.mockResolvedValue(true);
  planService.getLimit.mockResolvedValue(2);
  const sink = {};
  supabaseAdmin.from
    .mockReturnValueOnce(profilesQuery({ plan: 'professional', plan_expires_at: null }))
    .mockReturnValueOnce(captureUpsert(sink));

  const r = await scheduleFollowups({ sourceType: 'booking', sourceId: 'b1', hostId: 'h1', entity: booking, completedAt });
  expect(r.scheduled).toBe(2);
  expect(sink.rows.map((x) => x.step)).toEqual([1, 2]);
  expect(sink.rows[0].due_at).toBe('2026-07-04T00:00:00.000Z');  // +3d
  expect(sink.rows[1].due_at).toBe('2026-07-22T00:00:00.000Z');  // +21d
  expect(sink.rows[0].event_key).toBe('REBOOK_NUDGE_CUSTOMER');
  expect(sink.rows[0].payload.host_username).toBe('mystic');
  expect(sink.opts).toEqual({ onConflict: 'source_type,source_id,flow_key,step', ignoreDuplicates: true });
});

test('Host+ (followup_flows 0) schedules nothing', async () => {
  featureFlags.isFeatureEnabled.mockResolvedValue(true);
  planService.getLimit.mockResolvedValue(0);
  supabaseAdmin.from.mockReturnValueOnce(profilesQuery({ plan: 'creator', plan_expires_at: null }));
  const r = await scheduleFollowups({ sourceType: 'booking', sourceId: 'b1', hostId: 'h1', entity: booking, completedAt });
  expect(r.scheduled).toBe(0);
});

test('kill-switch off schedules nothing', async () => {
  featureFlags.isFeatureEnabled.mockResolvedValue(false);
  const r = await scheduleFollowups({ sourceType: 'booking', sourceId: 'b1', hostId: 'h1', entity: booking, completedAt });
  expect(r.scheduled).toBe(0);
  expect(supabaseAdmin.from).not.toHaveBeenCalled();
});

test('never throws on DB error (best-effort)', async () => {
  featureFlags.isFeatureEnabled.mockResolvedValue(true);
  planService.getLimit.mockResolvedValue(2);
  supabaseAdmin.from
    .mockReturnValueOnce(profilesQuery({ plan: 'professional', plan_expires_at: null }))
    .mockReturnValueOnce({ upsert: () => Promise.resolve({ error: { message: 'relation "scheduled_followups" does not exist' } }) });
  const r = await scheduleFollowups({ sourceType: 'booking', sourceId: 'b1', hostId: 'h1', entity: booking, completedAt });
  expect(r.scheduled).toBe(0);
});

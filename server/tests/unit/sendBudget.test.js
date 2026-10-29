'use strict';
// sendBudget — the shared Resend daily budget + cold 18:00 window / ramp / skip rules.

const mockSupa = { supabaseAdmin: { from: jest.fn() } };
jest.mock('../../config/supabase', () => mockSupa);
jest.mock('../../utils/logger', () => ({ logger: { warn: jest.fn(), info: jest.fn() } }));

// Filter-aware query stub.
//   email_logs        → campaign count, or `bounced` when filtering status='bounced'.
//   crm_messages      → crm count.
//   email_campaigns   → cold-campaign id list (coldCampaigns rows).
//   campaign_recipients → coldSent count (cold emails already sent today).
function mockCounts(campaign, crm, { bounced = 0, coldSent = 0, coldCampaigns = 1, err = false } = {}) {
  mockSupa.supabaseAdmin.from.mockImplementation((t) => {
    const filt = {};
    const o = {
      select: () => o, eq: (c, v) => { filt[c] = v; return o; }, gte: () => o, in: () => o,
      then: (r) => {
        if (err) return Promise.resolve({ count: null, data: null, error: { message: 'boom' } }).then(r);
        if (t === 'email_campaigns') {
          const data = Array.from({ length: coldCampaigns }, (_, i) => ({ id: `c${i}` }));
          return Promise.resolve({ data, error: null }).then(r);
        }
        let count;
        if (t === 'email_logs') count = filt.status === 'bounced' ? bounced : campaign;
        else if (t === 'campaign_recipients') count = coldSent;
        else count = crm;
        return Promise.resolve({ count, error: null }).then(r);
      },
    };
    return o;
  });
}

let sendBudget;
function load() {
  jest.resetModules();
  process.env.RESEND_DAILY_CAP = '90';
  process.env.COLD_DAILY_MAX = '60';
  process.env.COLD_SEND_HOUR_IST = '18';
  process.env.COLD_WINDOW_END_IST = '20';
  process.env.COLD_BOUNCE_PAUSE_PCT = '5';
  process.env.COLD_BOUNCE_MIN_SAMPLE = '20';
  process.env.COLD_BOUNCE_WINDOW_H = '48';
  sendBudget = require('../../services/email/sendBudget');
}

// IST anchors (verified): UTC+5:30.
const MON_18 = '2026-09-14T13:00:00Z'; // Mon, IST 18h — cold window open
const MON_11 = '2026-09-14T06:00:00Z'; // Mon, IST 11h — window closed
const SUN_18 = '2026-09-13T13:00:00Z'; // Sun, IST 18h — skip (Sunday)
const D31_18 = '2026-10-31T13:00:00Z'; // 31st, IST 18h — skip (month-end)

beforeEach(load);
afterEach(() => jest.useRealTimers());
function at(iso) { jest.useFakeTimers(); jest.setSystemTime(new Date(iso)); }

test('resendUsedToday sums both ledgers (campaign + CRM)', async () => {
  mockCounts(30, 15);
  await expect(sendBudget.resendUsedToday()).resolves.toBe(45);
});

test('remainingToday = soft cap minus usage', async () => {
  mockCounts(30, 15);
  await expect(sendBudget.remainingToday()).resolves.toBe(45); // 90 - 45
});

test('remainingToday fails OPEN on a counting error (returns full cap)', async () => {
  mockCounts(0, 0, { err: true });
  await expect(sendBudget.remainingToday()).resolves.toBe(90);
});

test('coldAllowanceNow inside window = min(ramp, remainder)', async () => {
  at(MON_18); mockCounts(30, 0);            // used 30, remainder 60, ramp 60
  await expect(sendBudget.coldAllowanceNow()).resolves.toBe(60);
});

test('coldAllowanceNow squeezed by CRM usage (remainder < ramp)', async () => {
  at(MON_18); mockCounts(85, 0);            // remainder 5 < ramp 60
  await expect(sendBudget.coldAllowanceNow()).resolves.toBe(5);
});

// Regression: the ramp must subtract cold already sent today (the 2026-09-24 overshoot).
// campaign_recipients.sent_at is lag-free, so a mid-window tick sees prior cold sends.
test('coldAllowanceNow subtracts cold already sent today (no ramp overshoot)', async () => {
  at(MON_18); mockCounts(30, 0, { coldSent: 50 }); // ramp 60 − 50 sent = 10; remainder 60
  await expect(sendBudget.coldAllowanceNow()).resolves.toBe(10);
});

test('coldAllowanceNow is 0 once the daily ramp is spent', async () => {
  at(MON_18); mockCounts(30, 0, { coldSent: 60 }); // ramp 60 − 60 = 0
  await expect(sendBudget.coldAllowanceNow()).resolves.toBe(0);
});

test('coldSentToday is 0 when no cold campaigns exist', async () => {
  at(MON_18); mockCounts(30, 0, { coldCampaigns: 0, coldSent: 99 });
  await expect(sendBudget.coldSentToday()).resolves.toBe(0);
  await expect(sendBudget.coldAllowanceNow()).resolves.toBe(60); // full ramp, remainder 60
});

test('coldAllowanceNow is 0 outside the 18:00 window', async () => {
  at(MON_11); mockCounts(0, 0);
  await expect(sendBudget.coldAllowanceNow()).resolves.toBe(0);
});

test('coldAllowanceNow is 0 on Sundays', async () => {
  at(SUN_18); mockCounts(0, 0);
  await expect(sendBudget.coldAllowanceNow()).resolves.toBe(0);
});

test('coldAllowanceNow is 0 on the 31st', async () => {
  at(D31_18); mockCounts(0, 0);
  await expect(sendBudget.coldAllowanceNow()).resolves.toBe(0);
});

test('coldAllowanceNow fails CLOSED on a counting error (returns 0)', async () => {
  at(MON_18); mockCounts(0, 0, { err: true });
  await expect(sendBudget.coldAllowanceNow()).resolves.toBe(0);
});

// ── Bounce circuit-breaker ──
test('breaker pauses cold when bounce rate exceeds threshold', async () => {
  at(MON_18); mockCounts(50, 0, { bounced: 5 }); // 5/50 = 10% > 5%
  await expect(sendBudget.coldCircuitOpen()).resolves.toBe(true);
  await expect(sendBudget.coldAllowanceNow()).resolves.toBe(0); // paused despite budget left
});

test('breaker keeps cold sending under the bounce threshold', async () => {
  at(MON_18); mockCounts(50, 0, { bounced: 1 }); // 1/50 = 2% < 5%
  await expect(sendBudget.coldCircuitOpen()).resolves.toBe(false);
  await expect(sendBudget.coldAllowanceNow()).resolves.toBe(40); // remainder 90-50, capped by nothing here
});

test('breaker ignores tiny samples (no false trip on 5/10)', async () => {
  at(MON_18); mockCounts(10, 0, { bounced: 5 }); // 50% but only 10 sent → below min sample
  await expect(sendBudget.coldCircuitOpen()).resolves.toBe(false);
  await expect(sendBudget.coldAllowanceNow()).resolves.toBe(60); // min(ramp 60, remainder 80)
});

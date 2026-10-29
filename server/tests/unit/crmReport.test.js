'use strict';
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: () => ({}) } }));

const { buildReport, summarizeBy, timingStats, funnelStages, daysBetween } = require('../../services/crm/reportService');

describe('summarizeBy', () => {
  const rows = [
    { source: 'google', status: 'paid', revenue_paise: 1000 },
    { source: 'google', status: 'new', revenue_paise: 0 },
    { source: 'facebook', status: 'contacted', revenue_paise: 0 },
    { source: null, status: 'paid', revenue_paise: 500 },
  ];
  test('groups, counts paying (paid only), sums revenue, computes rate', () => {
    const out = summarizeBy(rows, 'source');
    const g = out.find((x) => x.key === 'google');
    expect(g).toEqual({ key: 'google', leads: 2, paying: 1, revenue_paise: 1000, conversion_rate: 50 });
  });
  test('missing key → (unknown) bucket', () => {
    expect(summarizeBy(rows, 'source').some((x) => x.key === '(unknown)')).toBe(true);
  });
  test('sorted by paying then leads', () => {
    const out = summarizeBy(rows, 'source');
    expect(out[0].paying).toBeGreaterThanOrEqual(out[out.length - 1].paying);
  });
});

describe('timingStats', () => {
  test('avg / median / p90 / count over non-negative days', () => {
    expect(timingStats([2, 4, 6, 8, 10])).toEqual({ count: 5, avg_days: 6, median_days: 6, p90_days: 10 });
  });
  test('drops negatives, null when empty', () => {
    expect(timingStats([-1, -5])).toBeNull();
    expect(timingStats([])).toBeNull();
  });
});

test('daysBetween handles missing/invalid', () => {
  expect(daysBetween('2026-01-01', '2026-01-03')).toBe(2);
  expect(daysBetween(null, '2026-01-03')).toBeNull();
  expect(daysBetween('nope', '2026-01-03')).toBeNull();
});

test('funnelStages returns canonical order with step retention', () => {
  const f = funnelStages({ new: 100, contacted: 50, paid: 10 });
  expect(f[0]).toEqual({ status: 'new', count: 100, step_rate: null });
  expect(f[1]).toEqual({ status: 'contacted', count: 50, step_rate: 50 });
});

describe('buildReport', () => {
  const rows = [
    { source: 'google', status: 'paid', revenue_paise: 1000, created_at: '2026-01-01', converted_at: '2026-01-05' },
    { source: 'google', status: 'activated', revenue_paise: 0, created_at: '2026-01-01', converted_at: '2026-01-02' },
    { source: 'organic', status: 'new', revenue_paise: 0, created_at: '2026-01-01' },
  ];
  test('totals count every MONEY state as paying (Relations is subscription-only; activated=Onboarded=paid)', () => {
    const r = buildReport(rows);
    expect(r.totals).toEqual({ total: 3, paying: 2, revenue_paise: 1000, conversion_rate: 66.7 });
  });
  test('has_utm false + empty utm breakdowns when column absent', () => {
    const r = buildReport(rows);
    expect(r.has_utm).toBe(false);
    expect(r.by_utm_source).toEqual([]);
  });
  test('surfaces utm breakdowns once the column is present', () => {
    const withUtm = rows.map((x) => ({ ...x, utm_source: x.source === 'google' ? 'ad1' : null }));
    const r = buildReport(withUtm);
    expect(r.has_utm).toBe(true);
    expect(r.by_utm_source.find((x) => x.key === 'ad1').leads).toBe(2);
  });
  test('time_to_convert measured created→converted', () => {
    expect(buildReport(rows).time_to_convert.count).toBe(2);
  });
});

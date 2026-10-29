import { describe, it, expect } from 'vitest';
import { gstBreakdown, GST_RATES } from '../gstCalc';

describe('gstBreakdown', () => {
  it('adds GST on top when exclusive (default)', () => {
    const r = gstBreakdown({ amount: 1000, ratePct: 18 });
    expect(r.base).toBe(1000);
    expect(r.gst).toBe(180);
    expect(r.total).toBe(1180);
    expect(r.cgst).toBe(90);
    expect(r.sgst).toBe(90);
  });

  it('extracts GST from a gross amount when inclusive', () => {
    const r = gstBreakdown({ amount: 1180, ratePct: 18, inclusive: true });
    expect(r.total).toBe(1180);
    expect(r.base).toBeCloseTo(1000, 6);
    expect(r.gst).toBeCloseTo(180, 6);
  });

  it('0% leaves the amount unchanged', () => {
    const r = gstBreakdown({ amount: 500, ratePct: 0 });
    expect(r).toMatchObject({ base: 500, gst: 0, total: 500 });
  });

  it('cgst + sgst always equals gst', () => {
    for (const rate of GST_RATES) {
      const r = gstBreakdown({ amount: 2345, ratePct: rate });
      expect(r.cgst + r.sgst).toBeCloseTo(r.gst, 6);
    }
  });

  it('treats junk/negative input as 0', () => {
    expect(gstBreakdown({ amount: 'x', ratePct: 18 }).total).toBe(0);
    expect(gstBreakdown({ amount: -10, ratePct: 18 }).total).toBe(0);
  });
});

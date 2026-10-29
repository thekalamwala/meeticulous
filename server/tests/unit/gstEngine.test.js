'use strict';
const {
  summarize, liability, byHead, byRate, byPos, bySource, gstr1Working, gstr3bWorking, ratePct,
} = require('../../services/gst/gstEngine');

// Intra-state (Odisha) fee invoice: 100 taxable @18% → 9+9 CGST/SGST.
const intra = { id: 'a', source_type: 'booking', taxable_value: 100, cgst: 9, sgst: 9, igst: 0, total: 118, gst_rate: 0.18, place_of_supply: '21', buyer_gstin: null };
// Inter-state (Maharashtra) commission invoice: 200 taxable @18% → 36 IGST, host GSTIN.
const inter = { id: 'b', source_type: 'commission', taxable_value: 200, cgst: 0, sgst: 0, igst: 36, total: 236, gst_rate: 0.18, place_of_supply: '27', buyer_gstin: '27ABCDE1234F1Z5' };
// Subscription @18% intra.
const sub = { id: 'c', source_type: 'subscription', taxable_value: 555, cgst: 49.95, sgst: 49.95, igst: 0, total: 654.9, gst_rate: 0.18, place_of_supply: '21', buyer_gstin: null };
const rows = [intra, inter, sub];

describe('gstEngine.summarize', () => {
  test('sums heads + totals', () => {
    const s = summarize(rows);
    expect(s.count).toBe(3);
    expect(s.taxable).toBe(855);
    expect(s.cgst).toBe(58.95);
    expect(s.sgst).toBe(58.95);
    expect(s.igst).toBe(36);
    expect(s.totalGst).toBe(153.9);
    expect(s.total).toBe(1008.9);
  });
  test('empty → zeros', () => {
    expect(summarize([]).totalGst).toBe(0);
  });
});

describe('gstEngine.liability (ITC is a hard 0 stub)', () => {
  test('net liability = output GST, ITC zero with a note', () => {
    const l = liability(rows);
    expect(l.output.total).toBe(153.9);
    expect(l.itc.total).toBe(0);
    expect(l.netLiability).toBe(153.9);
    expect(l.itc.note).toMatch(/No input-GST/);
  });
});

describe('gstEngine.byHead / byRate / byPos / bySource', () => {
  test('byHead', () => {
    expect(byHead(rows)).toEqual({ cgst: 58.95, sgst: 58.95, igst: 36, total: 153.9 });
  });
  test('ratePct reads the stored fraction', () => {
    expect(ratePct(intra)).toBe(18);
  });
  test('byRate groups everything at 18%', () => {
    const r = byRate(rows);
    expect(r).toHaveLength(1);
    expect(r[0].rate).toBe(18);
    expect(r[0].taxable).toBe(855);
    expect(r[0].count).toBe(3);
  });
  test('byPos splits Odisha vs Maharashtra', () => {
    const pos = byPos(rows);
    const od = pos.find((x) => x.stateCode === '21');
    const mh = pos.find((x) => x.stateCode === '27');
    expect(od.taxable).toBe(655);
    expect(mh.igst).toBe(36);
  });
  test('bySource splits the three streams', () => {
    const s = bySource(rows);
    expect(s.find((x) => x.sourceType === 'commission').gst).toBe(36);
    expect(s.find((x) => x.sourceType === 'booking').taxable).toBe(100);
  });
});

describe('gstEngine return workings', () => {
  test('GSTR-1 working splits B2B (has GSTIN) vs B2C', () => {
    const w = gstr1Working(rows);
    expect(w.b2b.summary.count).toBe(1); // only the commission invoice has a GSTIN
    expect(w.b2c.summary.count).toBe(2);
    expect(w.label).toMatch(/not a filing file/i);
  });
  test('GSTR-3B working reports outward supplies + inter-state breakup + zero ITC', () => {
    const w = gstr3bWorking(rows);
    expect(w.outwardTaxableSupplies.taxableValue).toBe(855);
    expect(w.interStateSupplies).toHaveLength(1);
    expect(w.interStateSupplies[0].posStateCode).toBe('27');
    expect(w.itcAvailable.igst).toBe(0);
    expect(w.netTaxPayable.total).toBe(153.9);
  });
});

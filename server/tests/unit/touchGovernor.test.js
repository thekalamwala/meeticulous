'use strict';
/**
 * touchGovernor pure-core tests (relationship engine PR-7).
 * withinCap is source-agnostic: it takes automated-touch timestamps + a cap/window
 * and decides. The DB adapter (canTouch/recordTouch) is tested separately.
 */
const { withinCap, CAP, WINDOW_MS } = require('../../services/crm/touchGovernor');

const H = 3600e3;
const now = Date.parse('2026-09-02T12:00:00Z');
const ago = (h) => new Date(now - h * H).toISOString();

describe('touchGovernor.withinCap', () => {
  test('no history → ok (count 0)', () => {
    const r = withinCap([], now);
    expect(r.ok).toBe(true);
    expect(r.count).toBe(0);
  });

  test('default cap 1: a touch 10h ago caps', () => {
    const r = withinCap([ago(10)], now);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('frequency_capped');
    expect(r.count).toBe(1);
  });

  test('a touch older than the 48h window ages out → ok', () => {
    expect(withinCap([ago(60)], now).ok).toBe(true);
  });

  test('only in-window touches are counted', () => {
    const r = withinCap([ago(10), ago(60), ago(100)], now);
    expect(r.count).toBe(1);
    expect(r.ok).toBe(false);
  });

  test('null/blank timestamps are ignored', () => {
    expect(withinCap([null, '', undefined], now).count).toBe(0);
  });

  test('cap override: cap=2 allows the second, blocks the third', () => {
    expect(withinCap([ago(1)], now, { cap: 2 }).ok).toBe(true);
    expect(withinCap([ago(1), ago(2)], now, { cap: 2 }).ok).toBe(false);
  });

  test('window override: a 60h-old touch is in-window under a 72h window', () => {
    expect(withinCap([ago(60)], now, { windowMs: 72 * H }).ok).toBe(false);
  });

  test('shipped defaults are 1 per 48h', () => {
    expect(CAP).toBe(1);
    expect(WINDOW_MS).toBe(48 * H);
  });
});

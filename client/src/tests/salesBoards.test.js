import { describe, it, expect } from 'vitest';
import { BOARDS, ALL_STATUSES, STATUS_LABEL, RANK, needsReason } from '../pages/admin/sales/salesConstants';

// Guardrail: pin each board's column layout to the agreed product spec. This is the
// check that was missing when the Presale board drifted (extra "Responded" column,
// missing "Subscribed"). If someone reshapes a board, this fails loudly.

const board = (k) => BOARDS.find((b) => b.key === k);
const keys = (k) => board(k).columns.map((c) => c.key);
const colOf = (b, k) => board(b).columns.find((c) => c.key === k);

describe('CRM board layout (pinned to spec)', () => {
  it('has exactly the four boards, in order', () => {
    expect(BOARDS.map((b) => b.key)).toEqual(['presale', 'relations', 'marketing', 'exit']);
  });

  it('Presale = New · Contacted · Qualified · Demo · Subscribed', () => {
    expect(keys('presale')).toEqual(['new', 'contacted', 'qualified', 'demo', 'paid']);
  });

  it('Contacted absorbs Responded — replied is folded in, not its own column', () => {
    expect(colOf('presale', 'contacted').statuses).toContain('replied');
    expect(keys('presale')).not.toContain('replied');
  });

  it('Relations = Subscribed · Onboarded · Won · Customer', () => {
    expect(keys('relations')).toEqual(['paid', 'activated', 'won', 'customer']);
  });

  it('Marketing = Customer · Retained · Ambassador · Enterprised · Champion', () => {
    expect(keys('marketing')).toEqual(['customer', 'retained', 'ambassador', 'enterprised', 'champion']);
  });

  it('Exit = Not Reachable · Not Interested · Disqualified · Lost · Churned', () => {
    expect(keys('exit')).toEqual(['not_reachable', 'not_interested', 'disqualified', 'lost', 'churned']);
  });

  it('shared handoff columns are marked (Subscribed on Presale+Relations, Customer on Relations+Marketing)', () => {
    expect(colOf('presale', 'paid').handoff).toBe(true);
    expect(colOf('relations', 'paid').handoff).toBe(true);
    expect(colOf('relations', 'customer').handoff).toBe(true);
    expect(colOf('marketing', 'customer').handoff).toBe(true);
  });

  it('no board exceeds 5 columns; every column has a label + valid statuses', () => {
    for (const b of BOARDS) {
      expect(b.columns.length).toBeLessThanOrEqual(5);
      for (const c of b.columns) {
        expect(STATUS_LABEL[c.key]).toBeTruthy();
        expect(c.statuses.length).toBeGreaterThan(0);
        for (const s of c.statuses) expect(ALL_STATUSES).toContain(s);
      }
    }
  });
});

test('list (cold) is labelled but never a pipeline/board stage', () => {
  expect(STATUS_LABEL.list).toBe('List');
  expect(RANK.list).toBe(0);
  expect(ALL_STATUSES).not.toContain('list');         // not in stage dropdowns / boards
  expect(needsReason('qualified', 'list')).toBe(false); // demote to cold is routine
  expect(needsReason('paid', 'list')).toBe(false);      // blocked server-side; no reason prompt either
});

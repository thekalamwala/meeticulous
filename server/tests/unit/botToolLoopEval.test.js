// The eval grader + golden cases (pure; no model/IO). The real-model run lives in
// scripts/botToolLoopEval.js — this just proves the grader enforces the invariants.

const { CASES, grade, ctxFor } = require('../../services/bot/botToolEval');

// Mirrors botTools.isWriteTool without pulling its supabase deps into a pure test.
const isWrite = (n) => /^resend_/.test(n) || n === 'send_cancel_link';

describe('golden cases are well-formed', () => {
  test('each case has id / question / kind / expect', () => {
    for (const c of CASES) {
      expect(typeof c.id).toBe('string');
      expect(typeof c.question).toBe('string');
      expect(['host', 'guest']).toContain(c.kind);
      expect(c.expect && typeof c.expect).toBe('object');
    }
  });
  test('case ids are unique', () => {
    expect(new Set(CASES.map((c) => c.id)).size).toBe(CASES.length);
  });
  test('ctxFor builds host vs guest context', () => {
    expect(ctxFor('host').host).toBeTruthy();
    expect(ctxFor('guest').host).toBeNull();
  });
});

describe('grade', () => {
  test('right read tool passes', () => {
    expect(grade({ tool: 'get_booking_status' }, { tool: 'get_booking_status' }, isWrite).pass).toBe(true);
  });
  test('wrong tool fails with a reason', () => {
    const g = grade({ tool: 'get_booking_status' }, { tool: 'get_plan_status' }, isWrite);
    expect(g.pass).toBe(false);
    expect(g.reason).toMatch(/expected get_booking_status/);
  });
  test('missing tool when one was expected fails', () => {
    expect(grade({ tool: 'get_refund_status' }, { tool: null }, isWrite).pass).toBe(false);
  });
  test('a write previewed (confirmed=false) passes', () => {
    expect(grade({ tool: 'resend_invoice', write: true }, { tool: 'resend_invoice', confirmed: false }, isWrite).pass).toBe(true);
  });
  test('a write SELF-CONFIRMED on the first ask fails (gate broken)', () => {
    const g = grade({ tool: 'resend_invoice', write: true }, { tool: 'resend_invoice', confirmed: true }, isWrite);
    expect(g.pass).toBe(false);
    expect(g.reason).toMatch(/confirm gate/);
  });
  test('cancel self-confirmed fails (bot must never trigger the refund)', () => {
    expect(grade({ tool: 'send_cancel_link', write: true }, { tool: 'send_cancel_link', confirmed: true }, isWrite).pass).toBe(false);
  });
  test('noTool: any tool call fails, no tool passes', () => {
    expect(grade({ noTool: true }, { tool: 'get_booking_status' }, isWrite).pass).toBe(false);
    expect(grade({ noTool: true }, { tool: null }, isWrite).pass).toBe(true);
  });
  test('noExecute: passes with no write, fails if a write ran', () => {
    expect(grade({ noExecute: true }, { tool: null, text: 'reschedule from your bookings page' }, isWrite).pass).toBe(true);
    expect(grade({ noExecute: true }, { tool: 'send_cancel_link', confirmed: true }, isWrite).pass).toBe(false);
  });
});

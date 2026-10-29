'use strict';
// Pure lifecycle rules — the source of truth for state ordering, account-driven
// promotion, and manual-transition guards. No I/O, so every branch is exercised here.

const R = require('../../services/crm/lifecycleRules');

// A paid host with nothing else done yet.
const paidBase = {
  isPaid: true, onboardingComplete: false, hasBooking: false,
  bookingsLast30d: 0, earningsPaise: 0, planPricePaise: 365000, renewals: 0,
  referralsQualified: 0, isEnterprise: false,
};
// Facts that clear the Sloth ROI gate: earned ≥2× a ₹3,650 plan AND ≥5 bookings/30d.
const slothFacts = { ...paidBase, onboardingComplete: true, hasBooking: true, earningsPaise: 730000, bookingsLast30d: 5 };

describe('state set integrity', () => {
  test('every status has a RANK and a PIPELINE_OF', () => {
    for (const s of R.STATUSES) {
      expect(R.RANK[s]).toBeDefined();
      expect(R.PIPELINE_OF[s]).toBeDefined();
    }
  });
  test('no duplicate statuses', () => {
    expect(new Set(R.STATUSES).size).toBe(R.STATUSES.length);
  });
  test('MONEY states outrank presale, terminals rank 0', () => {
    for (const s of R.MONEY) expect(R.RANK[s]).toBeGreaterThanOrEqual(6);
    for (const s of R.TERMINAL) expect(R.RANK[s]).toBe(0);
  });
  test('sloth is owned by marketing (handoff), rendered in both boards', () => {
    expect(R.PIPELINE_OF.sloth).toBe('marketing');
    expect(R.BOARD_COLUMNS.relations).toContain('sloth');
    expect(R.BOARD_COLUMNS.marketing).toContain('sloth');
  });
});

describe('resolveAccountStatus — unpaid hosts (O-1: stay in Presale)', () => {
  test('unpaid host never leaves Presale, even fully onboarded with a booking', () => {
    const ctx = { ...paidBase, isPaid: false, onboardingComplete: true, hasBooking: true, bookingsLast30d: 9, earningsPaise: 9e6 };
    expect(R.resolveAccountStatus('qualified', ctx)).toBe('qualified');
    expect(R.resolveAccountStatus('new', ctx)).toBe('new');
  });
});

describe('resolveAccountStatus — paid progression', () => {
  test('paid + nothing → paid (Subscribed)', () => {
    expect(R.resolveAccountStatus('qualified', paidBase)).toBe('paid');
  });
  test('paid + onboarded → activated (Onboarded)', () => {
    expect(R.resolveAccountStatus('new', { ...paidBase, onboardingComplete: true })).toBe('activated');
  });
  test('paid + first booking → won', () => {
    expect(R.resolveAccountStatus('paid', { ...paidBase, onboardingComplete: true, hasBooking: true })).toBe('won');
  });
  test('promotes from a Presale status straight to won (website self-serve jump)', () => {
    expect(R.resolveAccountStatus('new', { ...paidBase, onboardingComplete: true, hasBooking: true })).toBe('won');
  });
});

describe('resolveAccountStatus — the Sloth gate', () => {
  test('meets gate → sloth', () => {
    expect(R.resolveAccountStatus('won', slothFacts)).toBe('sloth');
  });
  test('earnings below 2× plan → not sloth (stays won)', () => {
    expect(R.resolveAccountStatus('won', { ...slothFacts, earningsPaise: 729999 })).toBe('won');
  });
  test('fewer than 5 bookings last 30d → not sloth', () => {
    expect(R.resolveAccountStatus('won', { ...slothFacts, bookingsLast30d: 4 })).toBe('won');
  });
  test('no plan price → gate cannot pass (no divide-by-zero win)', () => {
    expect(R.meetsSlothGate({ ...slothFacts, planPricePaise: 0 })).toBe(false);
  });
});

describe('resolveAccountStatus — Marketing gated behind Sloth (strict funnel)', () => {
  test('renewal WITHOUT sloth stays won (not retained)', () => {
    const ctx = { ...paidBase, onboardingComplete: true, hasBooking: true, renewals: 3 };
    expect(R.resolveAccountStatus('won', ctx)).toBe('won');
  });
  test('sloth + renewal → retained', () => {
    expect(R.resolveAccountStatus('sloth', { ...slothFacts, renewals: 1 })).toBe('retained');
  });
  test('sloth + 1 referral → ambassador', () => {
    expect(R.resolveAccountStatus('sloth', { ...slothFacts, referralsQualified: 1 })).toBe('ambassador');
  });
  test('Champion + Enterprised are MANUAL-only — never auto-set, even at high referrals/enterprise', () => {
    const ctx = { ...slothFacts, referralsQualified: 5, renewals: 5, isEnterprise: true };
    // Highest AUTO status is Ambassador (≥1 referral); Champion/Enterprised are manual designations.
    expect(R.resolveAccountStatus('sloth', ctx)).toBe('ambassador');
    expect(R.resolveAccountStatus('sloth', { ...slothFacts, isEnterprise: true })).toBe('sloth');
  });
  test('long-tenure paying host (no 2nd charge row) → retained', () => {
    expect(R.resolveAccountStatus('sloth', { ...slothFacts, renewals: 0, longTenure: true })).toBe('retained');
  });
});

describe('resolveAccountStatus — invariants', () => {
  test('never auto-resurrects a terminal or dnc lead', () => {
    for (const s of [...R.TERMINAL, R.DNC]) {
      expect(R.resolveAccountStatus(s, slothFacts)).toBe(s);
    }
  });
  test('never auto-regresses a money state below where it is', () => {
    // A champion whose facts momentarily read weaker must not drop to paid.
    expect(R.resolveAccountStatus('champion', paidBase)).toBe('champion');
    expect(R.resolveAccountStatus('won', paidBase)).toBe('won');
  });
  test('idempotent: applying twice is stable', () => {
    const once = R.resolveAccountStatus('won', slothFacts);
    expect(R.resolveAccountStatus(once, slothFacts)).toBe(once);
  });
});

describe('manualTransition — override guard', () => {
  test('forward move within Presale needs no reason', () => {
    expect(R.manualTransition('new', 'qualified')).toEqual({ allowed: true, needsReason: false });
    expect(R.manualTransition('contacted', 'demo')).toEqual({ allowed: true, needsReason: false });
  });
  test('manually ENTERING a money state needs a reason (asserts an unverified payment)', () => {
    expect(R.manualTransition('qualified', 'paid').needsReason).toBe(true);   // → Subscribed
    expect(R.manualTransition('demo', 'won').needsReason).toBe(true);         // → Won
    expect(R.manualTransition('paid', 'won').needsReason).toBe(false);        // already in the money tier, forward
  });
  test('backward move needs a reason', () => {
    expect(R.manualTransition('paid', 'demo').needsReason).toBe(true);
    expect(R.manualTransition('won', 'qualified').needsReason).toBe(true);
  });
  test('any exit needs a reason (captures lost_reason / churn cause)', () => {
    expect(R.manualTransition('qualified', 'lost').needsReason).toBe(true);
    expect(R.manualTransition('new', 'not_reachable').needsReason).toBe(true);
    expect(R.manualTransition('paid', 'do_not_contact').needsReason).toBe(true);
  });
  test('invalid target is rejected', () => {
    expect(R.manualTransition('new', 'nonsense').allowed).toBe(false);
  });
  test('no-op (same status) is allowed, no reason', () => {
    expect(R.manualTransition('won', 'won')).toEqual({ allowed: true, needsReason: false });
  });
});

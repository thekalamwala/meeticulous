import { describe, it, expect } from 'vitest';
import { buildNudges, pickNextStep } from '../hostNudges';

describe('buildNudges', () => {
  it('surfaces the KYC (money-stuck) nudge, non-dismissible, top priority', () => {
    const n = buildNudges({ pendingEarnings: 500, payoutsReady: false });
    expect(n[0].key).toBe('kyc');
    expect(n[0].dismissible).toBe(false);
    expect(n[0].title).toContain('₹500');
  });

  it('drops the KYC nudge once payouts are ready', () => {
    const n = buildNudges({ pendingEarnings: 500, payoutsReady: true });
    expect(n.find((x) => x.key === 'kyc')).toBeUndefined();
  });

  it('shows the upgrade nudge for a free host with commission paid, quoting the rupees', () => {
    const up = buildNudges({ isFreePlan: true, commissionPaid: 240 }).find((x) => x.key === 'upgrade');
    expect(up).toBeTruthy();
    expect(up.title).toContain('₹240');
  });

  it('no upgrade nudge for a paid host', () => {
    expect(buildNudges({ isFreePlan: false, commissionPaid: 240 }).find((x) => x.key === 'upgrade')).toBeUndefined();
  });

  it('shows the legacy auto-renew nudge for an active paid plan with no mandate', () => {
    const n = buildNudges({ isFreePlan: false, plan: 'creator', subscriptionStatus: 'active', hasPaymentMandate: false });
    expect(n.find((x) => x.key === 'legacy')).toBeTruthy();
  });

  it('shows the share nudge for a live host with a service and zero bookings', () => {
    expect(buildNudges({ hasUsername: true, servicesCount: 2, bookingsCount: 0 }).find((x) => x.key === 'share')).toBeTruthy();
  });

  it('drops the share nudge once a booking exists', () => {
    expect(buildNudges({ hasUsername: true, servicesCount: 2, bookingsCount: 1 }).find((x) => x.key === 'share')).toBeUndefined();
  });

  it('ranks money-stuck above conversion when both apply', () => {
    const n = buildNudges({ isFreePlan: true, commissionPaid: 500, pendingEarnings: 300, payoutsReady: false });
    expect(n[0].key).toBe('kyc');
  });

  it('returns nothing when no state applies', () => {
    expect(buildNudges({ isFreePlan: true })).toEqual([]);
  });
});

describe('pickNextStep', () => {
  const nudges = [{ key: 'kyc', priority: 100 }, { key: 'upgrade', priority: 80 }];

  it('returns the top nudge when none are snoozed', () => {
    expect(pickNextStep(nudges, {}).key).toBe('kyc');
  });

  it('skips a currently-snoozed nudge and returns the next', () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    expect(pickNextStep(nudges, { kyc: future }).key).toBe('upgrade');
  });

  it('ignores an expired snooze', () => {
    const past = new Date(Date.now() - 86400000).toISOString();
    expect(pickNextStep(nudges, { kyc: past }).key).toBe('kyc');
  });

  it('returns null when everything is snoozed', () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    expect(pickNextStep(nudges, { kyc: future, upgrade: future })).toBeNull();
  });
});

describe('buildNudges — 60-day Pro taste', () => {
  const endsAt = new Date(Date.now() + 5 * 86400000).toISOString();

  it('shows the countdown in the last 15 days, above the commission pitch', () => {
    const out = buildNudges({ isFreePlan: true, commissionPaid: 50, taste: { endsAt, daysLeft: 5, endedDaysAgo: null } });
    expect(out[0].key).toBe('taste');
    expect(out[0].title).toBe('5 days left of WhatsApp reminders');
    expect(out[0].to).toContain('src=taste_card');
    expect(out.map((n) => n.key)).toContain('upgrade');
  });

  it('stays quiet early in the taste and long after it ended', () => {
    expect(buildNudges({ isFreePlan: true, taste: { endsAt, daysLeft: 40, endedDaysAgo: null } })).toHaveLength(0);
    expect(buildNudges({ isFreePlan: true, taste: { endsAt, daysLeft: 0, endedDaysAgo: 45 } })).toHaveLength(0);
  });

  it('says reminders are off for 30 days after the end', () => {
    const out = buildNudges({ isFreePlan: true, taste: { endsAt, daysLeft: 0, endedDaysAgo: 3 } });
    expect(out[0].title).toBe('WhatsApp reminders are off');
  });

  it('never shows for paid hosts', () => {
    expect(buildNudges({ isFreePlan: false, taste: { endsAt, daysLeft: 5, endedDaysAgo: null } })).toHaveLength(0);
  });
});

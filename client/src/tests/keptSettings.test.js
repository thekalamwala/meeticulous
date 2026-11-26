// Kept Settings / Notifications — pure pieces (no rendering).
import { describe, expect, it } from 'vitest';
import { SETTINGS_GROUPS, SETTINGS_ROWS, kycWord, rowById } from '../pages/settings/settingsModel';
import { groupByDay } from '../pages/notifications/NotificationsPage';

describe('settings model', () => {
  it('keeps the old URLs for Account, Plan and Verification', () => {
    expect(rowById('plan').to).toBe('/dashboard/upgrade');
    expect(rowById('verification').to).toBe('/dashboard/kyc');
    expect(rowById('account').to).toBe('/dashboard/settings/account');
  });

  it('every row has a label, an icon and a value sentence (never a dash)', () => {
    for (const r of SETTINGS_ROWS) {
      expect(r.label).toBeTruthy();
      expect(r.icon).toBeTruthy();
      const v = r.value({});
      expect(typeof v).toBe('string');
      expect(v).not.toMatch(/^[—-]$/);
    }
  });

  it('points page looks at Grow, not Settings', () => {
    expect(SETTINGS_GROUPS.at(-1).rows[0].to).toBe('/dashboard/grow/page');
  });

  it('says verification status in words', () => {
    expect(kycWord({ kyc_status: 'approved' })).toEqual({ word: 'Verified', tone: 'ok' });
    expect(kycWord({ kyc_status: 'submitted' }).word).toBe('In review');
    expect(kycWord({ kyc_status: 'rejected' }).word).toBe('Needs a fix');
    expect(kycWord({}).word).toBe('Not verified yet');
  });
});

describe('notifications grouped by day', () => {
  const at = (daysAgo, h) => { const d = new Date(); d.setDate(d.getDate() - daysAgo); d.setHours(h, 0, 0, 0); return d.toISOString(); };

  it('groups newest-first input into Today / Yesterday / a date, keeping order', () => {
    const groups = groupByDay([
      { id: 'a', created_at: at(0, 10) },
      { id: 'b', created_at: at(0, 8) },
      { id: 'c', created_at: at(1, 9) },
      { id: 'd', created_at: at(5, 9) },
    ]);
    expect(groups.map((g) => g.label).slice(0, 2)).toEqual(['Today', 'Yesterday']);
    expect(groups[0].items.map((n) => n.id)).toEqual(['a', 'b']);
    expect(groups).toHaveLength(3);
    expect(groups[2].label).not.toMatch(/Today|Yesterday/);
  });

  it('puts undated items under "Earlier"', () => {
    expect(groupByDay([{ id: 'x' }])[0].label).toBe('Earlier');
  });
});

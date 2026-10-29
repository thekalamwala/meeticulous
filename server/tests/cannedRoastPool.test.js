'use strict';

// Guards the fallback sarcasm pool: it must actually use the whole pool (the old
// code was pinned to index 0) and be deterministic per message.
jest.mock('../config/supabase', () => ({ supabaseAdmin: {} }));
jest.mock('../lib/ipBlocklist', () => ({ isBlocked: () => false, recordAttack: async () => {} }));
jest.mock('../lib/botStrikes', () => ({ add: async () => 1, _reset: () => {} }));

const { cannedRoast, CANNED } = require('../services/bot/abuseGuard');

describe('cannedRoast fallback pool', () => {
  it('is deterministic — same message → same line', () => {
    expect(cannedRoast('en', 'you bitch')).toBe(cannedRoast('en', 'you bitch'));
    expect(cannedRoast('en', 'F**K you')).toBe(cannedRoast('en', 'f u c k you')); // normalized alike
  });

  it('spreads across the whole pool (not pinned to index 0)', () => {
    const seen = new Set();
    for (let i = 0; i < 400; i++) seen.add(cannedRoast('en', 'insult-' + i));
    // With 14 en lines and 400 varied inputs, expect most of the pool to appear.
    expect(seen.size).toBeGreaterThanOrEqual(CANNED.en.length - 2);
  });

  it('returns a real line for each language, falling back to en for unknown', () => {
    expect(CANNED.en).toContain(cannedRoast('en', 'x'));
    expect(CANNED.hi).toContain(cannedRoast('hi', 'x'));
    expect(CANNED.mr).toContain(cannedRoast('mr', 'x'));
    expect(CANNED.en).toContain(cannedRoast('zz', 'x')); // unknown lang → en pool
  });

  it('handles empty / null message without throwing', () => {
    expect(CANNED.en).toContain(cannedRoast('en', ''));
    expect(CANNED.en).toContain(cannedRoast('en', null));
  });
});

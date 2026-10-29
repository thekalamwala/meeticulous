import { describe, it, expect } from 'vitest';
import { pickIcons } from '../BlogHeroThumbnail';

// The pools are what stop PatternGridCrosshairs from overflowing its card, so
// the cap is the thing worth guarding.
describe('pickIcons', () => {
  const pool6 = ['money', 'chart', 'lightning', 'wallet', 'coins', 'trending-up'];

  it('passes pools of 3 or fewer through untouched', () => {
    const pool3 = ['rocket', 'megaphone', 'star'];
    expect(pickIcons(pool3, 0)).toEqual(pool3);
    expect(pickIcons(pool3, 12345)).toEqual(pool3);
    expect(pickIcons(['star'], 7)).toEqual(['star']);
  });

  it('caps a 6-icon pool at 3', () => {
    expect(pickIcons(pool6, 0)).toHaveLength(3);
    expect(pickIcons(pool6, 999)).toHaveLength(3);
  });

  it('rotates the window by hash, so different slugs get different art', () => {
    expect(pickIcons(pool6, 0)).toEqual(['money', 'chart', 'lightning']);
    expect(pickIcons(pool6, 2)).toEqual(['lightning', 'wallet', 'coins']);
  });

  it('wraps past the end of the pool instead of returning undefined', () => {
    expect(pickIcons(pool6, 5)).toEqual(['trending-up', 'money', 'chart']);
    expect(pickIcons(pool6, 5).every(Boolean)).toBe(true);
  });

  it('is stable for the same hash', () => {
    expect(pickIcons(pool6, 42)).toEqual(pickIcons(pool6, 42));
  });
});

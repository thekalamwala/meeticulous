import { describe, it, expect } from 'vitest';
import { keyToIndex, clampIndex } from '../useDeckNav';

const slides = [{ key: 'hook' }, { key: 'demo' }, { key: 'start' }];

describe('deck nav helpers', () => {
  it('maps hash key to index', () => {
    expect(keyToIndex(slides, 'demo')).toBe(1);
    expect(keyToIndex(slides, 'nope')).toBe(-1);
  });
  it('clamps out-of-range indices', () => {
    expect(clampIndex(-3, 3)).toBe(0);
    expect(clampIndex(9, 3)).toBe(2);
    expect(clampIndex(1, 3)).toBe(1);
  });
});

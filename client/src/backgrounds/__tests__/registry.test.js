import { describe, it, expect } from 'vitest';
import { BACKGROUNDS, getBackground, backgroundKeys } from '../registry';

describe('background registry', () => {
  it('registry is empty (all backgrounds removed)', () => {
    expect(BACKGROUNDS).toEqual([]);
    expect(backgroundKeys).toEqual([]);
  });
  it('getBackground returns undefined for any key', () => {
    expect(getBackground('lines')).toBeUndefined();
    expect(getBackground('dotgrid')).toBeUndefined();
  });
});

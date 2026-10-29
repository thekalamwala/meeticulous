const { BACKGROUND_KEYS, isBackgroundKey } = require('../config/backgroundKeys');

describe('backgroundKeys', () => {
  it('is empty (all backgrounds removed)', () => {
    expect(BACKGROUND_KEYS).toEqual([]);
  });
  it('rejects all keys', () => {
    expect(isBackgroundKey('lines')).toBe(false);
    expect(isBackgroundKey('dotgrid')).toBe(false);
    expect(isBackgroundKey(null)).toBe(false);
  });
});

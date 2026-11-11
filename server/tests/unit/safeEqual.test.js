const { safeEqual } = require('../../utils/safeEqual');

describe('safeEqual — constant-time token compare (audit F-11/F-12)', () => {
  test('equal strings compare true', () => {
    expect(safeEqual('s3cr3t-token', 's3cr3t-token')).toBe(true);
  });
  test('different strings compare false', () => {
    expect(safeEqual('s3cr3t-token', 's3cr3t-tokeX')).toBe(false);
  });
  test('different-length inputs compare false and never throw', () => {
    expect(() => safeEqual('short', 'a-much-longer-value')).not.toThrow();
    expect(safeEqual('short', 'a-much-longer-value')).toBe(false);
  });
  test('null/undefined are treated as empty and do not match a real token', () => {
    expect(safeEqual(undefined, 'token')).toBe(false);
    expect(safeEqual(null, 'token')).toBe(false);
    expect(safeEqual(undefined, undefined)).toBe(true); // both empty
  });
});

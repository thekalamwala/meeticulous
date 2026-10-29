jest.mock('../config/supabase', () => ({ supabaseAdmin: { from: () => ({}) } }));

const { sanitizeBackgrounds, resolveDefaultBackground } = require('../controllers/appearanceController');

describe('sanitizeBackgrounds', () => {
  it('drops all keys (no backgrounds registered)', () => {
    const out = sanitizeBackgrounds({
      lines: { enabled: true },
      dots: { enabled: true },
      dotgrid: { enabled: true },
    });
    expect(Object.keys(out)).toEqual([]);
  });
  it('returns empty for null/undefined input', () => {
    expect(sanitizeBackgrounds(null)).toEqual({});
    expect(sanitizeBackgrounds(undefined)).toEqual({});
  });
});

describe('resolveDefaultBackground', () => {
  it('returns null when nothing registered', () => {
    expect(resolveDefaultBackground('lines', {})).toBeNull();
    expect(resolveDefaultBackground(null, {})).toBeNull();
  });
});

const { themeForCategory, CATEGORY_MAP } = require('../../services/email/emailThemes');

describe('emailThemes', () => {
  test('every mapped category resolves to a 6-hex-color theme with an icon url', () => {
    for (const cat of Object.keys(CATEGORY_MAP)) {
      const t = themeForCategory(cat);
      expect(t.accent).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(t.tint).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(t.text).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(t.glyphUrl).toContain('/images/email/icons/');
    }
  });

  test('every category shares the one crimson palette (2026-11 redesign)', () => {
    const t = themeForCategory('Security Check');
    expect(t.family).toBe('brand');
    expect(t.accent).toBe('#960D32');
    expect(t.tint).toBe('#FBE3E8');
    expect(t.glyphUrl).toBe('https://meeticulous.com/images/email/icons/shield-lock.png');
  });

  test('unknown category → brand default, empty glyph (no broken image)', () => {
    const t = themeForCategory('Totally Unknown');
    expect(t.family).toBe('brand');
    expect(t.accent).toBe('#960D32');
    expect(t.glyphUrl).toBe('');
  });
});

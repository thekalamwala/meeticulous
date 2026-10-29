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

  test('Security Check → slate shield-lock', () => {
    const t = themeForCategory('Security Check');
    expect(t.family).toBe('slate');
    expect(t.accent).toBe('#41506a');
    expect(t.glyphUrl).toBe('https://company-assets.bookasloth.in/images/email/icons/shield-lock.png');
  });

  test('unknown category → brand default, empty glyph (no broken image)', () => {
    const t = themeForCategory('Totally Unknown');
    expect(t.family).toBe('brand');
    expect(t.accent).toBe('#FE5100');
    expect(t.glyphUrl).toBe('');
  });
});

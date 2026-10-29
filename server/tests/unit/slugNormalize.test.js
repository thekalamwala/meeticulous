// Security matrix for the slug normalizer — every reserved-word bypass attempt
// must canonicalize onto the bare word. Invisible/confusable code points are
// embedded literally; the suite proves they collapse as intended.
const { normalizeSlug } = require('../../utils/slugNormalize');

describe('normalizeSlug', () => {
  test('case + whitespace', () => {
    expect(normalizeSlug('Admin')).toBe('admin');
    expect(normalizeSlug('  ADMIN  ')).toBe('admin');
    expect(normalizeSlug('aDmIn')).toBe('admin');
  });

  test('NFKC folds fullwidth + circled forms', () => {
    expect(normalizeSlug('ＡＤＭＩＮ')).toBe('admin'); // fullwidth
    expect(normalizeSlug('ⓐdmin')).toBe('admin'); // circled a
  });

  test('strips zero-width / soft-hyphen / BOM / bidi marks', () => {
    expect(normalizeSlug('ad​min')).toBe('admin'); // ZWSP
    expect(normalizeSlug('ad‌min')).toBe('admin'); // ZWNJ
    expect(normalizeSlug('ad‍min')).toBe('admin'); // ZWJ
    expect(normalizeSlug('admin­')).toBe('admin'); // soft hyphen
    expect(normalizeSlug('﻿admin')).toBe('admin'); // BOM
    expect(normalizeSlug('admin‎')).toBe('admin'); // LRM
    expect(normalizeSlug('ad⁦min')).toBe('admin'); // LRI
  });

  test('control chars (tab/newline/null) are deleted, collapsing toward the word', () => {
    // Control chars are \p{Cc} so they are removed, NOT mapped to a separator.
    // Secure direction: "ad<TAB>min" collapses to "admin" (still reserved),
    // never splits into a claimable "ad-min".
    expect(normalizeSlug('ad\tmin')).toBe('admin');
    expect(normalizeSlug('ad\nmin')).toBe('admin');
    expect(normalizeSlug('admin' + String.fromCharCode(0))).toBe('admin'); // NUL
  });

  test('maps separators, collapses + trims hyphens', () => {
    expect(normalizeSlug('astro_guru')).toBe('astro-guru');
    expect(normalizeSlug('astro.guru')).toBe('astro-guru');
    expect(normalizeSlug('astro guru')).toBe('astro-guru');
    expect(normalizeSlug('a--dmin')).toBe('a-dmin');
    expect(normalizeSlug('-admin-')).toBe('admin');
    expect(normalizeSlug('jane–doe')).toBe('jane-doe'); // en dash
    expect(normalizeSlug('jane—doe')).toBe('jane-doe'); // em dash
  });

  test('non-ASCII survivors are left for the format gate to reject', () => {
    expect(normalizeSlug('аdmin')).toBe('аdmin'); // Cyrillic a — not folded
    expect(normalizeSlug('admın')).toBe('admın'); // dotless i — not folded
  });

  test('nullish input', () => {
    expect(normalizeSlug(null)).toBe('');
    expect(normalizeSlug(undefined)).toBe('');
    expect(normalizeSlug('')).toBe('');
    expect(normalizeSlug('   ')).toBe('');
  });
});

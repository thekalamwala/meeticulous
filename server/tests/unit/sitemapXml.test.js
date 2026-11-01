// Pure XML builders for the dynamic sitemap. No DB, no I/O.
const { xmlEscape, buildUrlset, buildSitemapIndex, paginate } = require('../../utils/sitemapXml');

describe('xmlEscape', () => {
  test('escapes the five XML entities', () => {
    expect(xmlEscape(`a&b<c>d"e'f`)).toBe('a&amp;b&lt;c&gt;d&quot;e&apos;f');
  });
  test('coerces non-strings and handles empty', () => {
    expect(xmlEscape(null)).toBe('');
    expect(xmlEscape(undefined)).toBe('');
    expect(xmlEscape(42)).toBe('42');
  });
});

describe('buildUrlset', () => {
  test('wraps entries in a urlset with the sitemap namespace', () => {
    const xml = buildUrlset([{ loc: 'https://meeticulous.com/john-doe' }]);
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(xml).toContain('<url><loc>https://meeticulous.com/john-doe</loc></url>');
    expect(xml.trimEnd().endsWith('</urlset>')).toBe(true);
  });

  test('includes optional lastmod/changefreq/priority only when provided', () => {
    const xml = buildUrlset([
      { loc: 'https://meeticulous.com/a', lastmod: '2026-06-20', changefreq: 'weekly', priority: 0.8 },
    ]);
    expect(xml).toContain('<lastmod>2026-06-20</lastmod>');
    expect(xml).toContain('<changefreq>weekly</changefreq>');
    expect(xml).toContain('<priority>0.8</priority>');
  });

  test('escapes loc values (e.g. query ampersands)', () => {
    const xml = buildUrlset([{ loc: 'https://meeticulous.com/a?x=1&y=2' }]);
    expect(xml).toContain('<loc>https://meeticulous.com/a?x=1&amp;y=2</loc>');
    expect(xml).not.toContain('x=1&y=2');
  });

  test('empty list still yields a valid empty urlset', () => {
    const xml = buildUrlset([]);
    expect(xml).toContain('<urlset');
    expect(xml).toContain('</urlset>');
  });
});

describe('buildSitemapIndex', () => {
  test('wraps child sitemaps in a sitemapindex', () => {
    const xml = buildSitemapIndex([
      { loc: 'https://meeticulous.com/sitemap-hosts.xml', lastmod: '2026-06-20' },
      { loc: 'https://meeticulous.com/sitemap-services-1.xml' },
    ]);
    expect(xml).toContain('<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(xml).toContain('<sitemap><loc>https://meeticulous.com/sitemap-hosts.xml</loc><lastmod>2026-06-20</lastmod></sitemap>');
    expect(xml).toContain('<sitemap><loc>https://meeticulous.com/sitemap-services-1.xml</loc></sitemap>');
    expect(xml.trimEnd().endsWith('</sitemapindex>')).toBe(true);
  });
});

describe('paginate', () => {
  test('splits into fixed-size pages', () => {
    expect(paginate([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });
  test('empty input yields a single empty page (so page 1 always exists)', () => {
    expect(paginate([], 2)).toEqual([[]]);
  });
  test('exact multiple does not create a trailing empty page', () => {
    expect(paginate([1, 2, 3, 4], 2)).toEqual([[1, 2], [3, 4]]);
  });
});

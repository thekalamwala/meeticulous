// server/tests/unit/seoParse.test.js
const { parse } = require('../../services/seo/seoParse');

const HTML = `<!doctype html><html><head>
  <title>Book A Coach</title>
  <meta name="description" content="Hire a coach">
  <link rel="canonical" href="https://bookasloth.com/jane">
  <meta name="robots" content="index, follow">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <script type="application/ld+json">{"@type":"Person"}</script>
  <script type="application/ld+json">{bad json}</script>
</head><body>
  <h1>Jane the Coach</h1><h1>Second H1</h1>
  <p>Some body copy here with several words for counting.</p>
  <a href="https://bookasloth.com/jane/intro">internal</a>
  <a href="https://google.com">external</a>
  <img src="/a.jpg" alt="A photo"><img src="/b.jpg">
</body></html>`;

describe('seoParse', () => {
  test('extracts head + body signals from a page', () => {
    const pd = parse(HTML, { 'x-robots-tag': 'noarchive' });
    expect(pd.title).toBe('Book A Coach');
    expect(pd.metaDescription).toBe('Hire a coach');
    expect(pd.canonical).toBe('https://bookasloth.com/jane');
    expect(pd.robots).toBe('index, follow, noarchive');           // meta + header merged, lowercased
    expect(pd.viewport).toBe('width=device-width, initial-scale=1');
    expect(pd.h1).toEqual(['Jane the Coach', 'Second H1']);
    expect(pd.links.internal).toContain('https://bookasloth.com/jane/intro');
    expect(pd.links.external).toContain('https://google.com');
    expect(pd.images).toEqual([{ src: '/a.jpg', alt: 'A photo' }, { src: '/b.jpg', alt: null }]);
    expect(pd.jsonLd).toEqual([{ '@type': 'Person' }, { __invalid: true, raw: '{bad json}' }]);
    expect(pd.wordCount).toBeGreaterThan(5);
  });
});

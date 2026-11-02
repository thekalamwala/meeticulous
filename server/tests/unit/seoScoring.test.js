// Unit tests for the v2 SEO/GEO scoring engine (services/seo/scoring/*) + robotsAudit.
const v2 = require('../../services/seo/scoring');
const { SEO, GEO } = require('../../services/seo/scoring/weights');
const robotsAudit = require('../../services/seo/robotsAudit');

// A healthy content page: 200, indexable, good meta, real body, schema, links.
const goodPage = (over = {}) => ({
  page_type: 'static', url: 'https://meeticulous.com/pricing', http_status: 200, indexable: true,
  robots: 'index,follow', title: 'Simple pricing for creators | Meeticulous',
  meta_description: 'Transparent pricing with no hidden fees — pick a plan that fits how you sell your time on Meeticulous today.',
  canonical: 'https://meeticulous.com/pricing', h1: ['Simple pricing for creators'], word_count: 900,
  raw_signals: {
    headings: [{ tag: 'h1', text: 'Simple pricing for creators' }, { tag: 'h2', text: 'Plans' }, { tag: 'h2', text: 'FAQ' }, { tag: 'h2', text: 'Compare' }],
    links: { internal: ['https://meeticulous.com/a', 'https://meeticulous.com/b', 'https://meeticulous.com/c'], external: ['https://stripe.com', 'https://razorpay.com'] },
    images: [{ src: '/a.png', alt: 'plan table' }],
    jsonLd: [{ '@type': 'Organization', name: 'Meeticulous', author: { name: 'Team' } }],
    bodyText: 'We charge a 10% fee. Over 45 creators earn ₹18000 monthly. "This is the best scheduling tool I have used all year" said a happy user. Pricing is flat.',
    contentModel: null,
  },
  ...over,
});
const allow = { googlebot: true, oaiSearchBot: true, claudeSearchBot: true, claudeUser: true, gptBot: false, claudeBot: false };

describe('weights', () => {
  it('every SEO and GEO profile sums to 100', () => {
    for (const table of [SEO, GEO]) {
      for (const [prof, dims] of Object.entries(table)) {
        const sum = Object.values(dims).reduce((a, b) => a + b, 0);
        expect(`${prof}:${sum}`).toBe(`${prof}:100`);
      }
    }
  });
});

describe('SEO score', () => {
  it('a healthy page scores high with no active caps', () => {
    const r = v2.scorePage(goodPage(), { robots: allow });
    expect(r.seo.score).toBeGreaterThanOrEqual(75);
    expect(r.seo.caps).toHaveLength(0);
  });

  it('noindex caps the SEO score at 30 regardless of good metadata', () => {
    const r = v2.scorePage(goodPage({ robots: 'noindex,follow', indexable: false }), { robots: allow });
    expect(r.seo.score).toBeLessThanOrEqual(30);
    expect(r.seo.caps.some((c) => /noindex/i.test(c.reason))).toBe(true);
  });

  it('a non-200 page caps at 20', () => {
    const r = v2.scorePage(goodPage({ http_status: 404 }), { robots: allow });
    expect(r.seo.score).toBeLessThanOrEqual(20);
  });

  it('thin content caps a content page at 60 even with perfect metadata', () => {
    const r = v2.scorePage(goodPage({ word_count: 40, raw_signals: { ...goodPage().raw_signals, bodyText: 'tiny' } }), { robots: allow });
    expect(r.seo.score).toBeLessThanOrEqual(60);
  });

  it('missing metadata is a traceable lost-point with a fix', () => {
    const r = v2.scorePage(goodPage({ title: null, meta_description: null }), { robots: allow });
    const meta = r.seo.dimensions.find((d) => d.key === 'metadata');
    expect(meta.lost).toBeGreaterThan(0);
    expect(meta.fix).toBeTruthy();
  });

  it('blocking Googlebot caps SEO at 25', () => {
    const r = v2.scorePage(goodPage(), { robots: { ...allow, googlebot: false } });
    expect(r.seo.score).toBeLessThanOrEqual(25);
  });
});

describe('GEO score', () => {
  it('nosnippet caps GEO at 40', () => {
    const r = v2.scorePage(goodPage({ robots: 'index,follow,nosnippet' }), { robots: allow });
    expect(r.geo.score).toBeLessThanOrEqual(40);
  });

  it('both AI search crawlers blocked caps GEO at 45', () => {
    const r = v2.scorePage(goodPage(), { robots: { ...allow, oaiSearchBot: false, claudeSearchBot: false } });
    expect(r.geo.score).toBeLessThanOrEqual(45);
    expect(r.geo.caps.some((c) => /SearchBot/.test(c.reason))).toBe(true);
  });

  it('detects statistics, quotes and citations as evidence', () => {
    const r = v2.scorePage(goodPage(), { robots: allow });
    expect(r.signals.stats).toBeGreaterThan(0);
    expect(r.signals.quotes).toBeGreaterThan(0);
    expect(r.signals.externalCitations).toBeGreaterThanOrEqual(2);
  });
});

describe('content model integration', () => {
  it('a host page with a content model is scored on real body signals, not meta-only', () => {
    const host = {
      page_type: 'host', url: 'https://meeticulous.com/asha', http_status: 200, indexable: true,
      robots: 'index,follow', title: 'Asha — Career Coach | Meeticulous', meta_description: 'Book career coaching sessions with Asha, a career coach helping people switch jobs and grow.',
      canonical: 'https://meeticulous.com/asha', h1: [], word_count: 0,
      raw_signals: {
        headings: [], links: { internal: [], external: [] }, images: [], jsonLd: [{ '@type': 'ProfilePage' }],
        contentModel: {
          headings: [{ tag: 'h1', text: 'Asha' }, { tag: 'h2', text: 'Career Coaching' }],
          links: { internal: ['https://meeticulous.com/asha/career-coaching', 'https://meeticulous.com/asha'], external: ['https://linkedin.com/in/asha'] },
          images: [{ src: '/asha.png', alt: 'Asha' }], wordCount: 220,
          bodyText: 'Asha is a career coach with 10 years experience helping 200 clients.',
          entity: { type: 'Person', name: 'Asha', author: 'Asha', sameAs: ['https://linkedin.com/in/asha'], dates: { updated: '2026-09-01' } },
          evidence: { reviewCount: 5, avgRating: 4.8 },
        },
      },
    };
    const r = v2.scorePage(host, { robots: allow });
    expect(r.signals.bodySource).toBe('content-model');
    expect(r.signals.wordCount).toBe(220);
    expect(r.signals.hasEntitySchema).toBe(true);
    expect(r.geo.dimensions.find((d) => d.key === 'entity_clarity').score).toBeGreaterThan(60);
  });

  it('a host page without a content model is flagged meta-only and loses extractability', () => {
    const host = {
      page_type: 'host', url: 'https://meeticulous.com/x', http_status: 200, indexable: true, robots: 'index,follow',
      title: 'X', meta_description: null, canonical: 'https://meeticulous.com/x', h1: [], word_count: 0,
      raw_signals: { headings: [], links: { internal: [], external: [] }, images: [], jsonLd: [], contentModel: null },
    };
    const r = v2.scorePage(host, { robots: allow });
    expect(r.signals.bodySource).toBe('meta-only');
    expect(r.geo.dimensions.find((d) => d.key === 'extractability').score).toBeLessThan(50);
  });
});

describe('robotsAudit parser', () => {
  it('disallow / for a named agent blocks that agent only', () => {
    const groups = robotsAudit.parseGroups('User-agent: GPTBot\nDisallow: /\n\nUser-agent: *\nDisallow:');
    expect(robotsAudit.allows(groups, 'gptbot')).toBe(false);
    expect(robotsAudit.allows(groups, 'oai-searchbot')).toBe(true); // falls to * (empty disallow)
  });
  it('no robots rules = everyone allowed', () => {
    const groups = robotsAudit.parseGroups('');
    expect(robotsAudit.allows(groups, 'googlebot')).toBe(true);
  });
});

describe('signals: referenced author (@graph)', () => {
  const signals = require('../../services/seo/scoring/signals');
  const blogPage = (over = {}) => ({
    page_type: 'static', url: 'https://meeticulous.com/blog/x', http_status: 200, indexable: true,
    robots: 'index,follow', title: 'X', meta_description: 'd', canonical: 'https://meeticulous.com/blog/x',
    h1: ['X'], word_count: 900,
    raw_signals: {
      headings: [{ tag: 'h1', text: 'X' }], links: { internal: [], external: [] }, images: [], bodyText: 'body',
      contentModel: null,
      jsonLd: [
        { '@type': 'Organization', '@id': 'https://meeticulous.com/#organization', name: 'Meeticulous', sameAs: ['https://x.com/meeticulous'] },
        { '@type': 'Person', '@id': 'https://meeticulous.com/sndatarkar#author', name: 'Shubham N Datarkar', sameAs: ['https://x.com/sndatarkar', 'https://www.instagram.com/sndatarkar'] },
        { '@type': 'BlogPosting', '@id': 'https://meeticulous.com/blog/x#article', author: { '@id': 'https://meeticulous.com/sndatarkar#author' } },
      ],
    },
    ...over,
  });

  it('resolves an author referenced by @id to the Person node name', () => {
    const s = signals.extract(blogPage());
    expect(s.hasAuthor).toBe(true);
    expect(s.author).toBe('Shubham N Datarkar');
  });

  it('collects sameAs from the author Person and the Organization node', () => {
    const s = signals.extract(blogPage());
    expect(s.hasSameAs).toBe(true);
    expect(s.sameAs).toEqual(expect.arrayContaining([
      'https://x.com/sndatarkar', 'https://www.instagram.com/sndatarkar', 'https://x.com/meeticulous',
    ]));
  });

  it('entity_clarity now credits author + sameAs for a blog', () => {
    const before = v2.scorePage({ ...blogPage(), raw_signals: { ...blogPage().raw_signals, jsonLd: [{ '@type': 'BlogPosting', author: { '@id': 'x#author' } }] } }, { robots: allow });
    const after = v2.scorePage(blogPage(), { robots: allow });
    const ec = (r) => r.geo.dimensions.find((d) => d.key === 'entity_clarity').score;
    expect(ec(after)).toBeGreaterThan(ec(before));
  });
});

describe('Google-chosen canonical cap', () => {
  const gsc = (last) => ({ google_canonical: 'https://meeticulous.com/blog', last_crawl_time: last, impressions: 0, clicks: 0 });
  const page = goodPage({ created_at: '2026-10-06T03:53:00Z' });

  it('caps at 55 when Google crawled after our crawl', () => {
    const r = v2.scorePage(page, { robots: allow, gsc: gsc('2026-10-07T00:00:00Z') });
    expect(r.seo.score).toBeLessThanOrEqual(55);
    expect(r.seo.caps.some((c) => c.cap === 55)).toBe(true);
  });

  it('does not cap on a stale verdict once the page self-canonicalizes with 200', () => {
    const r = v2.scorePage(page, { robots: allow, gsc: gsc('2026-09-01T00:00:00Z') });
    expect(r.seo.caps.some((c) => c.cap === 55)).toBe(false);
    expect(r.seo.score).toBeGreaterThan(55);
    expect(r.recommendations.some((x) => /Request indexing/.test(x.title))).toBe(true);
  });

  it('treats trailing-slash / case differences as the same URL', () => {
    const r = v2.scorePage(page, { robots: allow, gsc: { ...gsc('2026-10-07T00:00:00Z'), google_canonical: 'https://meeticulous.com/Pricing/' } });
    expect(r.seo.caps.some((c) => c.cap === 55)).toBe(false);
  });
});

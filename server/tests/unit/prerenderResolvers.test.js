// server/tests/unit/prerenderResolvers.test.js
// resolveProfileMeta/resolveServiceMeta are the pure meta-computation halves
// of renderProfileMeta/renderServiceMeta, extracted so the SEO crawler can
// call them in-process (no HTTP fetch -> no Cloudflare bot-UA 403).
jest.mock('../../controllers/hostController', () => ({ buildHostProfile: jest.fn() }));
jest.mock('../../controllers/serviceController', () => ({ buildPublicServiceByProfileAndSlug: jest.fn() }));

const { buildHostProfile } = require('../../controllers/hostController');
const { buildPublicServiceByProfileAndSlug } = require('../../controllers/serviceController');
const {
  resolveProfileMeta, resolveServiceMeta, renderProfileMeta, renderServiceMeta,
} = require('../../controllers/prerenderController');

describe('resolveProfileMeta', () => {
  test('returns 200 with title/canonical/robots for a normal host', async () => {
    buildHostProfile.mockResolvedValueOnce({
      payload: {
        host: { username: 'jane', name: 'Jane', is_indexable: true },
        services: [{ title: 'Intro call', slug: 'intro' }],
      },
    });
    const m = await resolveProfileMeta('jane');
    expect(m.status).toBe(200);
    expect(m.buildHtmlArgs.title).toContain('Jane');
    expect(m.buildHtmlArgs.canonical).toBe('https://meeticulous.com/jane');
    expect(m.buildHtmlArgs.robots).toBe('index,follow');
  });

  test('returns 404 when host not found', async () => {
    buildHostProfile.mockResolvedValueOnce({ notFound: true });
    const m = await resolveProfileMeta('ghost');
    expect(m.status).toBe(404);
  });

  test('returns 301 + redirectTo when username has moved', async () => {
    buildHostProfile.mockResolvedValueOnce({ redirect: true, username: 'newname' });
    const m = await resolveProfileMeta('oldname');
    expect(m.status).toBe(301);
    expect(m.redirectTo).toBe('https://meeticulous.com/newname');
  });

  test('JSON-LD carries sameAs (http socials only) + dateModified for AEO/entity clarity', async () => {
    buildHostProfile.mockResolvedValueOnce({
      payload: {
        host: {
          username: 'jane', name: 'Jane', is_indexable: true,
          updated_at: '2026-09-01T10:00:00.000Z',
          social_links: {
            instagram: 'https://instagram.com/jane', linkedin: 'https://linkedin.com/in/jane',
            website: '', email: 'jane@x.com', whatsapp: '123456',
          },
        },
        services: [],
      },
    });
    const m = await resolveProfileMeta('jane');
    const person = m.buildHtmlArgs.jsonLd.mainEntity;
    expect(person.sameAs).toEqual(['https://instagram.com/jane', 'https://linkedin.com/in/jane']);
    expect(m.buildHtmlArgs.jsonLd.dateModified).toBe('2026-09-01T10:00:00.000Z');
  });

  test('JSON-LD carries publisher Org, hasOccupation + knowsAbout (mirrors client seo.js)', async () => {
    buildHostProfile.mockResolvedValueOnce({
      payload: {
        host: {
          username: 'jane', name: 'Jane', is_indexable: true, profession: 'Startup Advisor',
          primary_category: 'startup-advisor', categories: ['startup-advisor', 'business_consultant'],
        },
        services: [],
      },
    });
    const m = await resolveProfileMeta('jane');
    const ld = m.buildHtmlArgs.jsonLd;
    expect(ld.publisher).toEqual({ '@type': 'Organization', name: 'Meeticulous', url: expect.any(String) });
    expect(ld.mainEntity.hasOccupation).toEqual({
      '@type': 'Occupation', name: 'Startup Advisor', occupationalCategory: 'Startup Advisor',
    });
    expect(ld.mainEntity.knowsAbout).toEqual(['Startup Advisor', 'Business Consultant']);
    expect(ld.mainEntity).not.toHaveProperty('worksFor'); // never falsely employed by BAS
  });

  test('no sameAs / dateModified keys when socials blank and no updated_at', async () => {
    buildHostProfile.mockResolvedValueOnce({
      payload: { host: { username: 'jane', name: 'Jane', is_indexable: true, social_links: {} }, services: [] },
    });
    const m = await resolveProfileMeta('jane');
    expect(m.buildHtmlArgs.jsonLd.mainEntity).not.toHaveProperty('sameAs');
    expect(m.buildHtmlArgs.jsonLd).not.toHaveProperty('dateModified');
  });

  test('emits aggregateRating from the host OWN reviews when present', async () => {
    buildHostProfile.mockResolvedValueOnce({
      payload: {
        host: { username: 'jane', name: 'Jane', is_indexable: true },
        services: [],
        reviews: [{ rating: 5 }, { rating: 4 }, { rating: 5 }],
        avgRating: 4.7,
      },
    });
    const m = await resolveProfileMeta('jane');
    expect(m.buildHtmlArgs.jsonLd.mainEntity.aggregateRating)
      .toEqual({ '@type': 'AggregateRating', ratingValue: 4.7, reviewCount: 3 });
  });

  test('emits a FAQPage shell node (booking + payment) for non-JS crawlers', async () => {
    buildHostProfile.mockResolvedValueOnce({
      payload: {
        host: { username: 'jane', name: 'Jane', is_indexable: true, profession: 'Coach' },
        services: [{ title: 'Intro', price: 500 }],
      },
    });
    const m = await resolveProfileMeta('jane');
    expect(m.buildHtmlArgs.faqJsonLd['@type']).toBe('FAQPage');
    const questions = m.buildHtmlArgs.faqJsonLd.mainEntity.map((q) => q.name);
    expect(questions.some((q) => /how do i book jane/i.test(q))).toBe(true);
    expect(questions.some((q) => /payment secure/i.test(q))).toBe(true);
  });

  test('no aggregateRating when the host has zero reviews (never a platform default)', async () => {
    buildHostProfile.mockResolvedValueOnce({
      payload: { host: { username: 'jane', name: 'Jane', is_indexable: true }, services: [], reviews: [], avgRating: 0 },
    });
    const m = await resolveProfileMeta('jane');
    expect(m.buildHtmlArgs.jsonLd.mainEntity).not.toHaveProperty('aggregateRating');
  });

  test('robots is noindex,follow for a host with no bookable service', async () => {
    buildHostProfile.mockResolvedValueOnce({
      payload: { host: { username: 'empty', name: 'Empty', is_indexable: true }, services: [] },
    });
    const m = await resolveProfileMeta('empty');
    expect(m.buildHtmlArgs.robots).toBe('noindex,follow');
  });

  test('robots is noindex,nofollow when is_indexable is false', async () => {
    buildHostProfile.mockResolvedValueOnce({
      payload: { host: { username: 'jane', name: 'Jane', is_indexable: false }, services: [] },
    });
    const m = await resolveProfileMeta('jane');
    expect(m.buildHtmlArgs.robots).toBe('noindex,nofollow');
  });
});

describe('resolveServiceMeta', () => {
  test('returns 200 with title/canonical/robots for a normal service', async () => {
    buildPublicServiceByProfileAndSlug.mockResolvedValueOnce({
      payload: {
        service: { title: 'Intro Call', slug: 'intro', is_indexable: true },
        vendor: { username: 'jane', name: 'Jane' },
        reviews: [],
      },
    });
    const m = await resolveServiceMeta('jane', 'intro');
    expect(m.status).toBe(200);
    expect(m.buildHtmlArgs.title).toContain('Intro Call');
    expect(m.buildHtmlArgs.canonical).toBe('https://meeticulous.com/jane/intro');
    expect(m.buildHtmlArgs.robots).toBe('index,follow');
  });

  test('drops the brand suffix (then the host) so a long title is not truncated', async () => {
    buildPublicServiceByProfileAndSlug.mockResolvedValueOnce({
      payload: {
        service: { title: 'Marketing Automation Consultation', slug: 's', is_indexable: true },
        vendor: { username: 'mohinidaf', name: 'Mohini Daf' }, reviews: [],
      },
    });
    const mid = await resolveServiceMeta('mohinidaf', 's');
    expect(mid.buildHtmlArgs.title).toBe('Marketing Automation Consultation with Mohini Daf');
    expect(mid.buildHtmlArgs.title.length).toBeLessThanOrEqual(60);

    buildPublicServiceByProfileAndSlug.mockResolvedValueOnce({
      payload: {
        service: { title: 'SEO Consultancy – Expert Guidance to Boost Your Rankings', slug: 's', is_indexable: true },
        vendor: { username: 'aastha', name: 'Aastha Nikhare' }, reviews: [],
      },
    });
    const long = await resolveServiceMeta('aastha', 's');
    expect(long.buildHtmlArgs.title).toBe('SEO Consultancy – Expert Guidance to Boost Your Rankings');
  });

  test('returns 404 when host or service not found', async () => {
    buildPublicServiceByProfileAndSlug.mockResolvedValueOnce({ hostNotFound: true });
    expect((await resolveServiceMeta('ghost', 'intro')).status).toBe(404);
    buildPublicServiceByProfileAndSlug.mockResolvedValueOnce({ notFound: true });
    expect((await resolveServiceMeta('jane', 'ghost')).status).toBe(404);
  });

  test('robots is noindex,nofollow when is_indexable is false', async () => {
    buildPublicServiceByProfileAndSlug.mockResolvedValueOnce({
      payload: {
        service: { title: 'Intro Call', slug: 'intro', is_indexable: false },
        vendor: { username: 'jane', name: 'Jane' },
        reviews: [],
      },
    });
    const m = await resolveServiceMeta('jane', 'intro');
    expect(m.buildHtmlArgs.robots).toBe('noindex,nofollow');
  });

  test('emits a templated FAQPage when the host authored none (booking + payment + price)', async () => {
    buildPublicServiceByProfileAndSlug.mockResolvedValueOnce({
      payload: {
        service: { title: 'Intro Call', slug: 'intro', is_indexable: true, price: 500, duration: 30 },
        vendor: { username: 'jane', name: 'Jane' }, reviews: [],
      },
    });
    const m = await resolveServiceMeta('jane', 'intro');
    expect(m.buildHtmlArgs.faqJsonLd['@type']).toBe('FAQPage');
    const qs = m.buildHtmlArgs.faqJsonLd.mainEntity.map((q) => q.name);
    expect(qs.some((q) => /how do i book intro call/i.test(q))).toBe(true);
    expect(qs.some((q) => /how much does intro call cost/i.test(q))).toBe(true);
    expect(qs.some((q) => /payment secure/i.test(q))).toBe(true);
  });

  test('host-authored service.faqs win over the templated fallback', async () => {
    buildPublicServiceByProfileAndSlug.mockResolvedValueOnce({
      payload: {
        service: {
          title: 'Intro Call', slug: 'intro', is_indexable: true,
          faqs: [{ question: 'Do you record?', answer: 'Yes, on request.' }],
        },
        vendor: { username: 'jane', name: 'Jane' }, reviews: [],
      },
    });
    const m = await resolveServiceMeta('jane', 'intro');
    const qs = m.buildHtmlArgs.faqJsonLd.mainEntity.map((q) => q.name);
    expect(qs).toEqual(['Do you record?']);
  });
});

// Confirms the bot-handler behavior is unchanged after extracting the resolver:
// renderProfileMeta must still send full HTML containing the title, via res.send.
describe('renderProfileMeta (bot handler, unchanged behavior)', () => {
  test('sends HTML containing the title', async () => {
    buildHostProfile.mockResolvedValueOnce({
      payload: { host: { username: 'jane', name: 'Jane', is_indexable: true }, services: [] },
    });
    const res = { status: jest.fn().mockReturnThis(), set: jest.fn(), send: jest.fn(), redirect: jest.fn() };
    await renderProfileMeta({ params: { username: 'jane' } }, res);
    expect(res.send).toHaveBeenCalledTimes(1);
    expect(res.send.mock.calls[0][0]).toContain('Jane');
    expect(res.set).toHaveBeenCalledWith('Content-Type', 'text/html');
  });
});

// The shell now ships a REAL body (headings + service list + visible FAQ Q&A) instead
// of the old "Redirecting…" stub — this is what lifts the AEO answer-structure score.
describe('rendered body carries extractable answer content', () => {
  test('host shell body has h1, a service list and visible FAQ answers', async () => {
    buildHostProfile.mockResolvedValueOnce({
      payload: {
        host: { username: 'jane', name: 'Jane', is_indexable: true, profession: 'Coach', bio: 'I help founders.' },
        services: [{ title: 'Intro Call', slug: 'intro', price: 500, short_description: 'A quick chat.' }],
      },
    });
    const res = { status: jest.fn().mockReturnThis(), set: jest.fn(), send: jest.fn(), redirect: jest.fn() };
    await renderProfileMeta({ params: { username: 'jane' } }, res);
    const html = res.send.mock.calls[0][0];
    expect(html).toContain('<h1>Jane</h1>');
    expect(html).toContain('/jane/intro');            // internal crosslink
    expect(html).toContain('Frequently asked questions');
    expect(html).toMatch(/pay securely online/i);      // a real FAQ answer, not just the question
    expect(html).not.toContain('Redirecting to');      // stub is gone
  });

  test('service shell body has h1, included list and visible FAQ answers', async () => {
    buildPublicServiceByProfileAndSlug.mockResolvedValueOnce({
      payload: {
        service: {
          title: 'Intro Call', slug: 'intro', is_indexable: true, price: 500, duration: 30,
          short_description: 'A quick chat.', included_items: ['Notes', 'Recording'],
        },
        vendor: { username: 'jane', name: 'Jane' }, reviews: [],
      },
    });
    const res = { status: jest.fn().mockReturnThis(), set: jest.fn(), send: jest.fn(), redirect: jest.fn() };
    await renderServiceMeta({ params: { username: 'jane', serviceSlug: 'intro' } }, res);
    const html = res.send.mock.calls[0][0];
    expect(html).toContain('<h1>Intro Call</h1>');
    expect(html).toContain("What's included");
    expect(html).toContain('Recording');
    expect(html).toMatch(/how long is intro call/i);   // templated FAQ question rendered
    expect(html).not.toContain('Redirecting to');
  });
});

import { describe, test, expect } from 'vitest';
import {
  profileMeta, serviceDescription, profileTabMeta, productMeta, courseMeta, firstSentence, fitDescription,
  tierAnchors, catalogRobots, productPath, coursePath,
  productGraphJsonLd, courseGraphJsonLd, profileTabGraphJsonLd, membershipGraphJsonLd, profileGraphJsonLd, serviceGraphJsonLd,
} from '../seo';
import { catalogFaqs } from '../profileFaqs';

const SITE = 'https://meeticulous.com';
const UUID = '3f2b8c1e-9d4a-4e6b-8f1a-2c3d4e5f6a7b';
const HOST = {
  name: 'Shubham Datarkar', username: 'sndatarkar', profession: 'SEO consultant', location: 'Nagpur, Maharashtra',
  bio: 'I help Indian founders rank on Google and in AI answers. Ten years of SEO work.', is_verified: true,
  social_links: { linkedin: 'https://www.linkedin.com/in/sndatarkar', email: 'x@y.z' },
};
const SERVICES = [
  { title: 'SEO Consultation', slug: 'seo-consultation', price: 499, duration: 30, meeting_mode: 'online' },
  { title: 'Full SEO audit', slug: 'seo-audit', price: 4999, duration: 60, meeting_mode: 'online' },
];
const PRODUCTS = [
  { id: UUID, slug: 'seo-checklist', title: 'SEO checklist', price: 299, type: 'pdf', description: 'A 40-point audit list you can run monthly. Covers technical, content and links.' },
  { id: 'p2', slug: 'keyword-template', title: 'Keyword template', price: 0, type: 'template' },
];
const COURSE = {
  id: UUID, slug: 'seo-101', title: 'SEO 101', price: 1999, lesson_count: 3,
  description: 'Learn SEO from scratch, from keywords to links. Built for solo founders.',
  course_lessons: [{ title: 'Keywords' }, { title: 'On-page' }, { title: 'Links' }],
};
const TIERS = [
  { id: 't1', name: 'Insider', type: 'paid', price_inr: 199, perks: ['Weekly teardown', 'Templates'] },
  { id: 't2', name: 'Free', type: 'free', perks: [] },
];
const inWindow = (d) => { expect(d.length).toBeGreaterThanOrEqual(140); expect(d.length).toBeLessThanOrEqual(160); };
const allUrls = (ld) => JSON.stringify(ld).match(/https:\/\/meeticulous\.com[^"]*/g) || [];

describe('meta templates — titles ≤ 60, descriptions 140–160 from real data', () => {
  test('profile: "{Name} — {Profession} in {City} | Meeticulous", answer-first description', () => {
    const m = profileMeta({ host: HOST, services: SERVICES });
    expect(m.title).toBe('Shubham Datarkar — SEO consultant in Nagpur | Meeticulous');
    expect(m.description).toMatch(/^Shubham Datarkar is an SEO consultant in Nagpur\. 2 services from ₹499\. I help Indian founders/);
    expect(m.description).toMatch(/Book online\.$/);
    inWindow(m.description);
  });

  test('profile: rating clause ONLY with real reviews', () => {
    expect(profileMeta({ host: HOST, services: SERVICES }).description).not.toMatch(/★|review/);
    expect(profileMeta({ host: HOST, services: SERVICES, rating: { avg: 0, count: 0 } }).description).not.toMatch(/★/);
    expect(profileMeta({ host: HOST, services: SERVICES, rating: { avg: 4.5, count: 0 } }).description).not.toMatch(/★/);
    const rated = profileMeta({ host: HOST, services: SERVICES, rating: { avg: 4.8, count: 12 } }).description;
    expect(rated).toContain('2 services from ₹499 · 4.8★ (12 reviews).');
    inWindow(rated);
  });

  test('profile: drops missing parts, trims to fit, never cuts a long name', () => {
    expect(profileMeta({ host: { name: 'Jane' } }).title).toBe('Jane | Meeticulous');
    expect(profileMeta({ host: { name: 'Jane', location: 'WFH' } }).title).toBe('Jane | Meeticulous');
    const long = profileMeta({ host: { name: 'Dr. Venkataraghavan Subramanian', profession: 'Paediatric endocrinologist', location: 'Hyderabad' } });
    expect(long.title.length).toBeLessThanOrEqual(60);
    expect(long.title.startsWith('Dr. Venkataraghavan Subramanian')).toBe(true);
    const huge = 'N'.repeat(70);
    expect(profileMeta({ host: { name: huge } }).title).toBe(huge);
  });

  test('service: "Book a {duration}-min {mode} {service} with {Name} for ₹{price}."', () => {
    const d = serviceDescription({ service: { ...SERVICES[0], short_description: 'A focused 1:1 call. We fix your top three issues.' }, vendor: HOST });
    expect(d).toMatch(/^Book a 30-min online SEO Consultation with Shubham Datarkar for ₹499\. A focused 1:1 call\./);
    inWindow(d);
    expect(serviceDescription({ service: { title: 'Physio', duration: 45, meeting_mode: 'offline', price: 0 }, vendor: { name: 'Riya' } }))
      .toMatch(/^Book a 45-min in-person Physio with Riya for free\./);
    expect(serviceDescription({ service: { title: 'Audit', price_on_request: true }, vendor: { name: 'A' } })).not.toMatch(/₹/);
  });

  test('tabs: "Digital products by {Name} ({N})" / "Online courses by …" / "{Program} — membership by {Name}"', () => {
    const p = profileTabMeta({ tab: 'products', host: HOST, items: PRODUCTS });
    expect(p.title).toBe('Digital products by Shubham Datarkar (2)');
    expect(p.description).toMatch(/^2 digital products by Shubham Datarkar, from ₹299\. Includes SEO checklist, Keyword template\./);
    expect(p.description).toMatch(/Instant download/);
    inWindow(p.description);
    const c = profileTabMeta({ tab: 'courses', host: HOST, items: [COURSE] });
    expect(c.title).toBe('Online courses by Shubham Datarkar (1)');
    expect(c.description).toMatch(/lifetime access/);
    inWindow(c.description);
    const m = profileTabMeta({ tab: 'membership', host: HOST, items: TIERS, program: { name: 'Rank Club', blurb: 'Weekly SEO teardowns.' } });
    expect(m.title).toBe('Rank Club — membership by Shubham Datarkar');
    expect(m.description).toMatch(/from ₹199\/month/);
    expect(m.description).toMatch(/Cancel anytime\.$/);
    inWindow(m.description);
  });

  test('product + course templates', () => {
    const p = productMeta({ product: PRODUCTS[0], host: HOST });
    expect(p.title).toBe('SEO checklist — PDF by Shubham Datarkar');
    expect(p.description).toMatch(/^PDF by Shubham Datarkar\. A 40-point audit list/);
    expect(p.description).toMatch(/₹299, instant download\.$/);
    inWindow(p.description);
    const c = courseMeta({ course: COURSE, host: HOST });
    expect(c.title).toBe('SEO 101 — course by Shubham Datarkar');
    expect(c.description).toMatch(/^3 video lessons by Shubham Datarkar\./);
    expect(c.description).toMatch(/₹1,999, lifetime access\.$/);
    inWindow(c.description);
    // No hours claimed: lessons carry no duration.
    expect(c.description).not.toMatch(/hrs|hours/);
  });

  test('titles never exceed 60 when a shorter candidate exists', () => {
    const long = 'Ultimate keyword research and content brief template pack';
    expect(productMeta({ product: { title: long, type: 'template', price: 1 }, host: HOST }).title).toBe(long);
    expect(courseMeta({ course: { title: 'Short', price: 1 }, host: { name: 'A'.repeat(50) } }).title.length).toBeLessThanOrEqual(60);
  });

  test('helpers: firstSentence + fitDescription clip host text at a word boundary', () => {
    expect(firstSentence('Hello there. More.')).toBe('Hello there.');
    expect(firstSentence('No full stop')).toBe('No full stop.');
    expect(firstSentence('')).toBe('');
    const d = fitDescription({ head: ['Head.'], flex: 'word '.repeat(80), tail: 'Tail.' });
    expect(d.length).toBeLessThanOrEqual(160);
    expect(d).toMatch(/…/);
    expect(d).toMatch(/Tail\.$/);
  });
});

describe('URLs are slug-only — never a UUID', () => {
  test('paths', () => {
    expect(productPath('jane', 'checklist')).toBe('/jane/products/checklist');
    expect(coursePath('jane', 'seo-101')).toBe('/jane/courses/seo-101');
  });

  test('no UUID anywhere in any catalog graph', () => {
    const graphs = [
      productGraphJsonLd({ product: { ...PRODUCTS[0], profiles: HOST }, username: 'sndatarkar', siteUrl: SITE }),
      courseGraphJsonLd({ course: { ...COURSE, profiles: HOST }, username: 'sndatarkar', siteUrl: SITE }),
      profileTabGraphJsonLd({ tab: 'products', host: HOST, items: [...PRODUCTS, { id: UUID, title: 'No slug' }], siteUrl: SITE }),
      profileTabGraphJsonLd({ tab: 'courses', host: HOST, items: [COURSE], siteUrl: SITE }),
      membershipGraphJsonLd({ host: HOST, program: { name: 'Rank Club' }, tiers: TIERS, siteUrl: SITE }),
    ];
    for (const g of graphs) {
      expect(JSON.stringify(g)).not.toContain(UUID);
      for (const u of allUrls(g)) expect(u).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/i);
    }
  });
});

describe('catalog graphs — schema.org required fields, one entity per page', () => {
  const types = (ld) => ld['@graph'].map((n) => n['@type']);
  const node = (ld, t) => ld['@graph'].find((n) => n['@type'] === t);

  test('product: Product + Offer (price, INR, availability, url, seller → Person); breadcrumb Home › Name › Products › Item', () => {
    const ld = productGraphJsonLd({ product: { ...PRODUCTS[0], profiles: HOST }, username: 'sndatarkar', siteUrl: SITE });
    const p = node(ld, 'Product');
    expect(p.name).toBe('SEO checklist');
    expect(p.offers).toMatchObject({ '@type': 'Offer', price: '299', priceCurrency: 'INR', availability: 'https://schema.org/InStock', url: `${SITE}/sndatarkar/products/seo-checklist`, seller: { '@id': `${SITE}/sndatarkar#person` } });
    expect(node(ld, 'BreadcrumbList').itemListElement.map((i) => i.name)).toEqual(['Home', 'Shubham Datarkar', 'Products', 'SEO checklist']);
    expect(node(ld, 'Person')).toMatchObject({ '@id': `${SITE}/sndatarkar#person`, sameAs: ['https://www.linkedin.com/in/sndatarkar'] });
    expect(new Set(types(ld)).size).toBe(types(ld).length);
    expect(types(ld)).not.toContain('FAQPage');
    expect(JSON.stringify(ld)).not.toContain('aggregateRating');
  });

  test('course: Course + CourseInstance (online) + Offer with category; FAQPage only when passed', () => {
    const faqs = catalogFaqs({ kind: 'course', host: HOST, item: COURSE });
    const ld = courseGraphJsonLd({ course: { ...COURSE, profiles: HOST }, username: 'sndatarkar', siteUrl: SITE, faqs });
    const c = node(ld, 'Course');
    expect(c.description).toBeTruthy();
    expect(c.provider).toEqual({ '@id': `${SITE}/sndatarkar#person` });
    expect(c.hasCourseInstance).toEqual({ '@type': 'CourseInstance', courseMode: 'online' });
    expect(c.offers).toMatchObject({ category: 'Paid', price: '1999', priceCurrency: 'INR' });
    expect(node(ld, 'FAQPage').mainEntity).toHaveLength(faqs.length);
    expect(node(ld, 'BreadcrumbList').itemListElement.map((i) => i.name)).toEqual(['Home', 'Shubham Datarkar', 'Courses', 'SEO 101']);
  });

  test('tab: CollectionPage + ItemList of slug URLs (items without a slug skipped)', () => {
    const ld = profileTabGraphJsonLd({ tab: 'products', host: HOST, items: [...PRODUCTS, { id: 'x', title: 'No slug' }], siteUrl: SITE, name: 'T', description: 'D' });
    expect(node(ld, 'CollectionPage')).toMatchObject({ '@id': `${SITE}/sndatarkar/products`, name: 'T', description: 'D', about: { '@id': `${SITE}/sndatarkar#person` } });
    expect(node(ld, 'ItemList').itemListElement).toEqual([
      { '@type': 'ListItem', position: 1, url: `${SITE}/sndatarkar/products/seo-checklist`, name: 'SEO checklist' },
      { '@type': 'ListItem', position: 2, url: `${SITE}/sndatarkar/products/keyword-template`, name: 'Keyword template' },
    ]);
    expect(types(ld)).not.toContain('ProfilePage');
  });

  test('membership: one Product per tier, monthly UnitPriceSpecification on paid tiers, #tier anchors', () => {
    const ld = membershipGraphJsonLd({ host: HOST, program: { name: 'Rank Club' }, tiers: TIERS, siteUrl: SITE });
    const [paid, free] = node(ld, 'ItemList').itemListElement.map((li) => li.item);
    expect(paid['@type']).toBe('Product');
    expect(paid.url).toBe(`${SITE}/sndatarkar/membership#insider`);
    expect(paid.offers.priceSpecification).toEqual({ '@type': 'UnitPriceSpecification', price: '199', priceCurrency: 'INR', billingDuration: 'P1M', unitCode: 'MON' });
    expect(free.offers.price).toBe('0');
    expect(free.offers).not.toHaveProperty('priceSpecification');
  });

  test('tierAnchors are readable and unique', () => {
    expect(tierAnchors([{ name: 'Gold Tier' }, { name: 'Gold tier' }, { name: '' }])).toEqual(['gold-tier', 'gold-tier-2', 'tier']);
  });

  test('aggregateRating stays behind real reviews on profile + service graphs', () => {
    const none = profileGraphJsonLd({ host: HOST, services: SERVICES, siteUrl: SITE, rating: { avg: 4.9, count: 0 } });
    expect(JSON.stringify(none)).not.toContain('aggregateRating');
    const svc = serviceGraphJsonLd({ service: SERVICES[0], vendor: HOST, siteUrl: SITE, avgRating: 5, reviewCount: 0 });
    expect(JSON.stringify(svc)).not.toContain('aggregateRating');
  });
});

describe('catalogRobots', () => {
  test('follows the host listability; preview is noindex', () => {
    expect(catalogRobots({ is_verified: true })).toBe('index,follow');
    expect(catalogRobots({ is_verified: false })).toBe('noindex,follow');
    expect(catalogRobots({ is_verified: true, is_indexable: false })).toBe('noindex,nofollow');
    expect(catalogRobots({ is_verified: true }, true)).toBe('noindex');
  });
});

describe('catalogFaqs — 3–4 questions, real data only, no invented policy', () => {
  test.each([
    ['products', { kind: 'products', host: HOST, items: PRODUCTS }],
    ['courses', { kind: 'courses', host: HOST, items: [COURSE] }],
    ['membership', { kind: 'membership', host: HOST, items: TIERS, program: { name: 'Rank Club' } }],
    ['product', { kind: 'product', host: HOST, item: PRODUCTS[0] }],
    ['course', { kind: 'course', host: HOST, item: COURSE }],
  ])('%s', (_k, input) => {
    const faqs = catalogFaqs(input);
    expect(faqs.length).toBeGreaterThanOrEqual(3);
    expect(faqs.length).toBeLessThanOrEqual(4);
    for (const f of faqs) { expect(f.q).toBeTruthy(); expect(f.a).toBeTruthy(); }
    expect(JSON.stringify(faqs)).not.toMatch(/refund/i);
  });

  test('"Can I cancel?" only for a membership with a paid tier', () => {
    expect(catalogFaqs({ kind: 'membership', host: HOST, items: TIERS }).map((f) => f.q)).toContain('Can I cancel?');
    expect(catalogFaqs({ kind: 'membership', host: HOST, items: [TIERS[1]] }).map((f) => f.q)).not.toContain('Can I cancel?');
  });
});

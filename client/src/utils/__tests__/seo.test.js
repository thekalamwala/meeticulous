import { describe, test, expect } from 'vitest';
import { resolveServiceSeo, resolveProfileSeo, resolveBlogSeo, serviceJsonLd, profileJsonLd, articleGraphJsonLd, professionGraphJsonLd, comparisonGraphJsonLd, toolAppJsonLd, definedTermSetJsonLd, glossaryTermJsonLd, cityForSeo } from '../seo';

const SITE = 'https://meeticulous.com';
const VENDOR = { name: 'John Doe', username: 'john-doe', profile_image: 'https://img/john.jpg' };

describe('resolveServiceSeo — admin overrides win, fallbacks otherwise', () => {
  const base = { title: 'Business Consultation', slug: 'business-consultation', short_description: 'A 1:1 call.' };

  test('falls back to service title + vendor + brand suffix when no seo_title', () => {
    const seo = resolveServiceSeo({ service: base, vendor: VENDOR, siteUrl: SITE });
    expect(seo.title).toBe('Business Consultation with John Doe | Meeticulous');
    expect(seo.description).toBe('A 1:1 call.');
  });

  test('drops the brand suffix (then the host) so the title is not truncated', () => {
    // Full form overflows 60 → drop " | Meeticulous", keep service + host.
    const mid = resolveServiceSeo({ service: { ...base, title: 'Marketing Automation Consultation' }, vendor: { name: 'Mohini Daf' }, siteUrl: SITE });
    expect(mid.title).toBe('Marketing Automation Consultation with Mohini Daf');
    expect(mid.title.length).toBeLessThanOrEqual(60);
    // Even "service with host" overflows → drop the host too, keep the service title.
    const long = resolveServiceSeo({ service: { ...base, title: 'SEO Consultancy – Expert Guidance to Boost Your Rankings' }, vendor: { name: 'Aastha Nikhare' }, siteUrl: SITE });
    expect(long.title).toBe('SEO Consultancy – Expert Guidance to Boost Your Rankings');
    // A short title keeps the full branded form (unchanged behaviour).
    const short = resolveServiceSeo({ service: base, vendor: VENDOR, siteUrl: SITE });
    expect(short.title).toBe('Business Consultation with John Doe | Meeticulous');
  });

  test('uses admin seo_title / seo_description verbatim when set', () => {
    const seo = resolveServiceSeo({
      service: { ...base, seo_title: 'Hire a Top Consultant', seo_description: 'Custom meta.' },
      vendor: VENDOR, siteUrl: SITE,
    });
    expect(seo.title).toBe('Hire a Top Consultant');
    expect(seo.description).toBe('Custom meta.');
  });

  test('canonical is the CURRENT username + slug, always absolute', () => {
    const seo = resolveServiceSeo({ service: base, vendor: VENDOR, siteUrl: SITE });
    expect(seo.canonical).toBe('https://meeticulous.com/john-doe/business-consultation');
  });

  test('robots reflects is_indexable; default (undefined) is indexable', () => {
    expect(resolveServiceSeo({ service: base, vendor: VENDOR, siteUrl: SITE }).robots).toBe('index,follow');
    expect(resolveServiceSeo({ service: { ...base, is_indexable: false }, vendor: VENDOR, siteUrl: SITE }).robots)
      .toBe('noindex,nofollow');
  });

  test('og image falls back og_image -> seo_image -> thumbnail -> default card', () => {
    // generated per-service card (v3.154) wins over everything below it
    expect(resolveServiceSeo({ service: { ...base, og_image: 'https://img/og.png', seo_image: 'https://img/seo.jpg', thumbnail_url: 'https://img/t.jpg' }, vendor: VENDOR, siteUrl: SITE }).image)
      .toBe('https://img/og.png');
    expect(resolveServiceSeo({ service: { ...base, seo_image: 'https://img/seo.jpg' }, vendor: VENDOR, siteUrl: SITE }).image)
      .toBe('https://img/seo.jpg');
    expect(resolveServiceSeo({ service: { ...base, thumbnail_url: 'https://img/t.jpg' }, vendor: VENDOR, siteUrl: SITE }).image)
      .toBe('https://img/t.jpg');
    expect(resolveServiceSeo({ service: base, vendor: VENDOR, siteUrl: SITE }).image)
      .toBe('https://meeticulous.com/service-og-default.png');
  });

  test('description is truncated to ~160 chars', () => {
    const long = 'x'.repeat(300);
    const seo = resolveServiceSeo({ service: { ...base, short_description: long }, vendor: VENDOR, siteUrl: SITE });
    expect(seo.description.length).toBeLessThanOrEqual(160);
  });

  test('OFFLINE service gets the host city in the title; ONLINE does not', () => {
    const vendor = { name: 'Riya', location: 'Nagpur, Maharashtra' };
    const svc = { title: 'Physio Session', slug: 'physio' };
    const offline = resolveServiceSeo({ service: { ...svc, meeting_mode: 'offline' }, vendor, siteUrl: SITE });
    expect(offline.title).toBe('Physio Session in Nagpur with Riya | Meeticulous');
    const online = resolveServiceSeo({ service: { ...svc, meeting_mode: 'online' }, vendor, siteUrl: SITE });
    expect(online.title).toBe('Physio Session with Riya | Meeticulous');
    expect(online.title).not.toMatch(/Nagpur/);
  });

  test('offline service with no usable host city falls back to no-city title', () => {
    const seo = resolveServiceSeo({ service: { title: 'Consult', slug: 'c', meeting_mode: 'offline' }, vendor: { name: 'Amit', location: 'WFH' }, siteUrl: SITE });
    expect(seo.title).toBe('Consult with Amit | Meeticulous');
  });
});

describe('resolveProfileSeo', () => {
  const host = { name: 'John Doe', username: 'john-doe', profession: 'Consultant', bio: 'I help founders.' };

  test('builds title from name + profession when no override', () => {
    expect(resolveProfileSeo({ host, siteUrl: SITE }).title).toBe('John Doe — Consultant | Meeticulous');
  });
  test('canonical is the profile root URL', () => {
    expect(resolveProfileSeo({ host, siteUrl: SITE }).canonical).toBe('https://meeticulous.com/john-doe');
  });
  test('index only when the host has a bookable service', () => {
    expect(resolveProfileSeo({ host, services: [{ title: 'Intro' }], siteUrl: SITE }).robots).toBe('index,follow');
    expect(resolveProfileSeo({ host, services: [], siteUrl: SITE }).robots).toBe('noindex,follow');
  });
  test('noindex when host.is_indexable === false', () => {
    expect(resolveProfileSeo({ host: { ...host, is_indexable: false }, siteUrl: SITE }).robots).toBe('noindex,nofollow');
  });

  test('city in title only when the host offers an offline service', () => {
    const located = { ...host, location: 'Pune, Maharashtra' };
    const online = resolveProfileSeo({ host: located, services: [{ meeting_mode: 'online' }], siteUrl: SITE });
    expect(online.title).toBe('John Doe — Consultant | Meeticulous');
    const offline = resolveProfileSeo({ host: located, services: [{ meeting_mode: 'online' }, { meeting_mode: 'offline' }], siteUrl: SITE });
    expect(offline.title).toBe('John Doe — Consultant in Pune | Meeticulous');
  });
});

describe('cityForSeo — normalize free-text location for titles', () => {
  test('first comma-segment, title-cased', () => {
    expect(cityForSeo('Nagpur, Maharashtra')).toBe('Nagpur');
    expect(cityForSeo('NAGPUR, MH, IN')).toBe('Nagpur');
    expect(cityForSeo('pune')).toBe('Pune');
  });
  test('junk / blank / over-long -> null', () => {
    expect(cityForSeo('')).toBeNull();
    expect(cityForSeo(null)).toBeNull();
    expect(cityForSeo('WFH')).toBeNull();
    expect(cityForSeo('India')).toBeNull();
    expect(cityForSeo('x'.repeat(30))).toBeNull();
  });
});

describe('serviceJsonLd', () => {
  test('emits a Service schema with provider + INR offer + canonical url', () => {
    const ld = serviceJsonLd({
      service: { title: 'Business Consultation', slug: 'business-consultation', short_description: 'A call.', price: 500 },
      vendor: VENDOR, siteUrl: SITE,
    });
    expect(ld['@type']).toBe('Service');
    expect(ld.name).toBe('Business Consultation');
    expect(ld.provider).toMatchObject({ '@type': 'Person', name: 'John Doe' });
    expect(ld.offers).toMatchObject({ '@type': 'Offer', price: '500', priceCurrency: 'INR' });
    expect(ld.url).toBe('https://meeticulous.com/john-doe/business-consultation');
  });

  test('price_on_request omits the numeric price from the Offer (never leak the fee)', () => {
    const ld = serviceJsonLd({
      service: { title: 'Tax Filing', slug: 'tax-filing', price: 5000, price_on_request: true },
      vendor: VENDOR, siteUrl: SITE,
    });
    expect(ld.offers.price).toBeUndefined();
    expect(ld.offers).toMatchObject({ '@type': 'Offer', priceCurrency: 'INR' });
  });

  test('includes aggregateRating only when there are reviews', () => {
    const withReviews = serviceJsonLd({ service: { title: 'X', slug: 'x', price: 0 }, vendor: VENDOR, siteUrl: SITE, avgRating: 4.5, reviewCount: 12 });
    expect(withReviews.aggregateRating).toMatchObject({ '@type': 'AggregateRating', ratingValue: 4.5, reviewCount: 12 });
    const noReviews = serviceJsonLd({ service: { title: 'X', slug: 'x', price: 0 }, vendor: VENDOR, siteUrl: SITE, reviewCount: 0 });
    expect(noReviews.aggregateRating).toBeUndefined();
  });
});

describe('profileJsonLd', () => {
  test('emits a ProfilePage with a Person main entity', () => {
    const ld = profileJsonLd({ host: { name: 'John Doe', username: 'john-doe', profession: 'Consultant' }, siteUrl: SITE });
    expect(ld['@type']).toBe('ProfilePage');
    expect(ld.mainEntity).toMatchObject({ '@type': 'Person', name: 'John Doe', url: 'https://meeticulous.com/john-doe' });
  });
  test('adds publisher Organization, hasOccupation, and knowsAbout from profession + categories', () => {
    const ld = profileJsonLd({
      host: {
        name: 'John Doe', username: 'john-doe', profession: 'Startup Advisor',
        primary_category: 'startup-advisor', categories: ['startup-advisor', 'business_consultant'],
      },
      siteUrl: SITE,
    });
    expect(ld.publisher).toEqual({ '@type': 'Organization', name: 'Meeticulous', url: 'https://meeticulous.com' });
    expect(ld.mainEntity.hasOccupation).toEqual({
      '@type': 'Occupation', name: 'Startup Advisor', occupationalCategory: 'Startup Advisor',
    });
    // humanized + deduped (primary_category also appears in categories)
    expect(ld.mainEntity.knowsAbout).toEqual(['Startup Advisor', 'Business Consultant']);
  });
  test('omits hasOccupation / knowsAbout when profession + categories are absent', () => {
    const ld = profileJsonLd({ host: { name: 'J', username: 'j' }, siteUrl: SITE });
    expect(ld.mainEntity).not.toHaveProperty('hasOccupation');
    expect(ld.mainEntity).not.toHaveProperty('knowsAbout');
    expect(ld.publisher).toMatchObject({ '@type': 'Organization', name: 'Meeticulous' });
  });
  test('adds sameAs (http socials only) + dateModified when present', () => {
    const ld = profileJsonLd({
      host: {
        name: 'John Doe', username: 'john-doe', updated_at: '2026-09-01T10:00:00.000Z',
        social_links: { instagram: 'https://instagram.com/j', website: '', email: 'j@x.com', whatsapp: '9' },
      },
      siteUrl: SITE,
    });
    expect(ld.mainEntity.sameAs).toEqual(['https://instagram.com/j']);
    expect(ld.dateModified).toBe('2026-09-01T10:00:00.000Z');
  });
  test('omits sameAs / dateModified when socials blank and no updated_at', () => {
    const ld = profileJsonLd({ host: { name: 'J', username: 'j', social_links: {} }, siteUrl: SITE });
    expect(ld.mainEntity).not.toHaveProperty('sameAs');
    expect(ld).not.toHaveProperty('dateModified');
  });
  test('emits aggregateRating from the host own rating, omits it at zero', () => {
    const withRating = profileJsonLd({ host: { name: 'J', username: 'j' }, siteUrl: SITE, rating: { avg: 4.8, count: 12 } });
    expect(withRating.mainEntity.aggregateRating).toEqual({ '@type': 'AggregateRating', ratingValue: 4.8, reviewCount: 12 });
    const noRating = profileJsonLd({ host: { name: 'J', username: 'j' }, siteUrl: SITE, rating: { avg: 0, count: 0 } });
    expect(noRating.mainEntity).not.toHaveProperty('aggregateRating');
  });
});

describe('resolveBlogSeo — no truncated titles/descriptions', () => {
  test('appends the brand suffix only when the whole title fits 60 chars', () => {
    const short = resolveBlogSeo({ post: { title: 'The First Booking', slug: 'the-first-booking' } });
    expect(short.title).toBe('The First Booking | Meeticulous Blog');
    expect(short.title.length).toBeLessThanOrEqual(60);
    // A long headline keeps the article title and drops the suffix rather than truncating it.
    const long = resolveBlogSeo({ post: { title: 'Monthly plans, a WhatsApp code instead of a password, and reminders', slug: 'x' } });
    expect(long.title).not.toContain('| Meeticulous Blog');
    expect(long.title).toBe('Monthly plans, a WhatsApp code instead of a password, and reminders');
  });
  test('truncates a long excerpt to <=160 chars', () => {
    const { description } = resolveBlogSeo({ post: { title: 'X', slug: 'x', excerpt: 'y'.repeat(300) } });
    expect(description.length).toBeLessThanOrEqual(160);
    expect(description.endsWith('…')).toBe(true);
  });
  test('admin seo_title / seo_description win verbatim', () => {
    const r = resolveBlogSeo({ post: { title: 'X', slug: 'x', seo_title: 'Custom', seo_description: 'Custom desc' } });
    expect(r.title).toBe('Custom');
    expect(r.description).toBe('Custom desc');
  });
});

describe('articleGraphJsonLd — one @graph, real Person, stable @id relationships', () => {
  const base = {
    url: `${SITE}/blog/the-first-booking`,
    type: 'BlogPosting',
    headline: 'The First Booking',
    description: 'How the first booking happens.',
    image: 'https://cdn/card.jpg',
    imageWidth: 1200,
    imageHeight: 630,
    datePublished: '2026-07-06T00:00:00+05:30',
    dateModified: '2026-07-08T00:00:00+05:30',
    author: {
      name: 'Shubham N Datarkar',
      url: 'https://meeticulous.com/sndatarkar',
      jobTitle: 'Founder, Meeticulous',
      image: 'https://company-assets.meeticulous.in/images/about/shubham-datarkar.jpg',
      sameAs: ['https://x.com/sndatarkar', 'https://www.instagram.com/sndatarkar', 'https://shubhamdatarkar.com'],
    },
    breadcrumb: [
      { name: 'Home', path: '/' },
      { name: 'Blog', path: '/blog' },
      { name: 'The First Booking', path: '/blog/the-first-booking' },
    ],
  };
  const typesOf = (g) => g['@graph'].map((n) => n['@type']);

  test('returns a single @graph, one @context, and exactly one of each core node', () => {
    const g = articleGraphJsonLd({ siteUrl: SITE, ...base });
    expect(g['@context']).toBe('https://schema.org');
    expect(Array.isArray(g['@graph'])).toBe(true);
    const types = typesOf(g);
    for (const t of ['WebSite', 'Organization', 'WebPage', 'BlogPosting', 'Person', 'ImageObject', 'BreadcrumbList']) {
      expect(types.filter((x) => x === t)).toHaveLength(1);
    }
    // No FAQPage unless faqs are passed.
    expect(types).not.toContain('FAQPage');
  });

  test('author is a real Person; article references it by @id, never a placeholder org', () => {
    const g = articleGraphJsonLd({ siteUrl: SITE, ...base });
    const person = g['@graph'].find((n) => n['@type'] === 'Person');
    const article = g['@graph'].find((n) => n['@type'] === 'BlogPosting');
    expect(person).toMatchObject({
      name: 'Shubham N Datarkar',
      url: 'https://meeticulous.com/sndatarkar',
      jobTitle: 'Founder, Meeticulous',
      sameAs: ['https://x.com/sndatarkar', 'https://www.instagram.com/sndatarkar', 'https://shubhamdatarkar.com'],
    });
    expect(person['@id']).toBe('https://meeticulous.com/sndatarkar#author');
    expect(article.author).toEqual({ '@id': person['@id'] });
    expect(article.author['@type']).toBeUndefined(); // not an inline Organization
  });

  test('mainEntityOfPage points at the article WebPage, not the homepage', () => {
    const g = articleGraphJsonLd({ siteUrl: SITE, ...base });
    const webpage = g['@graph'].find((n) => n['@type'] === 'WebPage');
    const article = g['@graph'].find((n) => n['@type'] === 'BlogPosting');
    expect(webpage['@id']).toBe(`${base.url}#webpage`);
    expect(article.mainEntityOfPage).toEqual({ '@id': webpage['@id'] });
  });

  test('image is an ImageObject with url + width + height, referenced by @id', () => {
    const g = articleGraphJsonLd({ siteUrl: SITE, ...base });
    const img = g['@graph'].find((n) => n['@type'] === 'ImageObject' && n.url === 'https://cdn/card.jpg');
    expect(img).toMatchObject({ url: 'https://cdn/card.jpg', width: 1200, height: 630 });
    const article = g['@graph'].find((n) => n['@type'] === 'BlogPosting');
    expect(article.image).toEqual({ '@id': img['@id'] });
  });

  test('emits a FAQPage only when faqs are provided', () => {
    const withFaq = articleGraphJsonLd({ siteUrl: SITE, ...base, faqs: [{ q: 'Q', a: 'A' }] });
    const faq = withFaq['@graph'].find((n) => n['@type'] === 'FAQPage');
    expect(faq.mainEntity).toHaveLength(1);
    expect(faq.mainEntity[0].name).toBe('Q');
    expect(typesOf(articleGraphJsonLd({ siteUrl: SITE, ...base }))).not.toContain('FAQPage');
  });

  test('omits image width/height when not supplied (no invented dimensions)', () => {
    const g = articleGraphJsonLd({ siteUrl: SITE, ...base, imageWidth: undefined, imageHeight: undefined });
    const img = g['@graph'].find((n) => n['@type'] === 'ImageObject' && n.url === 'https://cdn/card.jpg');
    expect(img.width).toBeUndefined();
    expect(img.height).toBeUndefined();
  });

  test('falls back to the Organization as author when there is no byline (help docs)', () => {
    const g = articleGraphJsonLd({ siteUrl: SITE, url: `${SITE}/help/docs/x`, type: 'Article', headline: 'X', author: undefined });
    const types = g['@graph'].map((n) => n['@type']);
    expect(types).not.toContain('Person');
    const article = g['@graph'].find((n) => n['@type'] === 'Article');
    expect(article.author).toEqual({ '@id': `${SITE}/#organization` });
  });
});

describe('professionGraphJsonLd — one @graph for /for pages, HowTo + linked org', () => {
  const base = {
    canonical: `${SITE}/for/business-consultant`,
    name: 'Appointment Booking Software for Consultants | Meeticulous',
    description: 'Scheduling software for consultants.',
    breadcrumbName: 'For Business & Management Consultants',
    serviceType: 'Appointment booking software for business and management consultants',
    steps: [{ title: 'Set up', desc: 'Add services.' }, { title: 'Share', desc: 'Send your link.' }],
    faqs: [{ q: 'Is it for consultants?', a: 'Yes.' }, { q: 'Online?', a: 'Yes.' }],
    appOffers: [{ price: 0, name: 'Starter plan' }, { price: 3600, name: 'Pro plan (yearly)' }],
  };
  const typesOf = (g) => g['@graph'].map((n) => n['@type']);

  test('single @graph with one of each core node + HowTo + FAQPage', () => {
    const g = professionGraphJsonLd({ siteUrl: SITE, ...base });
    expect(g['@context']).toBe('https://schema.org');
    const types = typesOf(g);
    for (const t of ['WebSite', 'Organization', 'WebPage', 'SoftwareApplication', 'Service', 'HowTo', 'FAQPage', 'BreadcrumbList']) {
      expect(types.filter((x) => x === t)).toHaveLength(1);
    }
  });

  test('NO aggregateRating anywhere (a profession page has no reviews of its own)', () => {
    const g = professionGraphJsonLd({ siteUrl: SITE, ...base });
    expect(JSON.stringify(g)).not.toContain('aggregateRating');
  });

  test('Organization omits sameAs while no company socials exist; Service + SoftwareApplication reference it by @id', () => {
    const g = professionGraphJsonLd({ siteUrl: SITE, ...base });
    const org = g['@graph'].find((n) => n['@type'] === 'Organization');
    const svc = g['@graph'].find((n) => n['@type'] === 'Service');
    const app = g['@graph'].find((n) => n['@type'] === 'SoftwareApplication');
    expect(org.sameAs).toBeUndefined(); // ORG_SAME_AS is empty until the accounts launch
    expect(svc.provider).toEqual({ '@id': org['@id'] });
    expect(app.publisher).toEqual({ '@id': org['@id'] });
  });

  test('HowTo steps map from the passed steps, in order', () => {
    const g = professionGraphJsonLd({ siteUrl: SITE, ...base });
    const howto = g['@graph'].find((n) => n['@type'] === 'HowTo');
    expect(howto.step).toHaveLength(2);
    expect(howto.step[0]).toMatchObject({ '@type': 'HowToStep', position: 1, name: 'Set up', text: 'Add services.' });
  });

  test('offers come through as INR Offers with the passed names', () => {
    const g = professionGraphJsonLd({ siteUrl: SITE, ...base });
    const app = g['@graph'].find((n) => n['@type'] === 'SoftwareApplication');
    expect(app.offers).toHaveLength(2);
    expect(app.offers[0]).toMatchObject({ '@type': 'Offer', price: '0', priceCurrency: 'INR', name: 'Starter plan' });
  });

  test('omits HowTo / FAQPage when no steps / faqs are passed', () => {
    const g = professionGraphJsonLd({ siteUrl: SITE, ...base, steps: [], faqs: [] });
    const types = typesOf(g);
    expect(types).not.toContain('HowTo');
    expect(types).not.toContain('FAQPage');
  });
});

describe('comparisonGraphJsonLd — one @graph for /lp competitor pages', () => {
  const base = {
    canonical: 'https://meeticulous.com/compare/setmore-alternative',
    name: 'The Best Setmore Alternative for Indian Professionals — Meeticulous',
    description: 'UPI payments, WhatsApp reminders, GST invoices, built for India.',
    breadcrumbName: 'Setmore Alternative',
    faqs: [{ q: 'Does it support UPI?', a: 'Yes.' }, { q: 'Free to start?', a: 'Yes.' }],
  };
  const typesOf = (g) => g['@graph'].map((n) => n['@type']);

  test('single @graph: WebSite, Organization, WebPage, SoftwareApplication, FAQPage, BreadcrumbList', () => {
    const g = comparisonGraphJsonLd({ siteUrl: SITE, ...base });
    expect(g['@context']).toBe('https://schema.org');
    const types = typesOf(g);
    for (const t of ['WebSite', 'Organization', 'WebPage', 'SoftwareApplication', 'FAQPage', 'BreadcrumbList']) {
      expect(types.filter((x) => x === t)).toHaveLength(1);
    }
  });

  test('NO aggregateRating (platform rating lives only on the homepage node)', () => {
    const g = comparisonGraphJsonLd({ siteUrl: SITE, ...base });
    expect(JSON.stringify(g)).not.toContain('aggregateRating');
  });

  test('FAQ questions map from the passed faqs', () => {
    const g = comparisonGraphJsonLd({ siteUrl: SITE, ...base });
    const faq = g['@graph'].find((n) => n['@type'] === 'FAQPage');
    expect(faq.mainEntity).toHaveLength(2);
    expect(faq.mainEntity[0]).toMatchObject({ '@type': 'Question', name: 'Does it support UPI?' });
    expect(faq.mainEntity[0].acceptedAnswer).toMatchObject({ '@type': 'Answer', text: 'Yes.' });
  });

  test('omits FAQPage when no faqs are passed (e.g. the Calendly page)', () => {
    const g = comparisonGraphJsonLd({ siteUrl: SITE, ...base, faqs: [] });
    expect(typesOf(g)).not.toContain('FAQPage');
  });

  test('breadcrumb trails Home → Compare → the page', () => {
    const g = comparisonGraphJsonLd({ siteUrl: SITE, ...base });
    const bc = g['@graph'].find((n) => n['@type'] === 'BreadcrumbList');
    expect(bc.itemListElement.map((i) => i.name)).toEqual(['Home', 'Compare', 'Setmore Alternative']);
    expect(bc.itemListElement[2].item).toBe(base.canonical);
  });

  test('SoftwareApplication references Organization by @id and carries a free INR Offer', () => {
    const g = comparisonGraphJsonLd({ siteUrl: SITE, ...base });
    const org = g['@graph'].find((n) => n['@type'] === 'Organization');
    const app = g['@graph'].find((n) => n['@type'] === 'SoftwareApplication');
    expect(app.publisher).toEqual({ '@id': org['@id'] });
    expect(app.offers).toMatchObject({ '@type': 'Offer', price: '0', priceCurrency: 'INR' });
  });
});

describe('toolAppJsonLd — one @graph for /tools calculator pages', () => {
  const base = {
    canonical: 'https://meeticulous.com/tools/no-show-cost-calculator',
    name: 'No-Show Cost Calculator',
    description: 'What no-shows cost you a year.',
    breadcrumbName: 'No-Show Cost Calculator',
    faqs: [{ q: 'Is it free?', a: 'Yes.' }],
  };
  const typesOf = (g) => g['@graph'].map((n) => n['@type']);

  test('single @graph: WebSite, Organization, WebPage, WebApplication, FAQPage, BreadcrumbList', () => {
    const g = toolAppJsonLd({ siteUrl: SITE, ...base });
    for (const t of ['WebSite', 'Organization', 'WebPage', 'WebApplication', 'FAQPage', 'BreadcrumbList']) {
      expect(typesOf(g).filter((x) => x === t)).toHaveLength(1);
    }
  });

  test('WebApplication is free + accessible-for-free, publisher = org, NO aggregateRating', () => {
    const g = toolAppJsonLd({ siteUrl: SITE, ...base });
    const org = g['@graph'].find((n) => n['@type'] === 'Organization');
    const app = g['@graph'].find((n) => n['@type'] === 'WebApplication');
    expect(app.isAccessibleForFree).toBe(true);
    expect(app.offers).toMatchObject({ price: '0', priceCurrency: 'INR' });
    expect(app.publisher).toEqual({ '@id': org['@id'] });
    expect(JSON.stringify(g)).not.toContain('aggregateRating');
  });

  test('breadcrumb trails Home → Tools → the page; omits FAQPage without faqs', () => {
    const g = toolAppJsonLd({ siteUrl: SITE, ...base });
    const bc = g['@graph'].find((n) => n['@type'] === 'BreadcrumbList');
    expect(bc.itemListElement.map((i) => i.name)).toEqual(['Home', 'Tools', 'No-Show Cost Calculator']);
    const g2 = toolAppJsonLd({ siteUrl: SITE, ...base, faqs: [] });
    expect(typesOf(g2)).not.toContain('FAQPage');
  });
});

describe('definedTermSetJsonLd — glossary index', () => {
  const terms = [
    { slug: 'no-show', term: 'No-show', short: 'A client who never turns up.' },
    { slug: 'booking-page', term: 'Booking page', short: 'Where clients book you.' },
  ];

  test('DefinedTermSet with one DefinedTerm per entry, each linking to its term page', () => {
    const g = definedTermSetJsonLd({ siteUrl: SITE, url: '/glossary', name: 'Glossary', terms });
    expect(g['@type']).toBe('DefinedTermSet');
    expect(g['@id']).toBe('https://meeticulous.com/glossary#termset');
    expect(g.hasDefinedTerm).toHaveLength(2);
    expect(g.hasDefinedTerm[0]).toMatchObject({
      '@type': 'DefinedTerm', name: 'No-show', url: 'https://meeticulous.com/glossary/no-show',
      inDefinedTermSet: 'https://meeticulous.com/glossary#termset',
    });
  });
});

describe('glossaryTermJsonLd — single term page', () => {
  const base = { siteUrl: SITE, slug: 'no-show', term: 'No-show', definition: 'A client who books but never turns up.' };
  const typesOf = (g) => g['@graph'].map((n) => n['@type']);

  test('one @graph: WebSite, Organization, WebPage, DefinedTerm, BreadcrumbList', () => {
    const g = glossaryTermJsonLd(base);
    for (const t of ['WebSite', 'Organization', 'WebPage', 'DefinedTerm', 'BreadcrumbList']) {
      expect(typesOf(g).filter((x) => x === t)).toHaveLength(1);
    }
  });

  test('DefinedTerm carries the definition and sits in the glossary set; breadcrumb Home → Glossary → term', () => {
    const g = glossaryTermJsonLd(base);
    const term = g['@graph'].find((n) => n['@type'] === 'DefinedTerm');
    expect(term.name).toBe('No-show');
    expect(term.description).toBe(base.definition);
    expect(term.inDefinedTermSet['@id']).toBe('https://meeticulous.com/glossary#termset');
    const bc = g['@graph'].find((n) => n['@type'] === 'BreadcrumbList');
    expect(bc.itemListElement.map((i) => i.name)).toEqual(['Home', 'Glossary', 'No-show']);
  });
});

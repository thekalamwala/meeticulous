import { describe, test, expect } from 'vitest';
import * as seo from '../seo';
import { catalogFaqs, catalogSections, updatedLabel } from '../profileFaqs';
import fx from './__fixtures__/seoGraphParity.json';

const {
  profileGraphJsonLd, serviceGraphJsonLd, productGraphJsonLd, courseGraphJsonLd,
  profileTabGraphJsonLd, membershipGraphJsonLd,
} = seo;

// The committed fixture is generated from the CLIENT builders and is the shared
// source of truth for client/server parity: the server jest test
// (server/tests/unit/prerenderGraphParity.test.js) asserts buildProfileGraph /
// buildServiceGraph / the catalog graphs, the meta templates
// (services/seo/catalogSeo.js) and catalogFaqs (pageContentModel.js) produce the
// SAME output. If either path drifts, one of the two suites fails. Edit the
// builder, then update the fixture deliberately (both suites must still agree).
describe('host entity graph — client builders match the committed fixture', () => {
  test('profile graph', () => {
    expect(profileGraphJsonLd({ ...fx.profile, siteUrl: fx.site })).toEqual(fx.expectedProfileGraph);
  });
  test('service graph', () => {
    expect(serviceGraphJsonLd({ ...fx.service, siteUrl: fx.site })).toEqual(fx.expectedServiceGraph);
  });
  test('product graph', () => {
    expect(productGraphJsonLd({ ...fx.product, siteUrl: fx.site })).toEqual(fx.expectedProductGraph);
  });
  test('course graph', () => {
    expect(courseGraphJsonLd({ ...fx.course, siteUrl: fx.site })).toEqual(fx.expectedCourseGraph);
  });
  test('products + courses tab graphs', () => {
    expect(profileTabGraphJsonLd({ ...fx.productsTab, siteUrl: fx.site })).toEqual(fx.expectedProductsTabGraph);
    expect(profileTabGraphJsonLd({ ...fx.coursesTab, siteUrl: fx.site })).toEqual(fx.expectedCoursesTabGraph);
  });
  test('membership graph', () => {
    expect(membershipGraphJsonLd({ ...fx.membership, siteUrl: fx.site })).toEqual(fx.expectedMembershipGraph);
  });
});

describe('meta templates + catalog FAQ — client matches the committed fixture', () => {
  test.each(fx.metaCases.map((c, i) => [i, c]))('meta case %i', (_i, c) => {
    expect(seo[c.fn](c.input)).toEqual(c.expected);
  });
  test.each(fx.faqCases.map((c, i) => [i, c]))('faq case %i', (_i, c) => {
    expect(catalogFaqs(c.input)).toEqual(c.expected);
  });
  test.each(fx.sectionCases.map((c, i) => [i, c]))('section case %i', (_i, c) => {
    expect(catalogSections(c.input)).toEqual(c.expected);
  });
  test('updatedLabel cases', () => {
    for (const c of fx.updatedCases) expect(updatedLabel(c.ts)).toBe(c.expected);
  });
});

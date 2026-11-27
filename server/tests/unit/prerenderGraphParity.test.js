// server/tests/unit/prerenderGraphParity.test.js
// Client/server parity: the bot-shell graph builders, the meta templates
// (services/seo/catalogSeo.js) and catalogFaqs (services/seo/pageContentModel.js)
// must produce the SAME output the client produces. The fixture is generated
// from the client (see client/src/utils/__tests__/seoGraphParity.test.js) — this
// asserts the server mirror stays deep-equal to it. Drift on either path fails
// one of the two suites.
const fx = require('../../../client/src/utils/__tests__/__fixtures__/seoGraphParity.json');
const {
  buildProfileGraph, buildServiceGraph, buildProductGraph, buildCourseGraph,
  buildProfileTabGraph, buildMembershipGraph,
} = require('../../controllers/prerenderController');
const catalogSeo = require('../../services/seo/catalogSeo');
const { catalogFaqs } = require('../../services/seo/pageContentModel');

describe('prerender host entity graph — identical to the client', () => {
  test('profile graph matches the client fixture', () => {
    expect(buildProfileGraph({ ...fx.profile, site: fx.site })).toEqual(fx.expectedProfileGraph);
  });
  test('service graph matches the client fixture', () => {
    expect(buildServiceGraph({ ...fx.service, site: fx.site })).toEqual(fx.expectedServiceGraph);
  });
  test('product graph matches the client fixture', () => {
    expect(buildProductGraph({ ...fx.product, site: fx.site })).toEqual(fx.expectedProductGraph);
  });
  test('course graph matches the client fixture', () => {
    expect(buildCourseGraph({ ...fx.course, site: fx.site })).toEqual(fx.expectedCourseGraph);
  });
  test('products + courses tab graphs match the client fixture', () => {
    expect(buildProfileTabGraph({ ...fx.productsTab, site: fx.site })).toEqual(fx.expectedProductsTabGraph);
    expect(buildProfileTabGraph({ ...fx.coursesTab, site: fx.site })).toEqual(fx.expectedCoursesTabGraph);
  });
  test('membership graph matches the client fixture', () => {
    expect(buildMembershipGraph({ ...fx.membership, site: fx.site })).toEqual(fx.expectedMembershipGraph);
  });
});

describe('meta templates + catalog FAQ — identical to the client', () => {
  test.each(fx.metaCases.map((c, i) => [i, c]))('meta case %i', (_i, c) => {
    expect(catalogSeo[c.fn](c.input)).toEqual(c.expected);
  });
  test.each(fx.faqCases.map((c, i) => [i, c]))('faq case %i', (_i, c) => {
    expect(catalogFaqs(c.input)).toEqual(c.expected);
  });
});

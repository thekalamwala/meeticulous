import { describe, test, expect } from 'vitest';
import { profileGraphJsonLd, serviceGraphJsonLd, productGraphJsonLd } from '../seo';
import fx from './__fixtures__/seoGraphParity.json';

// The committed fixture is generated from the CLIENT builders and is the shared
// source of truth for client/server parity: the server jest test
// (server/tests/unit/prerenderGraphParity.test.js) asserts buildProfileGraph /
// buildServiceGraph produce the SAME objects. If either path drifts, one of the
// two suites fails. Regenerate with scripts? No — edit the builder, then update
// the fixture deliberately (both suites must still agree).
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
});

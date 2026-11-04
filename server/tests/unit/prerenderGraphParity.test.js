// server/tests/unit/prerenderGraphParity.test.js
// Client/server JSON-LD parity: the bot-shell graph builders
// (buildProfileGraph / buildServiceGraph) must emit the SAME @graph the client
// builders emit. The fixture is generated from the client (see
// client/src/utils/__tests__/seoGraphParity.test.js) — this asserts the server
// mirror stays deep-equal to it. Drift on either path fails one of the two suites.
const fx = require('../../../client/src/utils/__tests__/__fixtures__/seoGraphParity.json');
const { buildProfileGraph, buildServiceGraph } = require('../../controllers/prerenderController');

describe('prerender host entity graph — identical to the client', () => {
  test('profile graph matches the client fixture', () => {
    expect(buildProfileGraph({ ...fx.profile, site: fx.site })).toEqual(fx.expectedProfileGraph);
  });
  test('service graph matches the client fixture', () => {
    expect(buildServiceGraph({ ...fx.service, site: fx.site })).toEqual(fx.expectedServiceGraph);
  });
});

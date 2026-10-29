// server/tests/unit/gscClient.test.js
jest.mock('googleapis', () => ({
  google: {
    auth: { GoogleAuth: jest.fn().mockImplementation(() => ({})) },
    searchconsole: jest.fn(() => ({ mockSearchConsole: true })),
  },
}));

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  jest.resetModules();
  process.env = { ...ORIGINAL_ENV };
  delete process.env.GSC_SA_KEY;
  delete process.env.GSC_PROPERTY;
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

test('isConfigured is false when env vars are unset', () => {
  const gscClient = require('../../services/seo/gscClient');
  expect(gscClient.isConfigured()).toBe(false);
});

test('isConfigured is true when both env vars are set', () => {
  process.env.GSC_SA_KEY = JSON.stringify({ client_email: 'a@b.iam.gserviceaccount.com', private_key: 'x' });
  process.env.GSC_PROPERTY = 'sc-domain:bookasloth.com';
  const gscClient = require('../../services/seo/gscClient');
  expect(gscClient.isConfigured()).toBe(true);
});

test('getClient returns null when unconfigured', () => {
  const gscClient = require('../../services/seo/gscClient');
  expect(gscClient.getClient()).toBeNull();
});

test('getClient returns null (no throw) on malformed GSC_SA_KEY', () => {
  process.env.GSC_SA_KEY = 'not-json';
  process.env.GSC_PROPERTY = 'sc-domain:bookasloth.com';
  const gscClient = require('../../services/seo/gscClient');
  expect(() => gscClient.getClient()).not.toThrow();
  expect(gscClient.getClient()).toBeNull();
});

test('getClient returns a searchconsole client when configured', () => {
  process.env.GSC_SA_KEY = JSON.stringify({ client_email: 'a@b.iam.gserviceaccount.com', private_key: 'x' });
  process.env.GSC_PROPERTY = 'sc-domain:bookasloth.com';
  const gscClient = require('../../services/seo/gscClient');
  expect(gscClient.getClient()).toEqual({ mockSearchConsole: true });
});

test('siteUrl returns GSC_PROPERTY', () => {
  process.env.GSC_PROPERTY = 'sc-domain:bookasloth.com';
  const gscClient = require('../../services/seo/gscClient');
  expect(gscClient.siteUrl()).toBe('sc-domain:bookasloth.com');
});

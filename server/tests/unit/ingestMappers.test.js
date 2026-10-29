'use strict';
const { mapPayload, PROVIDERS } = require('../../services/crm/ingest/mappers');

describe('meta mapper', () => {
  const payload = {
    leadgen_id: 'lg_123', campaign_name: 'Diwali', ad_id: 'ad_9',
    field_data: [
      { name: 'full_name', values: ['Asha Rao'] },
      { name: 'email', values: ['asha@x.com'] },
      { name: 'phone_number', values: ['+919876543210'] },
      { name: 'city', values: ['Pune'] },
    ],
  };
  test('maps field_data + attribution + external id', () => {
    const r = mapPayload('meta', payload);
    expect(r.patch).toMatchObject({ name: 'Asha Rao', email: 'asha@x.com', phone: '+919876543210', city: 'Pune' });
    expect(r.externalId).toBe('lg_123');
    expect(r.source).toBe('meta');
    expect(r.attribution).toMatchObject({ utm_source: 'facebook', utm_medium: 'paid_social', utm_campaign: 'Diwali', utm_content: 'ad_9' });
    expect(r.usable).toBe(true);
  });
});

describe('zoho mapper', () => {
  test('composes name, maps fields + lead source', () => {
    const r = mapPayload('zoho', { id: 'z1', First_Name: 'Ravi', Last_Name: 'K', Email: 'r@x.com', Company: 'RK Co', Lead_Source: 'Webinar' });
    expect(r.patch).toMatchObject({ name: 'Ravi K', email: 'r@x.com', business_name: 'RK Co' });
    expect(r.externalId).toBe('z1');
    expect(r.attribution).toEqual({ utm_source: 'Webinar' });
  });
});

describe('form mapper', () => {
  test('passes through flat fields + forwards utm', () => {
    const r = mapPayload('form', { name: 'Sam', email: 'sam@x.com', company: 'Acme', utm_source: 'google', utm_campaign: 'search', source: 'partner' });
    expect(r.patch).toMatchObject({ name: 'Sam', email: 'sam@x.com', business_name: 'Acme' });
    expect(r.source).toBe('partner');
    expect(r.attribution).toMatchObject({ utm_source: 'google', utm_campaign: 'search' });
  });
});

test('unusable when no identity fields', () => {
  expect(mapPayload('form', { utm_source: 'google' }).usable).toBe(false);
});

test('unknown provider throws', () => {
  expect(() => mapPayload('salesforce', {})).toThrow(/unknown ingest provider/);
});

test('PROVIDERS list', () => {
  expect(PROVIDERS.sort()).toEqual(['form', 'meta', 'zoho']);
});

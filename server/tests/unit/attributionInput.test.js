'use strict';
const {
  cleanAttribution, touchSnapshot, stripAttributionColumns, isMissingColumnError,
} = require('../../services/crm/attributionInput');

describe('cleanAttribution', () => {
  test('maps utm_* and bare keys, caps + trims, keeps referrer/landing', () => {
    expect(cleanAttribution({ utm_source: ' google ', medium: 'cpc', campaign: 'launch', referrer: 'https://x', landing: '/p?a=1' }))
      .toEqual({
        utm_source: 'google', utm_medium: 'cpc', utm_campaign: 'launch',
        utm_content: null, utm_term: null, fbclid: null, gclid: null,
        referrer: 'https://x', landing_page: '/p?a=1',
      });
  });
  test('captures raw click ids; a click id alone counts as a touch', () => {
    const out = cleanAttribution({ fbclid: 'abc123' });
    expect(out).not.toBeNull();
    expect(out.fbclid).toBe('abc123');
  });
  test('null when nothing usable', () => {
    expect(cleanAttribution({})).toBeNull();
    expect(cleanAttribution({ foo: 'bar' })).toBeNull();
    expect(cleanAttribution(null)).toBeNull();
  });
  test('referrer/landing alone (no utm) still counts as a touch', () => {
    expect(cleanAttribution({ referrer: 'https://ref' })).not.toBeNull();
  });
});

test('touchSnapshot adds a timestamp', () => {
  expect(touchSnapshot({ utm_source: 'g' }, '2026-01-01')).toEqual({ utm_source: 'g', at: '2026-01-01' });
});

test('stripAttributionColumns removes every attribution field, keeps the rest', () => {
  const row = { name: 'A', utm_source: 'g', fbclid: 'f', gclid: 'g', first_touch: {}, last_touch: {}, referrer: 'x', landing_page: '/p', email: 'e' };
  expect(stripAttributionColumns(row)).toEqual({ name: 'A', email: 'e' });
});

describe('isMissingColumnError', () => {
  test('true for pg 42703 / PGRST204 / message forms', () => {
    expect(isMissingColumnError({ code: '42703' })).toBe(true);
    expect(isMissingColumnError({ code: 'PGRST204' })).toBe(true);
    expect(isMissingColumnError({ message: "column \"utm_source\" does not exist" })).toBe(true);
    expect(isMissingColumnError({ message: "Could not find the 'first_touch' column of 'leads'" })).toBe(true);
  });
  test('false otherwise', () => {
    expect(isMissingColumnError(null)).toBe(false);
    expect(isMissingColumnError({ code: '23505' })).toBe(false);
  });
});

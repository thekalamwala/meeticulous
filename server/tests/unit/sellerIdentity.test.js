'use strict';
const { seller, SERIES, SAC_SUBSCRIPTION, SAC_BOOKING } = require('../../config/sellerIdentity');

describe('sellerIdentity', () => {
  test('GSTIN state code matches Odisha (21)', () => {
    expect(seller.gstin).toBe('21AAMCT8270C1ZF');
    expect(seller.stateCode).toBe('21');
    expect(seller.gstin.slice(0, 2)).toBe(seller.stateCode);
  });
  test('PAN is embedded in the GSTIN', () => {
    expect(seller.gstin).toContain(seller.pan);
  });
  test('series prefixes stay within the 16-char invoice-number budget', () => {
    for (const s of Object.values(SERIES)) {
      const sample = `${s.prefix}/26/00001`;
      expect(sample.length).toBeLessThanOrEqual(16);
    }
  });
  test('SAC codes are non-empty strings', () => {
    expect(typeof SAC_SUBSCRIPTION).toBe('string');
    expect(SAC_BOOKING.length).toBeGreaterThan(0);
  });
});

// client/src/data/moments.test.js
import { describe, it, expect } from 'vitest';
import { MOMENTS, FEATURED, getMoment } from './moments';

describe('moments data', () => {
  it('has at least one moment', () => {
    expect(MOMENTS.length).toBeGreaterThan(0);
  });

  it('has unique slugs', () => {
    const slugs = MOMENTS.map((m) => m.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('every moment has required fields', () => {
    for (const m of MOMENTS) {
      expect(typeof m.slug).toBe('string');
      expect(m.slug).toMatch(/^[a-z0-9-]+$/);
      expect(m.title).toBeTruthy();
      expect(m.date).toBeTruthy();
      expect(m.image).toBeTruthy();
      expect(Array.isArray(m.body)).toBe(true);
    }
  });

  it('FEATURED is the first moment', () => {
    expect(FEATURED).toBe(MOMENTS[0]);
  });

  it('getMoment resolves real slugs and returns undefined for bogus', () => {
    expect(getMoment(MOMENTS[0].slug)).toBe(MOMENTS[0]);
    expect(getMoment('nope-not-real')).toBeUndefined();
  });
});

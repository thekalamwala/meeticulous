import { describe, test, expect } from 'vitest';
import { profileFaqs } from '../profileFaqs';

describe('profileFaqs', () => {
  test('always includes a booking + payment question', () => {
    const faqs = profileFaqs({ host: { name: 'Jane' }, services: [] });
    expect(faqs.some((f) => /how do i book jane/i.test(f.q))).toBe(true);
    expect(faqs.some((f) => /payment secure/i.test(f.q))).toBe(true);
    faqs.forEach((f) => { expect(f.q).toBeTruthy(); expect(f.a).toBeTruthy(); });
  });

  test('quotes the lowest real price when services are priced', () => {
    const faqs = profileFaqs({ host: { name: 'Jane' }, services: [{ price: 900 }, { price: 500 }, { price: 0 }] });
    const priceQ = faqs.find((f) => /how much/i.test(f.q));
    expect(priceQ.a).toContain('₹500');
  });

  test('adds a profession question only when profession is set', () => {
    const withProf = profileFaqs({ host: { name: 'Jane', profession: 'Therapist', location: 'Pune' }, services: [] });
    expect(withProf.find((f) => /what does jane do/i.test(f.q)).a).toContain('Therapist based in Pune');
    const noProf = profileFaqs({ host: { name: 'Jane' }, services: [] });
    expect(noProf.some((f) => /what does jane do/i.test(f.q))).toBe(false);
  });
});

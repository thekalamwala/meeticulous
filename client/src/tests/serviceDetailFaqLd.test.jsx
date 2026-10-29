import { faqJsonLd } from '../utils/seo';
import { describe, test, expect } from 'vitest';

describe('faqJsonLd', () => {
  test('maps service.faqs {question,answer} → FAQPage entities', () => {
    const faqs = [
      { question: 'How long?', answer: 'About two weeks.' },
      { question: 'Refunds?', answer: 'Case by case.' },
    ];
    const ld = faqJsonLd({ faqs: faqs.map(f => ({ q: f.question, a: f.answer })) });
    expect(ld['@type']).toBe('FAQPage');
    expect(ld.mainEntity).toHaveLength(2);
    expect(ld.mainEntity[0].name).toBe('How long?');
    expect(ld.mainEntity[0].acceptedAnswer.text).toBe('About two weeks.');
  });

  test('empty faqs → empty mainEntity', () => {
    expect(faqJsonLd({ faqs: [] }).mainEntity).toHaveLength(0);
  });
});

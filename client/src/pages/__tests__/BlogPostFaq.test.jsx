import { describe, it, expect } from 'vitest';
import { faqsFrom } from '../BlogPost';
import { faqJsonLd } from '../../utils/seo';

// faqsFrom is the single source for both the visible Q&A and the FAQPage JSON-LD.
// Emitting structured data for questions a reader can't see is a manual action,
// so the pairing of "block exists" -> "JSON-LD exists" is the thing to guard.
describe('faqsFrom', () => {
  it('pulls q/a pairs out of faq blocks', () => {
    const body = [
      { p: 'intro' },
      { faq: [{ q: 'Do you take commission?', a: 'No.' }] },
    ];
    expect(faqsFrom(body)).toEqual([{ q: 'Do you take commission?', a: 'No.' }]);
  });

  it('flattens multiple faq blocks in document order', () => {
    const body = [
      { faq: [{ q: 'A', a: '1' }] },
      { h2: 'More' },
      { faq: [{ q: 'B', a: '2' }, { q: 'C', a: '3' }] },
    ];
    expect(faqsFrom(body).map((f) => f.q)).toEqual(['A', 'B', 'C']);
  });

  it('returns nothing for a post with no faq block, so no FAQPage is emitted', () => {
    expect(faqsFrom([{ p: 'just prose' }, { h2: 'heading' }])).toEqual([]);
  });

  it('survives the shapes a jsonb body can actually arrive in', () => {
    expect(faqsFrom(null)).toEqual([]);
    expect(faqsFrom(undefined)).toEqual([]);
    expect(faqsFrom([])).toEqual([]);
    expect(faqsFrom('not an array')).toEqual([]);
    expect(faqsFrom([null, { faq: null }, { faq: 'nope' }])).toEqual([]);
  });

  it('drops half-written entries rather than emitting an empty Question', () => {
    const body = [{ faq: [{ q: 'Has answer', a: 'yes' }, { q: 'No answer' }, { a: 'No question' }] }];
    expect(faqsFrom(body)).toEqual([{ q: 'Has answer', a: 'yes' }]);
  });

  it('feeds faqJsonLd a valid FAQPage', () => {
    const faqs = faqsFrom([{ faq: [{ q: 'Q1', a: 'A1' }] }]);
    const ld = faqJsonLd({ faqs });
    expect(ld['@type']).toBe('FAQPage');
    expect(ld.mainEntity).toHaveLength(1);
    expect(ld.mainEntity[0].name).toBe('Q1');
  });
});

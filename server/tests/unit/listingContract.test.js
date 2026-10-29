const { LISTING_TOOL, sanitizeListing } = require('../../services/ai/listingContract');

describe('LISTING_TOOL', () => {
  test('names the emit tool with required fields', () => {
    expect(LISTING_TOOL.name).toBe('emit_listing');
    expect(LISTING_TOOL.input_schema.properties.faqs).toBeDefined();
    expect(LISTING_TOOL.input_schema.properties.short_description).toBeDefined();
  });
});

describe('sanitizeListing', () => {
  test('clamps lengths and array counts', () => {
    const { fields } = sanitizeListing({
      title: 'x'.repeat(80),
      short_description: 'y'.repeat(200),
      important_note: 'z'.repeat(300),
      included_items: ['a','b','c','d','e','f','g'],
      faqs: Array.from({ length: 9 }, (_, i) => ({ question: `q${i}`, answer: `a${i}` })),
    }, {});
    expect(fields.title.length).toBeLessThanOrEqual(60);
    expect(fields.short_description.length).toBeLessThanOrEqual(160);
    expect(fields.important_note.length).toBeLessThanOrEqual(200);
    expect(fields.included_items).toHaveLength(6);
    expect(fields.faqs).toHaveLength(5);
  });

  test('keeps category only if allowed', () => {
    expect(sanitizeListing({ category: 'made-up' }, { allowedCategorySlugs: ['seo'] }).fields.category).toBeUndefined();
    expect(sanitizeListing({ category: 'seo' }, { allowedCategorySlugs: ['seo'] }).fields.category).toBe('seo');
  });

  test('strips fabricated-fact fields', () => {
    const { fields, dropped } = sanitizeListing({
      short_description: 'Only ₹499 with a money-back guarantee!',
      long_description: 'We are FDA certified and rated 5 stars.',
    }, {});
    expect(fields.short_description).toBe('');
    expect(fields.long_description).toBe('');
    expect(dropped).toEqual(expect.arrayContaining(['short_description', 'long_description']));
  });

  test('never throws on garbage input', () => {
    expect(() => sanitizeListing(null, {})).not.toThrow();
    expect(() => sanitizeListing({ faqs: 'not-an-array' }, {})).not.toThrow();
  });

  test('strips fabrication from included_items elements', () => {
    const { fields, dropped } = sanitizeListing({
      included_items: ['Lifetime access', 'Only ₹499!', 'FDA certified'],
      title: 'x',
      short_description: 'y',
      long_description: 'z',
      excluded_items: [],
      faqs: [],
    }, {});
    expect(fields.included_items).toEqual(['Lifetime access']);
    expect(dropped).toEqual(expect.arrayContaining(['included_items[1]', 'included_items[2]']));
  });

  test('strips fabrication from excluded_items elements', () => {
    const { fields, dropped } = sanitizeListing({
      excluded_items: ['No pets', 'Money-back guarantee', 'ISO certified'],
      title: 'x',
      short_description: 'y',
      long_description: 'z',
      included_items: [],
      faqs: [],
    }, {});
    expect(fields.excluded_items).toEqual(['No pets']);
    expect(dropped).toEqual(expect.arrayContaining(['excluded_items[1]', 'excluded_items[2]']));
  });

  test('drops FAQ if question contains fabrication signal', () => {
    const { fields, dropped } = sanitizeListing({
      faqs: [
        { question: 'Is this FDA approved?', answer: 'Yes, absolutely.' },
        { question: 'What is the price?', answer: 'Only ₹499!' },
      ],
      title: 'x',
      short_description: 'y',
      long_description: 'z',
      included_items: [],
      excluded_items: [],
    }, {});
    expect(fields.faqs).toHaveLength(0);
    expect(dropped).toEqual(expect.arrayContaining(['faq[0]_question', 'faq[1]_answer']));
  });

  test('keeps a valid duration_minutes, drops out-of-range / non-numeric', () => {
    expect(sanitizeListing({ duration_minutes: 45 }, {}).fields.duration_minutes).toBe(45);
    expect(sanitizeListing({ duration_minutes: 90.4 }, {}).fields.duration_minutes).toBe(90); // rounded
    expect(sanitizeListing({ duration_minutes: 4 }, {}).fields.duration_minutes).toBeUndefined();   // below 5
    expect(sanitizeListing({ duration_minutes: 999 }, {}).fields.duration_minutes).toBeUndefined();  // above 480
    expect(sanitizeListing({ duration_minutes: 'sixty' }, {}).fields.duration_minutes).toBeUndefined();
    expect(sanitizeListing({}, {}).fields.duration_minutes).toBeUndefined();                         // omitted
  });

  test('handles null options safely without throwing', () => {
    expect(() => sanitizeListing({ title: 'x', short_description: 'y', long_description: 'z', included_items: [], excluded_items: [], faqs: [] }, null)).not.toThrow();
    const { fields } = sanitizeListing({ title: 'Test', short_description: 'desc', long_description: 'long', included_items: ['a'], excluded_items: ['b'], faqs: [{ question: 'q', answer: 'a' }] }, null);
    expect(fields.title).toBe('Test');
  });
});

const { validateServiceCategory } = require('../lib/serviceCategory');

describe('validateServiceCategory', () => {
  // Active service-category slugs for the host's profession.
  const valid = ['wedding-photography', 'portrait-photography'];

  test('accepts a category in the profession list', () => {
    expect(validateServiceCategory({ category: 'wedding-photography', validSlugs: valid }))
      .toEqual({ ok: true, value: 'wedding-photography' });
  });

  test('rejects a category not in the profession list', () => {
    const r = validateServiceCategory({ category: 'root-canal', validSlugs: valid });
    expect(r.ok).toBe(false);
    expect(r.status).toBe(400);
  });

  test('required + list has entries + none given → 400', () => {
    const r = validateServiceCategory({ category: '', validSlugs: valid, required: true });
    expect(r.ok).toBe(false);
    expect(r.status).toBe(400);
  });

  test('not required + none given → ok with null (unchanged)', () => {
    expect(validateServiceCategory({ category: undefined, validSlugs: valid }))
      .toEqual({ ok: true, value: null });
  });

  test('profession has no service categories on record → drops value, ok null', () => {
    expect(validateServiceCategory({ category: 'anything', validSlugs: [], required: true }))
      .toEqual({ ok: true, value: null });
  });

  test('trims whitespace before matching', () => {
    expect(validateServiceCategory({ category: '  portrait-photography ', validSlugs: valid }))
      .toEqual({ ok: true, value: 'portrait-photography' });
  });
});

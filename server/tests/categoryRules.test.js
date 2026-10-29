const { validateCategorySelection } = require('../lib/categoryRules');

const ACTIVE = ['life-coach', 'business-coach', 'career-coach', 'ai-engineer'];

describe('validateCategorySelection', () => {
  it('accepts a single valid primary', () => {
    const r = validateCategorySelection({ primary_category: 'life-coach', categories: ['life-coach'], activeSlugs: ACTIVE, max: 1 });
    expect(r.ok).toBe(true);
    expect(r.primary_category).toBe('life-coach');
    expect(r.categories).toEqual(['life-coach']);
  });

  it('forces primary into the categories array', () => {
    const r = validateCategorySelection({ primary_category: 'ai-engineer', categories: [], activeSlugs: ACTIVE, max: 1 });
    expect(r.ok).toBe(true);
    expect(r.categories).toEqual(['ai-engineer']);
  });

  it('rejects when no primary is given', () => {
    const r = validateCategorySelection({ primary_category: null, categories: [], activeSlugs: ACTIVE, max: 1 });
    expect(r.ok).toBe(false);
    expect(r.status).toBe(400);
  });

  it('rejects an inactive/unknown slug', () => {
    const r = validateCategorySelection({ primary_category: 'life-coach', categories: ['life-coach', 'doctor'], activeSlugs: ACTIVE, max: 3 });
    expect(r.ok).toBe(false);
    expect(r.status).toBe(400);
  });

  it('rejects exceeding the plan cap', () => {
    const r = validateCategorySelection({ primary_category: 'life-coach', categories: ['life-coach', 'business-coach'], activeSlugs: ACTIVE, max: 1 });
    expect(r.ok).toBe(false);
    expect(r.status).toBe(403);
  });

  it('allows up to the cap and dedupes', () => {
    const r = validateCategorySelection({ primary_category: 'life-coach', categories: ['life-coach', 'life-coach', 'business-coach', 'career-coach'], activeSlugs: ACTIVE, max: 3 });
    expect(r.ok).toBe(true);
    expect(r.categories).toEqual(['life-coach', 'business-coach', 'career-coach']);
  });

  it('treats max=-1 as unlimited (admin override)', () => {
    const r = validateCategorySelection({ primary_category: 'life-coach', categories: ['life-coach', 'business-coach', 'career-coach', 'ai-engineer'], activeSlugs: ACTIVE, max: -1 });
    expect(r.ok).toBe(true);
    expect(r.categories.length).toBe(4);
  });
});

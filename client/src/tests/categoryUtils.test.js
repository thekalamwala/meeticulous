import { describe, it, expect } from 'vitest';
import { getCategoryRules, groupCategories, categoryLabel } from '../utils/categoryUtils';

describe('getCategoryRules', () => {
  it('locks free/starter/explorer', () => {
    expect(getCategoryRules('starter')).toEqual({ locked: true, max: 1 });
    expect(getCategoryRules('explorer')).toEqual({ locked: true, max: 1 });
    expect(getCategoryRules(undefined)).toEqual({ locked: true, max: 1 });
  });
  it('creator can manage 1', () => {
    expect(getCategoryRules('creator')).toEqual({ locked: false, max: 1 });
  });
  it('professional can manage 3', () => {
    expect(getCategoryRules('professional')).toEqual({ locked: false, max: 3 });
  });
});

describe('groupCategories', () => {
  it('groups by group_label preserving first-seen order', () => {
    const list = [
      { slug: 'a', label: 'A', group_label: 'G1' },
      { slug: 'b', label: 'B', group_label: 'G2' },
      { slug: 'c', label: 'C', group_label: 'G1' },
    ];
    const groups = groupCategories(list);
    expect(groups.map((g) => g.group)).toEqual(['G1', 'G2']);
    expect(groups[0].items.map((i) => i.slug)).toEqual(['a', 'c']);
  });
});

describe('categoryLabel', () => {
  const list = [{ slug: 'career-coach', label: 'Career Coach' }];
  it('returns the label from the list when present', () => {
    expect(categoryLabel('career-coach', list)).toBe('Career Coach');
  });
  it('prettifies the slug when not in the list', () => {
    expect(categoryLabel('life-coach', list)).toBe('Life Coach');
  });
  it('returns empty string for a falsy slug', () => {
    expect(categoryLabel('', list)).toBe('');
  });
});

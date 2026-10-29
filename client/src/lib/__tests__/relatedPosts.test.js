// client/src/lib/__tests__/relatedPosts.test.js
import { describe, it, expect } from 'vitest';
import { selectRelated } from '../relatedPosts';
import { BLOG_POSTS } from '../../data/blogPosts';
import { BLOG_CLUSTERS } from '../../data/blogClusters';

describe('selectRelated', () => {
  it('returns at most 3, never the current slug, no dupes', () => {
    for (const p of BLOG_POSTS) {
      const r = selectRelated(p.slug);
      expect(r.length).toBeLessThanOrEqual(3);
      expect(r).not.toContain(p.slug);
      expect(new Set(r).size).toBe(r.length);
    }
  });

  it('puts the primary cluster pillar first for a spoke', () => {
    expect(selectRelated('the-arithmetic-of-commission')[0]).toBe('zero-commission-bet');
  });

  it('does not self-link when the post is its own pillar', () => {
    const r = selectRelated('zero-commission-bet');
    expect(r).not.toContain('zero-commission-bet');
    expect(r.length).toBeGreaterThan(0);
  });

  it('honors priorityLinks ordering', () => {
    const r = selectRelated('the-arithmetic-of-commission');
    expect(r).toContain('the-first-host-who-paid');
  });

  it('returns [] for an unknown slug', () => {
    expect(selectRelated('does-not-exist')).toEqual([]);
  });

  it('leaves no published post an internal-link orphan', () => {
    const incoming = new Map(BLOG_POSTS.map((p) => [p.slug, 0]));
    for (const p of BLOG_POSTS) for (const s of selectRelated(p.slug)) incoming.set(s, (incoming.get(s) || 0) + 1);
    const orphans = [...incoming].filter(([, n]) => n === 0).map(([s]) => s);
    expect(orphans).toEqual([]);
  });
});

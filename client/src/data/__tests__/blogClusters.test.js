// client/src/data/__tests__/blogClusters.test.js
import { describe, it, expect } from 'vitest';
import { POST_TAGS, BLOG_CLUSTERS } from '../blogClusters';
import { BLOG_POSTS } from '../blogPosts';

const slugs = new Set(BLOG_POSTS.map((p) => p.slug));

describe('blog clusters taxonomy', () => {
  it('every published post has a non-empty tag list', () => {
    const missing = BLOG_POSTS.filter((p) => !(POST_TAGS[p.slug] && POST_TAGS[p.slug].length));
    expect(missing.map((p) => p.slug)).toEqual([]);
  });

  it('POST_TAGS has no unknown slugs', () => {
    expect(Object.keys(POST_TAGS).filter((s) => !slugs.has(s))).toEqual([]);
  });

  it('every cluster pillar is a real post', () => {
    expect(BLOG_CLUSTERS.filter((c) => !slugs.has(c.pillar)).map((c) => c.pillar)).toEqual([]);
  });

  it('every cluster tag is used by at least one post', () => {
    const used = new Set(Object.values(POST_TAGS).flat());
    const dead = BLOG_CLUSTERS.flatMap((c) => c.tags).filter((t) => !used.has(t));
    expect(dead).toEqual([]);
  });

  it('every priorityLink slug is real', () => {
    const bad = BLOG_CLUSTERS.flatMap((c) => c.priorityLinks || []).filter((s) => !slugs.has(s));
    expect(bad).toEqual([]);
  });
});

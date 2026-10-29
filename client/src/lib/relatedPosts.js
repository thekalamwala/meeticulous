// client/src/lib/relatedPosts.js
// Pure cluster-aware related-post selector. Reads the static BLOG_POSTS +
// taxonomy (POST_TAGS/BLOG_CLUSTERS). No fetch, no side effects — so it is
// prerender-safe and the orphan test can run it over every post.
import { BLOG_POSTS } from '../data/blogPosts';
import { POST_TAGS, BLOG_CLUSTERS } from '../data/blogClusters';

const RELATED_COUNT = 3;
const BY_SLUG = new Map(BLOG_POSTS.map((p) => [p.slug, p]));

const tagsOf = (slug) => POST_TAGS[slug] || [];
const overlap = (a, b) => a.filter((t) => b.includes(t)).length;
const timeOf = (slug) => {
  const p = BY_SLUG.get(slug);
  const t = p ? new Date(p.date).getTime() : 0;
  return Number.isFinite(t) ? t : 0;
};

// Clusters a post belongs to, best match first:
// tag-overlap desc → priority desc → registry order.
function clustersFor(slug) {
  const tags = tagsOf(slug);
  return BLOG_CLUSTERS
    .map((c, i) => ({ c, i, ov: overlap(tags, c.tags) }))
    .filter((x) => x.ov > 0)
    .sort((a, b) => b.ov - a.ov || (b.c.priority || 0) - (a.c.priority || 0) || a.i - b.i)
    .map((x) => x.c);
}

export function selectRelated(slug) {
  const self = BY_SLUG.get(slug);
  if (!self) return [];
  const tags = tagsOf(slug);
  const primary = clustersFor(slug)[0] || null;

  const picks = [];
  const seen = new Set([slug]);
  const add = (s) => {
    if (s && !seen.has(s) && BY_SLUG.has(s) && picks.length < RELATED_COUNT) {
      seen.add(s);
      picks.push(s);
    }
  };

  // Slot 1: primary cluster's pillar (unless this post IS that pillar).
  if (primary && primary.pillar !== slug) add(primary.pillar);

  // Siblings: share >=1 tag; priorityLinks first, then overlap desc, newest tiebreak.
  const pri = primary ? (primary.priorityLinks || []) : [];
  const rank = (s) => (pri.indexOf(s) === -1 ? Infinity : pri.indexOf(s));
  BLOG_POSTS
    .map((p) => p.slug)
    .filter((s) => !seen.has(s) && overlap(tags, tagsOf(s)) > 0)
    .sort((a, b) =>
      (rank(a) - rank(b)) ||
      (overlap(tags, tagsOf(b)) - overlap(tags, tagsOf(a))) ||
      (timeOf(b) - timeOf(a)))
    .forEach(add);

  // Fallback so the block is never thin: same category newest, then newest overall.
  if (picks.length < RELATED_COUNT) {
    const byNew = BLOG_POSTS.slice().sort((a, b) => timeOf(b.slug) - timeOf(a.slug));
    byNew.filter((p) => p.category === self.category).forEach((p) => add(p.slug));
    byNew.forEach((p) => add(p.slug));
  }

  return picks;
}

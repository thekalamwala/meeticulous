// client/src/components/blog/RelatedPosts.jsx
// Cluster-aware "Related reading" block shown at the foot of every post.
// Static (no fetch) → prerendered into the post HTML → the internal links are
// crawlable. Card style matches the former "Keep reading" block it replaces.
import { Link } from 'react-router-dom';
import { BLOG_POSTS, themeFor } from '../../data/blogPosts';
import { selectRelated } from '../../lib/relatedPosts';

const HEAD_TX = '#F5F5F7';
const BY_SLUG = new Map(BLOG_POSTS.map((p) => [p.slug, p]));

export default function RelatedPosts({ slug }) {
  // Skip scheduled posts (future `date`): the API hides them until they go live,
  // so linking them early sends readers to a 404. The orphan test still counts
  // them as linked; they appear here from the first build after their date.
  const now = Date.now();
  const posts = selectRelated(slug).map((s) => BY_SLUG.get(s))
    .filter((p) => p && !(new Date(p.date).getTime() > now));
  if (posts.length === 0) return null;

  return (
    <div className="mt-14">
      <h2 className="text-lg font-bold tracking-tight" style={{ color: HEAD_TX }}>Related reading</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        {posts.map((p) => {
          const pt = themeFor(p.category);
          return (
            <Link key={p.slug} to={`/blog/${p.slug}`}
              className="group rounded-xl border p-4 transition-colors hover:no-underline"
              style={{ borderColor: 'rgba(255,255,255,0.10)', backgroundColor: 'rgba(255,255,255,0.02)' }}>
              <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: pt.accent }}>{p.category}</span>
              <h3 className="mt-1 font-heading text-base font-bold tracking-tight" style={{ color: HEAD_TX }}>{p.title}</h3>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

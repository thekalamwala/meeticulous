import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { themeFor } from '../data/blogPosts';
import { getBlogs } from '../services/api';
import Seo from "../components/common/Seo";
import { ogCard } from "../config/ogImages";
import { SITE_URL, collectionPageJsonLd, breadcrumbJsonLd } from "../utils/seo";
import BlogHeroThumbnail from '../components/blog/BlogHeroThumbnail';

// /blog — index of posts. Content now lives in the `blogs` table and is served
// by GET /api/blogs (see server/controllers/blogController.js). Presentation
// (category colours via themeFor) still comes from src/data/blogPosts.js.
// Card art reuses the same visual the post hero uses, so index and post agree.
//
// Paging is client-side: GET /api/blogs returns every post in one payload, so
// slicing here costs nothing and needs no API change. Revisit if the post count
// ever outgrows a single response.
// ponytail: 13 = 1 featured + 12 in the 2-col grid (6 rows).
const PER_PAGE = 13;

const Tag = ({ label }) => {
  const s = themeFor(label);
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
      style={{ backgroundColor: s.chipBg, color: s.chipFg }}
    >
      {label}
    </span>
  );
};

// Top corners of a card: category left, publish date right.
const Meta = ({ post }) => (
  <div className="flex items-center justify-between gap-3">
    <Tag label={post.category} />
    <time className="text-xs font-semibold uppercase tracking-wide text-gray-400">
      {post.date}
    </time>
  </div>
);

// Bottom corners of a card: byline left, CTA right. The CTA takes the post's
// category colour from --card-hov (set on the card <Link>). The byline is
// plain text, not an author link — a card is one big <Link>, and <a> inside
// <a> is invalid markup.
const CardFoot = ({ post }) => (
  <div className="mt-5 flex items-end justify-between gap-3">
    <span className="text-xs text-gray-400">
      by <span className="font-semibold text-gray-500">{post.author}</span>
    </span>
    <span className="inline-flex items-center gap-1.5 text-sm font-semibold [color:var(--card-hov)]">
      Read More
      <svg viewBox="0 0 24 24" className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M5 12h14M13 6l6 6-6 6" />
      </svg>
    </span>
  </div>
);

// Pager. Real <Link>s, not buttons — a page is a URL, so it stays
// middle-clickable, shareable and crawlable.
const PageLink = ({ to, disabled, children, label }) =>
  disabled ? (
    <span aria-disabled="true" className="rounded-lg px-3 py-2 text-sm font-semibold text-gray-300">
      {children}
    </span>
  ) : (
    <Link
      to={to}
      aria-label={label}
      className="rounded-lg px-3 py-2 text-sm font-semibold text-gray-600 transition-colors hover:bg-black/[0.04] hover:text-ink"
    >
      {children}
    </Link>
  );

const Pager = ({ page, totalPages }) => {
  if (totalPages <= 1) return null;
  const href = (n) => (n === 1 ? '/blog' : `/blog?page=${n}`);
  return (
    <nav aria-label="Blog pages" className="mt-10 flex items-center justify-center gap-1 sm:mt-12">
      <PageLink to={href(page - 1)} disabled={page === 1} label="Previous page">
        ← Prev
      </PageLink>
      {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
        <Link
          key={n}
          to={href(n)}
          aria-label={`Page ${n}`}
          aria-current={n === page ? 'page' : undefined}
          className={
            n === page
              ? 'rounded-lg bg-ink px-3.5 py-2 text-sm font-semibold text-white'
              : 'rounded-lg px-3.5 py-2 text-sm font-semibold text-gray-600 transition-colors hover:bg-black/[0.04] hover:text-ink'
          }
        >
          {n}
        </Link>
      ))}
      <PageLink to={href(page + 1)} disabled={page === totalPages} label="Next page">
        Next →
      </PageLink>
    </nav>
  );
};

// Card art: the post's own image if it has one, else the generated hero
// thumbnail (same component the post page uses — see BlogHeroThumbnail).
const CardVisual = ({ post, className, w, h }) => {
  const t = themeFor(post.category);
  return (
    <div className={`relative overflow-hidden ${className}`} style={{ backgroundColor: t.band }}>
      {post.image ? (
        <img src={post.image} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <BlogHeroThumbnail post={post} theme={t} w={w} h={h} />
      )}
    </div>
  );
};

const Blog = () => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const prev = document.title;
    document.title = 'Blog · Meeticulous';
    return () => { document.title = prev; };
  }, []);

  useEffect(() => {
    getBlogs()
      .then((res) => setPosts(res.data.posts || []))
      .catch(() => setPosts([]))
      .finally(() => setLoading(false));
  }, []);

  // Paging swaps the list in place, so without this page 2 opens halfway down.
  const pageParam = searchParams.get('page');
  useEffect(() => { window.scrollTo(0, 0); }, [pageParam]);

  // Page 1 is /blog; later pages are /blog?page=N. Junk or out-of-range values
  // clamp to a real page rather than rendering an empty list.
  const totalPages = Math.max(1, Math.ceil(posts.length / PER_PAGE));
  const page = Math.min(Math.max(1, parseInt(searchParams.get('page'), 10) || 1), totalPages);
  const [featured, ...rest] = posts.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const postItems = posts
    .filter((p) => p && p.slug && p.title)
    .map((p) => ({ name: p.title, url: `/blog/${p.slug}` }));

  return (
    <div className="app-container blog-page py-12 sm:py-16">
      <Seo
        title="Meeticulous Blog — Booking & Business Growth Tips"
        description="Guides on getting booked and paid, reducing no-shows, online payments, and growing your booking business. Practical tips from Meeticulous."
        image={ogCard('blog-index')}
        canonical={page === 1 ? `${SITE_URL}/blog` : `${SITE_URL}/blog?page=${page}`}
        jsonLd={[
          collectionPageJsonLd({
            name: 'Meeticulous Blog — Booking & Business Growth Tips',
            description: 'Guides on getting booked and paid, reducing no-shows, online payments, and growing your booking business. Practical tips from Meeticulous.',
            url: '/blog',
            items: postItems,
          }),
          breadcrumbJsonLd({ items: [{ name: 'Home', path: '/' }, { name: 'Blog', path: '/blog' }] }),
        ]}
      />
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <header className="text-center">
          <h1 className="font-heading text-3xl font-extrabold tracking-tight text-ink sm:text-5xl">
            The Meeticulous blog
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-gray-500 sm:text-base">
            Build logs, product thinking and engineering notes as we build a
            0% commission booking platform — in the open.
          </p>
        </header>

        {loading ? (
          <div className="mt-12 space-y-6 sm:mt-16">
            <div className="page-card h-40 animate-pulse bg-black/[0.03]" />
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="page-card h-32 animate-pulse bg-black/[0.03]" />
              <div className="page-card h-32 animate-pulse bg-black/[0.03]" />
            </div>
          </div>
        ) : posts.length === 0 ? (
          <p className="mt-16 text-center text-[15px] text-gray-500">
            No posts yet — check back soon. 🦥
          </p>
        ) : (
          <>
            {/* Featured post */}
            <Link
              to={`/blog/${featured.slug}`}
              style={{ '--card-hov': themeFor(featured.category).chipFg }}
              className="page-card group mt-12 grid overflow-hidden transition-shadow hover:shadow-md sm:mt-16 sm:grid-cols-2"
            >
              <CardVisual post={featured} w={600} h={440} className="h-44 sm:order-last sm:h-full sm:min-h-[16rem]" />
              <div className="flex flex-col p-6 sm:p-8">
                <Meta post={featured} />
                <h2 className="mt-3 font-heading text-2xl font-bold tracking-tight text-ink transition-colors duration-150 group-hover:[color:var(--card-hov)] sm:text-3xl">
                  {featured.title}
                </h2>
                <p className="mt-3 flex-1 text-[15px] leading-relaxed text-gray-600">
                  {featured.excerpt}
                </p>
                <CardFoot post={featured} />
              </div>
            </Link>

            {/* Rest of posts */}
            {rest.length > 0 && (
              <div className="mt-6 grid gap-6 sm:mt-8 sm:grid-cols-2">
                {rest.map((post) => (
                  <Link
                    key={post.slug}
                    to={`/blog/${post.slug}`}
                    style={{ '--card-hov': themeFor(post.category).chipFg }}
                    className="page-card group flex flex-col overflow-hidden transition-shadow hover:shadow-md"
                  >
                    <CardVisual post={post} w={600} h={240} className="h-36" />
                    <div className="flex flex-1 flex-col p-5 sm:p-6">
                      <Meta post={post} />
                      <h2 className="mt-2.5 font-heading text-lg font-bold tracking-tight text-ink transition-colors duration-150 group-hover:[color:var(--card-hov)] sm:text-xl">
                        {post.title}
                      </h2>
                      <p className="mt-2 flex-1 text-sm leading-relaxed text-gray-600">
                        {post.excerpt}
                      </p>
                      <CardFoot post={post} />
                    </div>
                  </Link>
                ))}
              </div>
            )}

            <Pager page={page} totalPages={totalPages} />
          </>
        )}

        {/* Footer CTA */}
        <div className="mt-12 rounded-2xl border border-black/5 bg-[#F8FAFC] px-6 py-10 text-center sm:mt-16">
          <h3 className="font-heading text-xl font-bold tracking-tight text-ink sm:text-2xl">
            Want this for your own bookings?
          </h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-gray-500">
            Set up your page, sync your calendar and start getting paid — at 0% commission.
          </p>
          <Link
            to="/be-a-sloth"
            className="btn mt-5 inline-flex items-center px-5 py-2.5 text-sm font-semibold text-white bg-primary hover:bg-[#005E99] transition-colors duration-150 shadow-sm hover:no-underline"
          >
            Become a host
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Blog;

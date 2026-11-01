import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { themeFor, AUTHOR_URL, AUTHOR } from '../data/blogPosts';
import { getBlogBySlug } from '../services/api';
import { isNotFoundError } from '../utils/fetchError';
import ErrorPage from './ErrorPage';
import Seo from '../components/common/Seo';
import { SITE_URL, resolveBlogSeo, articleGraphJsonLd } from '../utils/seo';
import BlogHeroThumbnail from '../components/blog/BlogHeroThumbnail';
import RelatedPosts from '../components/blog/RelatedPosts';
import PetalSpinner from '../components/common/PetalSpinner';
import { prerendered } from '../services/prerenderData';

// /blog/:slug — immersive post page. A split hero (left = category colour +
// text, right = image, hidden on mobile) over a dark reading body, finished
// with a share row and a bottom CTA band in the same category colour.
// Colour comes from the post category (see CATEGORY_THEME in data/blogPosts.js).
// Unknown slug → redirect to /blog index.

const BODY_BG = '#0E0E10';
const BODY_TX = '#DCDCE1';
const BODY_DIM = 'rgba(220,220,225,0.55)';
const HEAD_TX = '#F5F5F7';

// Band (hero / bottom) text colours derived from light/dark theme.
const bandText = (t) =>
  t.light
    ? { title: '#141416', soft: 'rgba(0,0,0,0.66)', faint: 'rgba(0,0,0,0.5)', rule: 'rgba(0,0,0,0.12)' }
    : { title: '#FFFFFF', soft: 'rgba(255,255,255,0.74)', faint: 'rgba(255,255,255,0.6)', rule: 'rgba(255,255,255,0.18)' };

// Right-hand hero visual: the post image, or a branded fallback panel.
const HeroVisual = ({ post, t }) => (
  <div className="relative hidden overflow-hidden lg:block" style={{ backgroundColor: t.band }}>
    {post.image ? (
      <img src={post.image} alt={post.title} className="absolute inset-0 h-full w-full object-cover" />
    ) : (
      <BlogHeroThumbnail post={post} theme={t} />
    )}
  </div>
);

// Inline rich-text: turn [label](href) into links. Internal hrefs ('/x') use
// the SPA router (no full reload); external ('http…') open in a new, safe tab.
// Anything without a link token passes straight through as plain text.
// ponytail: markdown-link only — no bold/italic parsing, which the copy doesn't need.
// Colour is per-category, so it stays inline; the underline-wipe and the
// +100 weight live in .blog-link (index.css) — a pseudo/background effect
// CSS has to own.
const linkStyle = (accent) => ({ color: accent });
const rich = (text, accent) => {
  if (typeof text !== 'string' || text.indexOf('](') === -1) return text;
  const re = /\[([^\]]+)\]\(([^)\s]+)\)/g;
  const out = [];
  let last = 0;
  let m;
  let k = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const [full, label, href] = m;
    const st = linkStyle(accent);
    out.push(
      href.startsWith('/')
        ? <Link key={k++} to={href} style={st} className="blog-link">{label}</Link>
        : <a key={k++} href={href} target="_blank" rel="noopener noreferrer" style={st} className="blog-link">{label}</a>,
    );
    last = m.index + full.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
};

// ── Body block renderer ─────────────────────────────────────────────
const Block = ({ block, accent }) => {
  if (block.h2) {
    return <h2 className="mt-12 text-xl font-bold tracking-tight sm:text-2xl" style={{ color: HEAD_TX }}>{block.h2}</h2>;
  }
  if (block.ul) {
    return (
      <ul className="mt-5 space-y-3">
        {block.ul.map((item, i) => (
          <li key={i} className="flex gap-3 text-[15px] leading-relaxed sm:text-base" style={{ color: BODY_TX }}>
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: accent }} />
            <span>{rich(item, accent)}</span>
          </li>
        ))}
      </ul>
    );
  }
  if (block.ol) {
    return (
      <ol className="mt-5 space-y-3">
        {block.ol.map((item, i) => (
          <li key={i} className="flex gap-3 text-[15px] leading-relaxed sm:text-base" style={{ color: BODY_TX }}>
            <span className="shrink-0 font-semibold tabular-nums" style={{ color: accent }}>{i + 1}.</span>
            <span>{rich(item, accent)}</span>
          </li>
        ))}
      </ol>
    );
  }
  if (block.steps) {
    return (
      <ol className="mt-6 space-y-4">
        {block.steps.map((item, i) => (
          <li key={i} className="flex gap-4 text-[15px] leading-relaxed sm:text-base" style={{ color: BODY_TX }}>
            <span className="shrink-0 pt-0.5 font-mono text-xs font-bold tabular-nums tracking-wider" style={{ color: accent }}>
              {String(i + 1).padStart(2, '0')}
            </span>
            <span>{rich(item, accent)}</span>
          </li>
        ))}
      </ol>
    );
  }
  if (block.quote) {
    return (
      <blockquote className="mt-10 border-l-2 pl-5" style={{ borderColor: accent }}>
        <p className="text-lg font-semibold leading-snug sm:text-xl" style={{ color: HEAD_TX }}>{block.quote}</p>
        {block.cite && <cite className="mt-1.5 block text-xs not-italic" style={{ color: accent }}>{block.cite}</cite>}
      </blockquote>
    );
  }
  if (block.table) {
    return (
      <div className="mt-8 overflow-x-auto rounded-xl border" style={{ borderColor: 'rgba(255,255,255,0.10)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}>
              {block.table.head.map((h, i) => (
                <th key={i} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: accent }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.table.rows.map((row, ri) => (
              <tr key={ri} style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                {row.map((cell, ci) => (
                  <td key={ci} className="px-4 py-3 leading-relaxed" style={{ color: ci === 0 ? HEAD_TX : BODY_TX }}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  if (block.info) {
    return (
      <div className="mt-8 rounded-xl border p-4 sm:p-5" style={{ borderColor: 'rgba(255,255,255,0.10)', backgroundColor: 'rgba(255,255,255,0.03)' }}>
        <div className="flex items-center gap-2">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke={accent} strokeWidth="2" aria-hidden="true">
            <circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 7.5h.01" strokeLinecap="round" />
          </svg>
          <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: HEAD_TX }}>{block.info.title}</span>
        </div>
        <p className="mt-2 text-sm leading-relaxed" style={{ color: BODY_DIM }}>{rich(block.info.text, accent)}</p>
      </div>
    );
  }
  // A visible Q&A list that doubles as the FAQPage JSON-LD source (see faqsFrom).
  // Native <details> gives us the disclosure behaviour for free, and keeps the
  // answer text in the DOM for crawlers even while collapsed.
  if (block.faq) {
    return (
      <div className="mt-10">
        <h2 className="text-xl font-bold tracking-tight sm:text-2xl" style={{ color: HEAD_TX }}>
          {block.faqTitle || 'Common questions'}
        </h2>
        {block.faq.map((item, i) => (
          <details key={i} className="mt-3 rounded-xl border p-4" style={{ borderColor: 'rgba(255,255,255,0.10)' }}>
            <summary className="cursor-pointer text-[15px] font-semibold" style={{ color: HEAD_TX }}>{item.q}</summary>
            <p className="mt-2 text-sm leading-relaxed" style={{ color: BODY_DIM }}>{rich(item.a, accent)}</p>
          </details>
        ))}
      </div>
    );
  }
  return <p className="mt-5 text-[15px] leading-relaxed sm:text-base" style={{ color: BODY_TX }}>{rich(block.p, accent)}</p>;
};

// Flatten every faq block in a post body into the {q,a} pairs faqJsonLd wants.
// One source: edit the block, and the visible list and the structured data move together.
export const faqsFrom = (body) =>
  (Array.isArray(body) ? body : [])
    .filter((b) => b && Array.isArray(b.faq))
    .flatMap((b) => b.faq)
    .filter((f) => f && f.q && f.a);

// ── Share row ───────────────────────────────────────────────────────
const ShareRow = ({ title }) => {
  const url = typeof window !== 'undefined' ? window.location.href : '';
  const enc = encodeURIComponent(url);
  const encT = encodeURIComponent(title);
  const links = [
    { label: 'Share on Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${enc}`,
      d: 'M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z' },
    { label: 'Share on X', href: `https://twitter.com/intent/tweet?url=${enc}&text=${encT}`,
      d: 'M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z' },
    { label: 'Share on Telegram', href: `https://t.me/share/url?url=${enc}&text=${encT}`,
      d: 'M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z' },
  ];
  const copy = () => {
    navigator.clipboard?.writeText(url).then(
      () => toast.success('Link copied'),
      () => toast.error('Couldn’t copy'),
    );
  };
  return (
    <div className="flex items-center gap-3">
      {links.map((l) => (
        <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer" aria-label={l.label}
          className="grid h-9 w-9 place-items-center rounded-full text-white/70 transition-colors hover:text-white"
          style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}>
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true"><path d={l.d} /></svg>
        </a>
      ))}
      <button type="button" onClick={copy} aria-label="Copy link"
        className="grid h-9 w-9 place-items-center rounded-full text-white/70 transition-colors hover:text-white"
        style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}>
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M13.19 8.69a4.5 4.5 0 0 1 1.24 7.24l-4.5 4.5a4.5 4.5 0 0 1-6.36-6.36l1.76-1.76m13.34-.62 1.76-1.76a4.5 4.5 0 0 0-6.36-6.36l-4.5 4.5a4.5 4.5 0 0 0 1.24 7.24" />
        </svg>
      </button>
    </div>
  );
};

const AuthorLink = ({ name, className, style }) => (
  <a href={AUTHOR_URL} target="_blank" rel="noopener noreferrer" className={className} style={style}>
    {name}
  </a>
);

// ── Sticky promo rail (cal.com-style) ───────────────────────────────
// Sits beside the article on lg+ and stays in view while reading (position:
// sticky, offset clears the top-0 navbar). Hidden on mobile — the bottom CTA
// band already covers small screens. "Create free account" reuses the vendor
// Google OAuth flow (same as /become-a-host); "Book a demo" points at the live
// /demo host page. Primary button takes the post's page (band) colour; text
// flips dark/light off the theme so it stays readable on any category.
const SidebarCta = ({ theme }) => {
  const { startVendorGoogleAuth } = useAuth();
  const [loading, setLoading] = useState(false);
  const signup = async () => {
    setLoading(true);
    try {
      await startVendorGoogleAuth('signup');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not start Google sign-up');
      setLoading(false);
    }
  };
  return (
    <div className="sticky top-24 rounded-xl border p-6"
      style={{ borderColor: 'rgba(255,255,255,0.10)', backgroundColor: 'rgba(255,255,255,0.03)' }}>
      <h3 className="font-heading text-lg font-bold leading-snug" style={{ color: HEAD_TX }}>
        Get appointments booked &amp; paid — start free today
      </h3>
      <p className="mt-2 text-sm leading-relaxed" style={{ color: BODY_DIM }}>
        Publish your services, share one link and get paid at 0% commission.
      </p>
      <button type="button" onClick={signup} disabled={loading}
        className="btn mt-5 flex w-full items-center justify-center rounded-[8px] py-3 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
        style={{ backgroundColor: theme.band, color: theme.light ? '#141416' : '#FFFFFF' }}>
        {loading ? 'Opening Google…' : 'Create free account'}
      </button>
      <Link to="/contact"
        className="btn mt-2.5 flex w-full items-center justify-center rounded-[8px] py-3 text-sm font-semibold transition-colors hover:no-underline"
        style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: HEAD_TX }}>
        Book a demo
      </Link>
    </div>
  );
};

const BlogPost = () => {
  const { slug } = useParams();
  // Build-time copy of this post baked into the prerendered HTML → render it on
  // the first frame (no spinner → no footer jump); the fetch below refreshes it.
  const seed = prerendered(`/blogs/${slug}`)?.post;
  const [post, setPost] = useState(seed || null);
  const [status, setStatus] = useState(seed ? 'ready' : 'loading'); // loading | ready | notfound | error

  useEffect(() => {
    let alive = true;
    // Seeded slug (incl. navigating back to it) → show the baked copy at once.
    const baked = prerendered(`/blogs/${slug}`)?.post;
    if (baked) { setPost(baked); setStatus('ready'); } else setStatus('loading');
    window.scrollTo(0, 0);

    // A real 404 means the post is gone → the noindex ErrorPage is correct. Any
    // OTHER failure (network/timeout, 5xx, or a 429/403 from an edge rate-limit or
    // IP guard) is transient: retry with a short backoff, and if it still fails,
    // fall to the 'error' state — NOT the noindex ErrorPage. A JS-rendering crawler
    // that hit a transient API failure would otherwise noindex this live,
    // prerendered post and drop it from search (found via the Rich Results Test).
    const load = (attempt = 0) => {
      getBlogBySlug(slug)
        .then((res) => { if (alive) { setPost(res.data.post); setStatus('ready'); } })
        .catch((err) => {
          if (!alive) return;
          if (isNotFoundError(err)) { setStatus('notfound'); return; }
          if (attempt < 2) { setTimeout(() => { if (alive) load(attempt + 1); }, 800 * (attempt + 1)); return; }
          setStatus(baked ? 'ready' : 'error'); // baked copy stays on a transient failure
        });
    };
    load();
    return () => { alive = false; };
  }, [slug]);

  // Branded 404 (noindex/nofollow via ErrorLayout), NOT a redirect to /blog: a
  // dead post URL redirecting to the index is Google's soft-404 pattern AND made
  // every prerendered post bake the index's canonical (dropping all posts from
  // search). Matches HostProfile/ProfessionLanding. ONLY a genuine 404 lands here.
  if (status === 'notfound') return <ErrorPage code={404} />;

  // Transient load failure — deliberately NOT the noindex ErrorPage: this is a
  // live, prerendered post, so a blip must not drop it from search. No robots meta
  // is emitted (stays indexable), the baked prerendered head tags remain, and the
  // reader gets a retry.
  if (status === 'error') {
    return (
      <main className="blog-page grid min-h-[60vh] place-items-center px-6 text-center" style={{ backgroundColor: BODY_BG }}>
        <Seo canonical={`${SITE_URL}/blog/${slug}`} />
        <div>
          <p className="text-base" style={{ color: BODY_TX }}>This article didn’t load. Please try again.</p>
          <button type="button" onClick={() => window.location.reload()}
            className="btn mt-5 inline-flex px-5 py-2.5 text-sm font-semibold"
            style={{ backgroundColor: '#FFFFFF', color: '#141416' }}>
            Reload
          </button>
          <p className="mt-4 text-sm"><Link to="/blog" style={{ color: BODY_DIM }}>Back to all posts</Link></p>
        </div>
      </main>
    );
  }
  if (status === 'loading' || !post) {
    return (
      <div className="blog-page grid min-h-[60vh] place-items-center" style={{ backgroundColor: BODY_BG }}>
        <PetalSpinner size={48} />
      </div>
    );
  }

  const t = themeFor(post.category);
  const tt = bandText(t);
  const canonical = `${SITE_URL}/blog/${post.slug}`;
  // Share card only. Deliberately NOT `post.image` first: `image` is the on-page
  // hero and setting it suppresses the icon thumbnail, so the two must stay
  // separate concerns. Falls back to a real hero photo, then the site-wide card.
  const ogImage = post.ogImage || post.image || `${SITE_URL}/og-image.png`;
  // The generated per-post card and the site-wide card are both 1200x630; only a
  // raw hero photo (post.image, used when no card exists) has unknown dimensions,
  // so we emit width/height only for the cards rather than invent them.
  const cardDims = post.ogImage || !post.image ? { width: 1200, height: 630 } : {};
  const blogSeo = resolveBlogSeo({ post });
  const faqs = faqsFrom(post.body);
  // One trail for both the visible breadcrumb and the BreadcrumbList JSON-LD.
  const crumbs = [
    { name: 'Home', path: '/' },
    { name: 'Blog', path: '/blog' },
    { name: post.title, path: `/blog/${post.slug}` },
  ];

  return (
    <main className="blog-page" style={{ backgroundColor: BODY_BG }}>
      <Seo
        title={blogSeo.title}
        description={blogSeo.description}
        canonical={canonical}
        image={ogImage}
        siteName="Meeticulous"
        locale="en_IN"
        themeColor={t.band}
        ogType="article"
        articlePublishedTime={post.published_at}
        articleModifiedTime={post.updated_at}
        jsonLd={articleGraphJsonLd({
          url: canonical,
          type: 'BlogPosting',
          headline: post.title,
          // Same resolved string the meta description uses — one source, so the two match.
          description: blogSeo.description,
          image: ogImage,
          imageWidth: cardDims.width,
          imageHeight: cardDims.height,
          datePublished: post.published_at,
          dateModified: post.updated_at,
          author: { ...AUTHOR, name: post.author || AUTHOR.name },
          breadcrumb: crumbs,
          // FAQPage only when the post actually shows the Q&A on the page —
          // structured data for content a reader can't see earns a manual action.
          faqs,
        })}
      />
      <article>
      {/* ── Split hero: left colour + text, right image (hidden on mobile) ── */}
      <header className="grid items-stretch lg:grid-cols-2" style={{ backgroundColor: t.band }}>
        <div className="app-container py-14 sm:py-20">
          <div className="mx-auto max-w-xl lg:mx-0 lg:ml-auto lg:pr-10">
            {/* Visible breadcrumb — same trail as the BreadcrumbList JSON-LD (crumbs). */}
            <nav aria-label="Breadcrumb">
              <ol className="flex flex-wrap items-center gap-1.5 text-sm font-medium" style={{ color: tt.faint }}>
                <li><Link to="/" className="transition-opacity hover:opacity-80" style={{ color: tt.faint }}>Home</Link></li>
                <li aria-hidden="true">/</li>
                <li><Link to="/blog" className="transition-opacity hover:opacity-80" style={{ color: tt.faint }}>Blog</Link></li>
                <li aria-hidden="true">/</li>
                <li aria-current="page" className="max-w-[18rem] truncate" style={{ color: tt.title }}>{post.title}</li>
              </ol>
            </nav>

            <p className="mt-8 text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: tt.faint }}>
              {post.category}
            </p>
            <h1 className="mt-3 font-heading text-3xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl" style={{ color: tt.title }}>
              {post.title}
            </h1>
            <p className="mt-5 text-base leading-relaxed sm:text-lg" style={{ color: tt.soft }}>
              {post.excerpt}
            </p>

            {/* Meta row */}
            <div className="mt-10 border-t pt-5" style={{ borderColor: tt.rule }}>
              <dl className="grid grid-cols-3 gap-x-3 gap-y-4">
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: tt.faint }}>Published</dt>
                  <dd className="mt-1 text-[13px] font-semibold sm:text-sm" style={{ color: tt.title }}>
                    <time dateTime={post.published_at || undefined}>{post.date}</time>
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: tt.faint }}>Author</dt>
                  <dd className="mt-1 text-[13px] font-semibold sm:text-sm">
                    <AuthorLink name={post.author} className="underline decoration-from-font underline-offset-2 hover:opacity-80" style={{ color: tt.title }} />
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: tt.faint }}>Read</dt>
                  <dd className="mt-1 text-[13px] font-semibold sm:text-sm" style={{ color: tt.title }}>{post.readMins} min</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>

        <HeroVisual post={post} t={t} />
      </header>

      {/* ── Reading body + sticky promo rail (cal.com-style, lg+ only) ── */}
      <div className="app-container py-14 sm:py-20">
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[minmax(0,1fr)_18rem] xl:gap-14">
          <div className="mx-auto min-w-0 max-w-2xl lg:mx-0">
            {post.body.map((block, i) => <Block key={i} block={block} accent={t.accent} />)}

            {/* Byline + share */}
            <div className="mt-14 flex flex-wrap items-center justify-between gap-4 border-t pt-6"
              style={{ borderColor: 'rgba(255,255,255,0.10)' }}>
              <p className="text-sm" style={{ color: BODY_DIM }}>
                by <AuthorLink name={post.author} className="font-semibold underline decoration-from-font underline-offset-2 transition-colors hover:text-white" style={{ color: BODY_TX }} />
              </p>
              <ShareRow title={post.title} />
            </div>

            {/* Related reading — cluster-aware internal links (static, prerendered) */}
            <RelatedPosts slug={post.slug} />
          </div>

          <aside className="hidden lg:block">
            <SidebarCta theme={t} />
          </aside>
        </div>
      </div>
      </article>

      {/* ── Bottom CTA band (same category colour) — outside <article>: promo, not post content ── */}
      <section style={{ backgroundColor: t.band }}>
        <div className="app-container py-16 sm:py-20">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-heading text-2xl font-extrabold tracking-tight sm:text-3xl" style={{ color: tt.title }}>
              Want this for your own bookings?
            </h2>
            <p className="mx-auto mt-3 max-w-md text-sm sm:text-base" style={{ color: tt.soft }}>
              Set up your page, sync your calendar, and start getting paid at 0% commission.
            </p>
            <Link to="/become-a-host"
              className="btn mt-6 inline-flex items-center px-6 py-3 text-sm font-semibold transition-transform hover:no-underline"
              style={{ backgroundColor: t.light ? '#141416' : '#FFFFFF', color: t.light ? '#FFFFFF' : '#141416' }}>
              Become a host
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
};

export default BlogPost;

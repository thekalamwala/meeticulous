/**
 * blogController.js — public blog reads from the `blogs` table.
 * Rows are served through the API via supabaseAdmin (anon has no grants).
 * Response shape matches the client's existing post object exactly, so the
 * React pages only swap their data source — the renderer is untouched.
 */
const { supabaseAdmin } = require('../config/supabase');
const responseCache = require('../services/responseCache');
const { setPublicCache } = require('../utils/httpCache');

const BLOG_CACHE_MS = 300 * 1000; // 5 min; matches the Cache-Control below

// timestamptz → "Jul 6, 2026" (the format the static posts used). Pinned to IST:
// posts are authored/stored at 00:00 IST (= 18:30 UTC the prior day), so formatting
// in the server's tz (UTC on Render) would show the day before. Asia/Kolkata is the
// product's home tz and keeps the displayed date equal to the authored date.
const fmtDate = (ts) =>
  ts ? new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Kolkata' }) : '';

const toSummary = (r) => ({
  slug: r.slug,
  title: r.title,
  excerpt: r.excerpt || '',
  category: r.category || 'News',
  author: r.author || 'Book A Sloth Team',
  // `image` = on-page hero; when set it REPLACES the icon thumbnail on the post
  // page and the index card. `ogImage` is the social share card and is read only
  // by the og:image meta tag — never render it as the hero.
  image: r.image || null,
  ogImage: r.og_image || null,
  icons: Array.isArray(r.icons) ? r.icons : [],
  readMins: r.read_mins || null,
  date: fmtDate(r.published_at),
  // Raw timestamps for JSON-LD (datePublished / dateModified). `date` stays the display string.
  published_at: r.published_at || null,
  updated_at: r.updated_at || null,
});
const toFull = (r) => ({ ...toSummary(r), body: Array.isArray(r.body) ? r.body : [] });

// GET /api/blogs — published posts, newest first (summaries, no body).
async function listBlogs(req, res) {
  try {
    // v2: payload shape gained ogImage — a v1 key would serve it back without the field.
    const payload = await responseCache.getOrSet('blogs:list:v2', BLOG_CACHE_MS, async () => {
      const { data, error } = await supabaseAdmin
        .from('blogs')
        .select('slug,title,excerpt,category,author,image,og_image,icons,read_mins,published_at,updated_at')
        .eq('status', 'published')
        // Future-date gate: a post seeded with a future published_at stays hidden
        // until its date arrives. Lets us seed a whole content calendar ahead of
        // time and have each post reveal on schedule (cache TTL adds ≤5 min lag).
        .lte('published_at', new Date().toISOString())
        .order('published_at', { ascending: false });
      if (error) throw error;
      return { posts: (data || []).map(toSummary) };
    });
    setPublicCache(res, 300);
    return res.json(payload);
  } catch (err) {
    console.error('[blog.list]', err);
    return res.status(500).json({ message: 'Failed to load blog' });
  }
}

// GET /api/blogs/:slug — full post (with body block array).
async function getBlogBySlug(req, res) {
  try {
    const slug = String(req.params.slug || '').trim();
    const payload = await responseCache.getOrSet(`blogs:post:v2:${slug}`, BLOG_CACHE_MS, async () => {
      const { data, error } = await supabaseAdmin
        .from('blogs')
        .select('slug,title,excerpt,body,category,author,image,og_image,icons,read_mins,published_at,updated_at')
        .eq('slug', slug)
        .eq('status', 'published')
        // Same future-date gate as the list (a direct URL must not leak a scheduled post early).
        .lte('published_at', new Date().toISOString())
        .maybeSingle();
      if (error) throw error;
      return { post: data ? toFull(data) : null };
    });
    if (!payload.post) return res.status(404).json({ message: 'Post not found' });
    setPublicCache(res, 300);
    return res.json(payload);
  } catch (err) {
    console.error('[blog.getBySlug]', err);
    return res.status(500).json({ message: 'Failed to load post' });
  }
}

module.exports = { listBlogs, getBlogBySlug };

/**
 * seedBlogs.js — seed/sync the `blogs` table from the version-controlled source
 * in client/src/data/blogPosts.js. Idempotent (upsert by slug), so re-running
 * syncs edits. Run once per DB with the matching env:
 *
 *   node -r dotenv/config scripts/seedBlogs.js dotenv_config_path=.env.staging
 *   node -r dotenv/config scripts/seedBlogs.js dotenv_config_path=.env
 *
 * The client file is ESM; we dynamic-import it (client is type:module).
 */
const path = require('path');
const { pathToFileURL } = require('url');
const { supabaseAdmin } = require('../config/supabase');

async function main() {
  const src = pathToFileURL(path.join(__dirname, '../../client/src/data/blogPosts.js')).href;
  const { BLOG_POSTS = [] } = await import(src);

  let ok = 0;
  for (const p of BLOG_POSTS) {
    const publishedAt = p.date ? new Date(p.date) : null;
    const row = {
      slug: p.slug,
      title: p.title,
      excerpt: p.excerpt || null,
      body: p.body || [],
      category: p.category || null,
      author: p.author || 'Book A Sloth Team',
      image: p.image || null,
      icons: p.icons || [],
      read_mins: p.readMins || null,
      status: 'published',
      published_at: publishedAt && !isNaN(publishedAt) ? publishedAt.toISOString() : null,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabaseAdmin.from('blogs').upsert(row, { onConflict: 'slug' });
    if (error) { console.error('FAIL', p.slug, '-', error.message); process.exitCode = 1; }
    else { ok += 1; console.log('ok  ', p.slug); }
  }
  console.log(`\nseeded ${ok}/${BLOG_POSTS.length} posts`);
}

main().then(() => process.exit(process.exitCode || 0)).catch((e) => { console.error(e); process.exit(1); });

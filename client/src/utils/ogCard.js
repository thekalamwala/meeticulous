/**
 * ogCard.js — build a blog post's og:image as a Cloudinary URL (client side).
 *
 * The CLIENT mirror of the server builder (server/services/seo/hostOgCard.js
 * layoutA) — blogs set og:image in BlogPost and it's captured at build-time
 * prerender, so the card has to be composed in the client. Keep the transform in
 * sync with the server layout. Cloudinary fetches the committed brand background +
 * mark and composites the 1200x630 card on first crawl; nothing is pre-generated.
 *
 * Needs VITE_CLOUDINARY_CLOUD — the cloud NAME only (public, not a secret). Without
 * it the builder returns null and BlogPost falls back to the hero/site card.
 */

const CLOUD = import.meta.env.VITE_CLOUDINARY_CLOUD;
const SITE = String(import.meta.env.VITE_PUBLIC_SITE_URL || 'https://meeticulous.com').replace(/\/+$/, '');
const ASSET_BASE = String(import.meta.env.VITE_OG_ASSET_BASE || `${SITE}/brand/og`).replace(/\/+$/, '');

// Maroon-card palette — mirrors hostOgCard.js.
const RING = 'FF9F5A';
const TITLE = 'FFFFFF';
const SUB = 'FF9FB0';
const META = 'FFE4EA';
const DISC = 'FFFFFF';

const b64url = (s) => btoa(unescape(encodeURIComponent(String(s))))
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const txt = (s) => encodeURIComponent(String(s == null ? '' : s))
  .replace(/%2C/gi, '%252C').replace(/%2F/gi, '%252F');

const clip = (s, n) => {
  const v = String(s || '').trim();
  return v.length <= n ? v : `${v.slice(0, n - 1).trimEnd()}…`;
};

/**
 * Blog post card: maroon ground + vertical ee ribbon (host-og-bg.svg), white
 * wordmark, the 'ee' brand mark in the ring slot, the headline, a pink category
 * line and a blush "author · N min read" line.
 * @returns {string|null} the Cloudinary URL, or null when the cloud/title is missing.
 */
export function cloudinaryBlogCard({ title, category, author, readMins } = {}) {
  if (!CLOUD || !title) return null;

  const base = encodeURIComponent(`${ASSET_BASE}/host-og-bg.svg`);
  const L = ['w_1200,h_630,c_fill,q_auto,f_auto'];

  L.push(`l_fetch:${b64url(`${ASSET_BASE}/wordmark-inverse.svg`)}/c_scale,h_36/fl_layer_apply,g_north_west,x_64,y_64`);
  // No person on a blog card → the 'ee' brand mark on a white disc with the ring.
  L.push(`l_fetch:${b64url(`${ASSET_BASE}/ee-mark.svg`)}/c_fit,w_92,h_92/c_pad,w_132,h_132,b_rgb:${DISC},r_max,bo_6px_solid_rgb:${RING}/fl_layer_apply,g_north_west,x_64,y_300`);

  L.push(`l_text:Poppins_60_700:${txt(clip(title, 34))},co_rgb:${TITLE}/fl_layer_apply,g_north_west,x_64,y_452`);
  if (category) L.push(`l_text:Poppins_30_600:${txt(clip(category, 40))},co_rgb:${SUB}/fl_layer_apply,g_north_west,x_220,y_318`);

  const meta = [author, readMins ? `${readMins} min read` : null].filter(Boolean).join('  ·  ');
  if (meta) L.push(`l_text:Poppins_24_500:${txt(clip(meta, 44))},co_rgb:${META}/fl_layer_apply,g_north_west,x_220,y_362`);

  return `https://res.cloudinary.com/${CLOUD}/image/fetch/${L.join('/')}/${base}`;
}

/**
 * hostOgCard.js — build host & service og:image share cards as Cloudinary URLs.
 *
 * Replaces the old generate-and-store pipelines (v3.88 host / v3.154 service:
 * Puppeteer screenshots on nightly GitHub Actions → Supabase storage → og_image).
 * Pure string builders: no network, no DB, no cron, no secret. Cloudinary fetches
 * the committed brand background + marks + the subject's avatar and composites the
 * 1200x630 card on first crawl, then serves it from its CDN. Same inputs => same
 * URL => cache hit, so each card renders once and never goes stale on an edit
 * (the URL just re-resolves).
 *
 * Needs CLOUDINARY_CLOUD — the cloud NAME only (public, not a secret). Without it
 * the builders return null and the caller falls back to the static site card, so
 * the code ships safe before the env var exists. An admin og_image still wins.
 *
 * ponytail: single accent ring, no profession→colour map, single-line title (long
 * service titles ellipsis rather than wrap), no bio line. Good enough to prove the
 * card system; richer layout (2-line title, profession colours, Bricolage font via
 * a Cloudinary upload) is the pre-bulk polish.
 */

// Read env at call time (not module load) so it's injectable in tests and picks up
// a late-set CLOUDINARY_CLOUD. CLOUD is the cloud NAME only — public, not a secret.
const cloudName = () => process.env.CLOUDINARY_CLOUD;
const siteRoot = () => String(process.env.PUBLIC_SITE_URL || 'https://meeticulous.com').replace(/\/+$/, '');
const assetBase = () =>
  // Where the committed brand assets are served (client/public/brand/og/*).
  // Overridable so a pre-deploy preview can point Cloudinary at a reachable host.
  String(process.env.OG_ASSET_BASE || `${siteRoot()}/brand/og`).replace(/\/+$/, '');

// Card is on a maroon (brand) ground — see host-og-bg.svg. Text is white/pink;
// the photo gap and no-photo disc are white so they pop off the maroon.
const RING = 'FF9F5A';   // photo-ring accent (marigold)
const NAME = 'FFFFFF';   // title (name / service title)
const SUB = 'FF9FB0';    // sub line (pink)
const META = 'FFE4EA';   // meta line (blush)
const DISC = 'FFFFFF';   // photo gap + no-photo disc

// Google avatars come back at =s96-c (96px); ask for 512 so the ring photo isn't
// upscaled mush. Mirrors prerenderController.upscaleAvatar.
const upscale = (u) => String(u || '').replace(/=s\d+-c$/, '=s512-c');

// base64url — how Cloudinary l_fetch encodes the remote URL it should overlay.
const b64url = (s) => Buffer.from(String(s), 'utf8').toString('base64')
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

// l_text payload: URL-encode, then double-encode the ,/ that delimit a Cloudinary
// transformation component (a value like "A, B/C" must not split the URL).
const txt = (s) => encodeURIComponent(String(s == null ? '' : s))
  .replace(/%2C/gi, '%252C').replace(/%2F/gi, '%252F');

const clip = (s, n) => {
  const v = String(s || '').trim();
  return v.length <= n ? v : `${v.slice(0, n - 1).trimEnd()}…`;
};

/**
 * Layout A — the shared brand card used for host profiles and service pages:
 * maroon ground + vertical ee ribbon (host-og-bg.svg), white wordmark, a circular
 * subject photo (or the ee mark when there's none) in the left identity block, a
 * big title, a pink sub line and a blush meta line.
 *
 * @returns {string|null} the Cloudinary URL, or null when the cloud/title is missing.
 */
function layoutA({ title, titleSize = 84, titleClip = 22, avatar, sub, meta } = {}) {
  const CLOUD = cloudName();
  if (!CLOUD || !title) return null;
  const ASSET_BASE = assetBase();

  const base = encodeURIComponent(`${ASSET_BASE}/host-og-bg.svg`);
  const L = ['w_1200,h_630,c_fill,q_auto,f_auto'];

  // Wordmark (white) top-left — overlaid so it stays one source of truth in the repo.
  L.push(`l_fetch:${b64url(`${ASSET_BASE}/wordmark-inverse.svg`)}/c_scale,h_36/fl_layer_apply,g_north_west,x_64,y_64`);

  // Subject photo clipped to a circle INSIDE the ring (crop to 112, pad to 132 on a
  // white disc for a clean gap, then the 6px ring). No photo → the 'ee' brand mark
  // on a white disc, never the wordmark.
  if (avatar) {
    L.push(`l_fetch:${b64url(upscale(avatar))}/c_fill,g_face,w_112,h_112,r_max/c_pad,w_132,h_132,b_rgb:${DISC},r_max,bo_6px_solid_rgb:${RING}/fl_layer_apply,g_north_west,x_64,y_300`);
  } else {
    L.push(`l_fetch:${b64url(`${ASSET_BASE}/ee-mark.svg`)}/c_fit,w_92,h_92/c_pad,w_132,h_132,b_rgb:${DISC},r_max,bo_6px_solid_rgb:${RING}/fl_layer_apply,g_north_west,x_64,y_300`);
  }

  // Title — Poppins 700 (the kit's Bricolage 800 isn't a built-in Cloudinary font).
  L.push(`l_text:Poppins_${titleSize}_700:${txt(clip(title, titleClip))},co_rgb:${NAME}/fl_layer_apply,g_north_west,x_64,y_452`);

  if (sub) L.push(`l_text:Poppins_30_600:${txt(clip(sub, 40))},co_rgb:${SUB}/fl_layer_apply,g_north_west,x_220,y_318`);
  if (meta) L.push(`l_text:Poppins_24_500:${txt(clip(meta, 44))},co_rgb:${META}/fl_layer_apply,g_north_west,x_220,y_362`);

  return `https://res.cloudinary.com/${CLOUD}/image/fetch/${L.join('/')}/${base}`;
}

/** Host profile card (meeticulous.com/[handle]). */
function cloudinaryHostCard({ name, avatar, profession, city, handle } = {}) {
  return layoutA({
    title: name,
    avatar,
    sub: [profession, city].filter(Boolean).join(' · '),
    meta: handle ? `meeticulous.com/${handle}` : '',
  });
}

const inr = (n) => `₹${Number(n).toLocaleString('en-IN')}`;

/** Service page card (meeticulous.com/[handle]/[service]). */
function cloudinaryServiceCard({ title, hostName, hostAvatar, price, priceOnRequest, duration, mode } = {}) {
  const metaBits = [
    priceOnRequest ? 'Price on request' : (Number(price) > 0 ? inr(price) : (price === 0 ? 'Free' : null)),
    duration ? `${duration} min` : null,
    mode === 'offline' ? 'In person' : 'Online',
  ].filter(Boolean);
  return layoutA({
    title,
    titleSize: 60,   // service titles run longer than a name
    titleClip: 34,
    avatar: hostAvatar,
    sub: hostName ? `with ${hostName}` : '',
    meta: metaBits.join('  ·  '),
  });
}

module.exports = { cloudinaryHostCard, cloudinaryServiceCard };

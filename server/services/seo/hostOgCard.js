/**
 * hostOgCard.js — build the host profile's og:image as a Cloudinary URL.
 *
 * Replaces the old generate-and-store pipeline (v3.88: Puppeteer screenshots on a
 * nightly GitHub Action → Supabase storage → profiles.og_image). This is a PURE
 * string builder: no network, no DB, no cron, no secret. Cloudinary fetches the
 * committed background + brand marks + the host's avatar and composites the
 * 1200x630 card on first crawl, then serves it from its CDN. Same inputs => same
 * URL => cache hit, so each card renders once and never goes stale on a profile
 * edit (the URL just re-resolves).
 *
 * Needs CLOUDINARY_CLOUD — the cloud NAME only (public, not a secret). Without it
 * the function returns null and the caller falls back to the static site card, so
 * the code ships safe before the env var exists. profiles.og_image still wins as a
 * manual admin override.
 *
 * ponytail: single accent ring + no profession→colour map yet, and no bio/next-
 * slots line. Matches OG kit template 02's core (photo, name, profession·city,
 * handle); add the BRIGHT profession-colour map + bio before rolling this pattern
 * out to services/blogs.
 */

// Read env at call time (not module load) so it's injectable in tests and picks up
// a late-set CLOUDINARY_CLOUD. CLOUD is the cloud NAME only — public, not a secret.
const cloudName = () => process.env.CLOUDINARY_CLOUD;
const siteRoot = () => String(process.env.PUBLIC_SITE_URL || 'https://meeticulous.com').replace(/\/+$/, '');
const assetBase = () =>
  // Where the committed brand assets are served (client/public/brand/og/*).
  // Overridable so a pre-deploy preview can point Cloudinary at a reachable host.
  String(process.env.OG_ASSET_BASE || `${siteRoot()}/brand/og`).replace(/\/+$/, '');

// Kit colours (tokens/colors.css). RING is the template-02 photo-ring accent — the
// kit's profession-colour placeholder until the BRIGHT map lands.
const RING = 'FF9F5A';
const INK = '2B0A14';
const MAROON = '960D32';
const MUTE = '6B524F';

// Google avatars come back at =s96-c (96px); ask for 512 so the ring photo isn't
// upscaled mush. Mirrors prerenderController.upscaleAvatar.
const upscale = (u) => String(u || '').replace(/=s\d+-c$/, '=s512-c');

// base64url — how Cloudinary l_fetch encodes the remote URL it should overlay.
const b64url = (s) => Buffer.from(String(s), 'utf8').toString('base64')
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

// l_text payload: URL-encode, then double-encode the ,/ that delimit a Cloudinary
// transformation component (a name like "A, B/C" must not split the URL).
const txt = (s) => encodeURIComponent(String(s == null ? '' : s))
  .replace(/%2C/gi, '%252C').replace(/%2F/gi, '%252F');

const clip = (s, n) => {
  const v = String(s || '').trim();
  return v.length <= n ? v : `${v.slice(0, n - 1).trimEnd()}…`;
};

/**
 * @returns {string|null} the Cloudinary og:image URL, or null when CLOUDINARY_CLOUD
 *   is unset or there's no name to render (caller falls back to the site card).
 */
function cloudinaryHostCard({ name, avatar, profession, city, handle, bio } = {}) {
  const CLOUD = cloudName();
  if (!CLOUD || !name) return null;
  const ASSET_BASE = assetBase();

  const base = encodeURIComponent(`${ASSET_BASE}/host-bg-cream.png`);
  const L = ['w_1200,h_630,c_fill,q_auto,f_auto'];

  // Static brand marks baked into the committed bg would drift from the kit on a
  // redesign; overlaying the SVGs keeps one source of truth in the repo.
  L.push(`l_fetch:${b64url(`${ASSET_BASE}/wordmark.svg`)}/c_scale,h_36/fl_layer_apply,g_north_west,x_64,y_64`);
  L.push(`l_fetch:${b64url(`${ASSET_BASE}/ee-mark.svg`)}/c_scale,w_150/fl_layer_apply,g_north_east,x_64,y_80`);

  // Avatar — circle with the profession-colour ring (left identity block). With no
  // photo, fall back to the 'ee' loop mark on a maroon disc with the same ring —
  // the brand mark, never the wordmark. Maroon disc (not blush) so the pink ee
  // loop keeps contrast.
  if (avatar) {
    // Photo clipped to a circle INSIDE the ring: crop to a 112 circle, pad out to
    // 132 on a cream disc (a clean gap), then the 6px colour ring around that — so
    // the ring frames the photo instead of hugging its edge.
    L.push(`l_fetch:${b64url(upscale(avatar))}/c_fill,g_face,w_112,h_112,r_max/c_pad,w_132,h_132,b_rgb:FBF5F3,r_max,bo_6px_solid_rgb:${RING}/fl_layer_apply,g_north_west,x_64,y_300`);
  } else {
    L.push(`l_fetch:${b64url(`${ASSET_BASE}/ee-mark.svg`)}/c_fit,w_92,h_92/c_pad,w_132,h_132,b_rgb:${MAROON},r_max,bo_6px_solid_rgb:${RING}/fl_layer_apply,g_north_west,x_64,y_300`);
  }

  // Name — Poppins 700. The kit's display face is Bricolage Grotesque 800, but
  // Cloudinary has no built-in Bricolage ("Unsupported font family"); Poppins bold
  // is the closest built-in. ponytail: upload the Bricolage TTF to Cloudinary and
  // switch this to Bricolage%20Grotesque_84_800 for an exact kit match before bulk.
  L.push(`l_text:Poppins_84_700:${txt(clip(name, 22))},co_rgb:${INK}/fl_layer_apply,g_north_west,x_64,y_452`);

  // Profession · city.
  const sub = [profession, city].filter(Boolean).join(' · ');
  if (sub) {
    L.push(`l_text:Poppins_30_600:${txt(clip(sub, 40))},co_rgb:${MAROON}/fl_layer_apply,g_north_west,x_220,y_318`);
  }

  // Handle.
  if (handle) {
    L.push(`l_text:Poppins_24_500:${txt(`meeticulous.com/${handle}`)},co_rgb:${MUTE}/fl_layer_apply,g_north_west,x_220,y_362`);
  }

  // bio reserved for the pre-bulk refinement (kept in the signature so callers
  // already pass it). ponytail: wire the bio line in before services/blogs.
  void bio;

  return `https://res.cloudinary.com/${CLOUD}/image/fetch/${L.join('/')}/${base}`;
}

module.exports = { cloudinaryHostCard };

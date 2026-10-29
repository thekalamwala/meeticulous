// Social share cards (og:image / twitter:image).
//
// Hand-made 1200x630 JPEGs on the company CDN, one per marketing page, uploaded
// by hand. This helper is the single place that knows the host and the naming
// convention, so every page's <Seo image> agrees by construction and a rename
// is one edit, not forty.
//
// Blog posts do NOT use this — their cards are generated per post and stored on
// Supabase (blogs.og_image); see scripts/generateBlogOgImages.mjs.
//
// The file must exist on the CDN before the ref ships, or the page serves a
// dead card. scripts/checkOgImages.mjs HEADs every URL this produces and fails
// if one 404s — run it after uploading, before deploy.
const OG_BASE = 'https://company-assets.meeticulous.in/images/seo';

// ext defaults to 'jpg' (the convention for hand-made cards); pass 'png' for the
// handful uploaded as PNG. Keep checkOgImages.mjs in sync with any png cards.
export const ogCard = (name, ext = 'jpg') => `${OG_BASE}/${name}-og-1200x630.${ext}`;

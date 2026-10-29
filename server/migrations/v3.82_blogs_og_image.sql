-- v3.82_blogs_og_image.sql
-- Separate the social share card from the on-page hero.
--
-- `blogs.image` means "hero image for this post": both the post page and the
-- index card render it INSTEAD of the icon thumbnail when it is set. Writing a
-- generated OG card into that column therefore replaced the icon art across the
-- whole blog — which is exactly what happened, and why this column exists.
--
-- og_image is read only for the og:image meta tag. It never touches the hero, so
-- the two cannot collide again.
--
-- Apply on BOTH DBs (prod Mumbai ayjhlwyzszykqtnaktpb + staging Tokyo
-- xwvciqkayammbvsidqig). Nullable with no default: a post without a generated
-- card falls back to `image`, then to the site-wide /og-image.png.

alter table public.blogs add column if not exists og_image text;

comment on column public.blogs.og_image is
  'Social share card (og:image) only. NOT the on-page hero — that is `image`, which suppresses the icon thumbnail when set.';

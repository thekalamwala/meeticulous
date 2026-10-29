import { useParams, useSearchParams } from 'react-router-dom';
import { themeFor } from '../data/blogPosts';
import { useHideChrome } from '../context/ChromeContext';
import Seo from '../components/common/Seo';
import BlogHeroThumbnail from '../components/blog/BlogHeroThumbnail';

// /og/blog/:slug?category=...&icons=a,b,c — a render target for
// scripts/generateBlogOgImages.mjs, not a page for humans. It draws the post's
// real BlogHeroThumbnail at exactly 1200x630 so puppeteer can screenshot it.
//
// Rendering the actual component (rather than re-drawing the art in the script)
// means the card cannot drift from the site: it IS the site's thumbnail.
//
// Post data comes from the query string, not an API call. The generator already
// has DB access, and a page served from localhost fetching the production API is
// blocked by CORS — which is exactly how the first run failed, 34 for 34.
//
// noindex, and deliberately absent from the sitemap + prerender lists.
const OG_W = 1200;
const OG_H = 630;

// BlogHeroThumbnail's patterns use fixed pixel sizes (72-100px icon cards, an
// 80px grid) tuned for a card-sized canvas. Handing it 1200x630 leaves the icons
// marooned in a huge empty field, so draw at natural size and scale up — same
// 1.905 aspect, so the scale is uniform and proportions hold.
const BASE_W = 480;
const BASE_H = 252;
const SCALE = OG_W / BASE_W;

const OgCard = () => {
  const { slug } = useParams();
  const [params] = useSearchParams();
  useHideChrome(); // drops navbar, footer and the consent banner

  const category = params.get('category') || 'News';
  const icons = (params.get('icons') || '').split(',').filter(Boolean);
  const theme = themeFor(category);
  const post = { slug, category, icons };

  return (
    <div
      data-og-ready="true"
      style={{
        width: OG_W, height: OG_H, overflow: 'hidden', position: 'relative',
        backgroundColor: theme.band,
      }}
    >
      {/* The header comment promised noindex; this is the mechanism (plus the
          robots.txt /og/ disallow). A JS-rendering crawler that wanders in via
          a stray link otherwise indexes a 1200x630 blank-titled art board. */}
      <Seo robots="noindex" />
      <div style={{ width: BASE_W, height: BASE_H, transform: `scale(${SCALE})`, transformOrigin: 'top left' }}>
        <BlogHeroThumbnail post={post} theme={theme} w={BASE_W} h={BASE_H} />
      </div>
    </div>
  );
};

export default OgCard;

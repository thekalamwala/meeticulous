import { useEffect } from 'react';

/**
 * <Seo> — imperative document-head manager for public pages.
 *
 * The app is a client-rendered SPA with no react-helmet, so we set head tags
 * directly. Google executes JS and honors these (title, description, robots,
 * canonical, OG, JSON-LD). NOTE: non-JS crawlers and most social scrapers read
 * only the static index.html — true coverage for those needs SSR/prerender
 * (see docs/seo-aeo-geo-plan.md Phase 3). This closes the Google gap today.
 *
 * On unmount it restores prior values / removes tags it created, so SPA route
 * changes don't leak stale SEO between pages.
 */
export default function Seo({
  title, description, canonical, robots, keywords,
  ogTitle, ogDescription, image, jsonLd,
  siteName, locale, themeColor,
  // 'website' (default) | 'article' (blog posts) — article additionally emits
  // article:published_time / article:modified_time when provided.
  ogType, articlePublishedTime, articleModifiedTime,
}) {
  useEffect(() => {
    const restores = [];

    // meta[name|property=...] upsert with restore.
    const upsertMeta = (attr, key, content) => {
      if (content == null) return;
      const selector = `meta[${attr}="${key}"]`;
      let el = document.head.querySelector(selector);
      if (el) {
        const prev = el.getAttribute('content');
        el.setAttribute('content', content);
        restores.push(() => { if (prev != null) el.setAttribute('content', prev); });
      } else {
        el = document.createElement('meta');
        el.setAttribute(attr === 'property' ? 'property' : 'name', key);
        el.setAttribute('content', content);
        document.head.appendChild(el);
        restores.push(() => el.remove());
      }
    };

    if (title) {
      const prevTitle = document.title;
      document.title = title;
      restores.push(() => { document.title = prevTitle; });
    }

    upsertMeta('name', 'description', description);
    upsertMeta('name', 'robots', robots);
    upsertMeta('name', 'keywords', keywords);
    upsertMeta('name', 'theme-color', themeColor);

    // canonical link
    if (canonical) {
      let link = document.head.querySelector('link[rel="canonical"]');
      if (link) {
        const prev = link.getAttribute('href');
        link.setAttribute('href', canonical);
        restores.push(() => { if (prev != null) link.setAttribute('href', prev); });
      } else {
        link = document.createElement('link');
        link.setAttribute('rel', 'canonical');
        link.setAttribute('href', canonical);
        document.head.appendChild(link);
        restores.push(() => link.remove());
      }
    }

    // Open Graph + Twitter
    upsertMeta('property', 'og:type', ogType || 'website');
    if (ogType === 'article') {
      upsertMeta('property', 'article:published_time', articlePublishedTime);
      upsertMeta('property', 'article:modified_time', articleModifiedTime);
    }
    upsertMeta('property', 'og:site_name', siteName);
    upsertMeta('property', 'og:locale', locale);
    upsertMeta('property', 'og:title', ogTitle || title);
    upsertMeta('property', 'og:description', ogDescription || description);
    upsertMeta('property', 'og:url', canonical);
    upsertMeta('property', 'og:image', image);
    upsertMeta('name', 'twitter:card', 'summary_large_image');
    upsertMeta('name', 'twitter:title', ogTitle || title);
    upsertMeta('name', 'twitter:description', ogDescription || description);
    upsertMeta('name', 'twitter:image', image);

    // JSON-LD structured data
    let script;
    if (jsonLd) {
      script = document.createElement('script');
      script.type = 'application/ld+json';
      script.textContent = JSON.stringify(jsonLd);
      document.head.appendChild(script);
    }

    return () => {
      restores.reverse().forEach((fn) => fn());
      if (script) script.remove();
    };
  }, [title, description, canonical, robots, keywords, ogTitle, ogDescription, image, siteName, locale, themeColor, ogType, articlePublishedTime, articleModifiedTime, JSON.stringify(jsonLd)]);

  return null;
}

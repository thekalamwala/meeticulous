import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getTags } from '../../services/communityApi';

// "Browse by topic" as small pills. Crawlable internal links from the hub to every
// topic page (SEO/AEO) + a quick jump into a topic. Soft-fails to nothing if tags
// aren't there. `rail` = the compact variant that sits under the sidebar ad.
export default function CommunityTopics({ rail = false, className = '' }) {
  const [tags, setTags] = useState([]);
  useEffect(() => { getTags().then((r) => setTags(r.tags || [])).catch(() => {}); }, []);
  if (!tags.length) return null;
  return (
    <nav
      aria-label="Topics"
      className={`mt-card flex flex-wrap items-center gap-1.5 ${rail ? 'max-w-[320px] p-4' : 'p-4 sm:p-5'} ${className}`}
    >
      <span className="w-full font-display text-[11px] font-bold uppercase tracking-wide text-muted">Browse by topic</span>
      {tags.map((t) => (
        <Link
          key={t.tag}
          to={`/community/tag/${t.tag}`}
          className="rounded-full border border-line px-2.5 py-1 text-[11px] font-medium text-ink transition-colors hover:border-maroon/40 hover:text-maroon"
        >
          {t.name} <span className="text-muted">{t.count}</span>
        </Link>
      ))}
    </nav>
  );
}

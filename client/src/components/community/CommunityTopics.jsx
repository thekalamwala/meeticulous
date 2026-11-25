import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getTags } from '../../services/communityApi';

// A topic's tone is derived from its name, so the same topic is the same colour on every
// surface and across reloads — colour that carries meaning rather than decorating it.
// The eight tones are all existing kit tokens (brand ramps + the green/blue/marigold the
// kit already carries for feedback), so this is multicolour without an invented palette.
const TONES = 8;
const toneOf = (key = '') => {
  let h = 0;
  for (let i = 0; i < key.length; i += 1) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return (h % TONES) + 1;
};

// "Browse by topic" as filled pills. Crawlable internal links from the hub to every
// topic page (SEO/AEO) + a quick jump into a topic. Soft-fails to nothing if tags
// aren't there.
//   `rail`  — compact variant under the sidebar ad.
//   `bare`  — no card around it, for when it already sits inside one (the spaces sheet).
//   `onNavigate` — lets a host sheet close itself when a topic is picked.
export default function CommunityTopics({ rail = false, bare = false, onNavigate, className = '' }) {
  const [tags, setTags] = useState([]);
  useEffect(() => { getTags().then((r) => setTags(r.tags || [])).catch(() => {}); }, []);
  if (!tags.length) return null;
  const pills = tags.map((t) => (
    <Link
      key={t.tag}
      to={`/community/tag/${t.tag}`}
      onClick={onNavigate}
      className={`mt-topic mt-topic--${toneOf(t.tag || t.name)}`}
    >
      {t.name}
      {t.count > 0 && <span className="mt-topic__n">{t.count}</span>}
    </Link>
  ));
  if (bare) {
    return (
      <nav aria-label="Topics" className={`flex flex-wrap gap-2 ${className}`}>
        {pills}
      </nav>
    );
  }
  return (
    <nav
      aria-label="Topics"
      className={`mt-card mt-card--feed flex-row flex-wrap items-center gap-2 ${rail ? 'max-w-[320px]' : ''} ${className}`}
    >
      <span className="mt-overline w-full text-muted">Browse by topic</span>
      {pills}
    </nav>
  );
}

import { Link } from 'react-router-dom';
import { BadgeCheck, Sparkles } from 'lucide-react';

// Author data is exactly what serializeAuthor sends: {display_name, avatar_url, role, badge, profile_url}.
// Hosts link to their public page (profile_url); guests and deleted accounts never link.
const BADGES = {
  official: { label: 'Meeticulous', cls: 'mt-badge--official', Icon: BadgeCheck },
  staff: { label: 'Staff', cls: 'mt-badge--official', Icon: BadgeCheck },
  ai: { label: 'AI', cls: 'mt-badge--ai', Icon: Sparkles },
};
const ROLES = { host: { label: 'Host', cls: 'mt-badge--brand' }, guest: { label: 'Guest', cls: '' } };

const initials = (name) => String(name || '').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '–';

function tone(author) {
  if (!author || author.role === 'deleted') return 'mt-avatar--neutral';
  if (author.badge === 'ai') return 'mt-avatar--ink';
  if (author.badge) return 'mt-avatar--brand';
  return author.role === 'host' ? '' : 'mt-avatar--neutral';
}

export function Avatar({ author, size = 'm' }) {
  const px = size === 's' ? 32 : 40;
  return (
    <span className={`mt-avatar ${size === 's' ? 'mt-avatar--s' : ''} ${tone(author)}`} aria-hidden="true">
      {author?.avatar_url
        ? <img src={author.avatar_url} alt="" width={px} height={px} loading="lazy" />
        : author?.role === 'deleted' ? '–' : initials(author?.display_name)}
    </span>
  );
}

export function AuthorBadge({ author }) {
  const b = BADGES[author?.badge];
  if (b) {
    return <span className={`mt-badge mt-badge--s ${b.cls}`}><b.Icon size={16} aria-hidden="true" />{b.label}</span>;
  }
  const r = ROLES[author?.role];
  return r ? <span className={`mt-badge mt-badge--s ${r.cls}`}>{r.label}</span> : null;
}

// Name + handle + badge on one wrapping line. `meta` renders underneath (time, format...).
export default function AuthorChip({ author, meta, size = 'm', avatar = true }) {
  const name = author?.display_name || 'Deleted account';
  const handle = author?.profile_url ? `@${author.profile_url.replace(/^\//, '')}` : null;
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      {avatar && <Avatar author={author} size={size} />}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm leading-snug">
          {author?.profile_url
            ? <Link to={author.profile_url} className="font-semibold text-ink no-underline hover:text-maroon hover:underline">{name}</Link>
            : <span className="font-semibold text-ink">{name}</span>}
          {handle && <span className="text-muted">{handle}</span>}
          <AuthorBadge author={author} />
        </div>
        {meta && <div className="text-xs leading-snug text-muted">{meta}</div>}
      </div>
    </div>
  );
}

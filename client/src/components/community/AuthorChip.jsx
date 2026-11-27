import { Fragment } from 'react';
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

// The one identity row: avatar · name · seal · handle · time, on a single line that
// truncates instead of wrapping. Every surface (feed card, detail, thread, reply) uses
// THIS — when each one built its own header, the same author rendered on one, two or
// three lines depending on width, which is what made the spacing look arbitrary.
//
// `badge` is the caller's <IdentityBadge/> node rather than an import, so this file and
// IdentityBadge (which needs Avatar from here) don't form an import cycle. The seal
// already encodes the role by colour, so the text role pill stays out of this row.
export default function AuthorChip({ author, meta, size = 'm', avatar = true, badge = null, collaborators = [] }) {
  const name = author?.display_name || 'Deleted account';
  const handle = author?.profile_url ? `@${author.profile_url.replace(/^\//, '')}` : null;
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      {avatar && <Avatar author={author} size={size} />}
      {/* With collaborators the row wraps (mt-identity--wrap) rather than truncating, and
          the seal sits right after the author it belongs to — after the co-author it read
          as theirs, and the author was the name that got cut ("Shub…"). */}
      <div className={`mt-identity ${collaborators.length ? 'mt-identity--wrap' : ''}`}>
        {author?.profile_url
          ? <Link to={author.profile_url} className="mt-identity__name">{name}</Link>
          : <span className="mt-identity__name">{name}</span>}
        {badge && <span className="mt-identity__seal">{badge}</span>}
        {collaborators.length > 0 && (
          <span className="mt-identity__collab">
            {' with '}
            {collaborators.map((c, i) => (
              <Fragment key={c.id}>
                {i > 0 && ' & '}
                {c.profile_url
                  ? <Link to={c.profile_url} className="mt-identity__name">{c.display_name}</Link>
                  : <span className="mt-identity__name">{c.display_name}</span>}
              </Fragment>
            ))}
          </span>
        )}
        {handle && <span className="mt-identity__handle">{handle}</span>}
        {meta && <span className="mt-identity__time">{meta}</span>}
      </div>
    </div>
  );
}

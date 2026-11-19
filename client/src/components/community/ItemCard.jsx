import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Briefcase, CircleCheck, CircleHelp, Lightbulb, Lock, Megaphone, MessageCircle, MessagesSquare, Pin, Share2,
} from 'lucide-react';
import { relTime } from '../../utils/relTime';
import AuthorChip from './AuthorChip';
import IdentityBadge from './IdentityBadge';
import LikeButton from './LikeButton';
import BookmarkButton from './BookmarkButton';
import LinkifiedText from './LinkifiedText';
import PostMenu from './PostMenu';

// Feed cards show the first BODY_PREVIEW chars, then an inline "see more" link. Inline so
// the truncation costs no extra row — a link on its own line is a whole band of dead height.
const BODY_PREVIEW = 256;

const SPACE_ICONS = { updates: Megaphone, help: CircleHelp, ideas: Lightbulb, 'host-corner': Briefcase, general: MessagesSquare };
export function SpaceIcon({ spaceKey, size = 20 }) {
  const Icon = SPACE_ICONS[spaceKey] || MessagesSquare;
  return <Icon size={size} aria-hidden="true" />;
}

export const TOMBSTONE = { deleted: '[deleted]', removed: '[removed]' };

async function share(item) {
  const url = `${window.location.origin}${item.url}`;
  try {
    if (navigator.share) await navigator.share({ url, title: item.title || 'Meeticulous Community' });
    else {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied');
    }
  } catch { /* share sheet dismissed */ }
}

function Photos({ media, author }) {
  if (!media?.length) return null;
  return (
    <div className={`grid gap-3 ${media.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
      {media.map((m, i) => (
        <img
          key={m.url}
          src={m.url}
          alt={m.alt || `Photo ${i + 1} of ${media.length} from ${author?.display_name || 'a member'}`}
          width={m.width || undefined}
          height={m.height || undefined}
          loading="lazy"
          className="h-auto max-h-96 w-full rounded-lg bg-blush object-cover"
        />
      ))}
    </div>
  );
}

// One cell of the action row. Each cell is an equal-width flex child so the row divides the
// card evenly instead of clumping left. Wrapping also keeps a button's sibling terms dialog
// (LikeButton / BookmarkButton render a fragment) out of the row's own flex layout.
function Cell({ children }) {
  return <span className="mt-actionrow__cell">{children}</span>;
}

// One feed/detail card. `detail` = full text, h1 title, Reply action (onReply).
// `actions` (detail only) = node for the More menu, built by the page that owns edit/delete/report.
export default function ItemCard({ item, detail = false, onReply, actions, onHide, onReport, viewerId, canPin = false }) {
  if (TOMBSTONE[item.status]) {
    return (
      <article data-testid="item-card" className="mt-card mt-card--feed">
        <p className="mt-post__meta">{TOMBSTONE[item.status]}</p>
      </article>
    );
  }

  // Locked membership teaser (M4): body/media/comments are server-withheld; show the
  // author, title, teaser line, lock chip and a Join CTA. The CTA opens the host profile
  // (membership space lands in M5).
  if (item.locked) {
    const chip = item.lock?.audience === 'free_subscribers' ? 'Free subscribers'
      : (item.lock?.tier_name ? `${item.lock.tier_name} members` : 'Members only');
    const cta = item.lock?.audience === 'free_subscribers' ? 'Subscribe free to read'
      : (item.lock?.tier_name ? `Join ${item.lock.tier_name} to unlock` : 'Join to unlock');
    // Open the host's membership space (profile_url is "/<username>").
    const joinTo = item.author?.profile_url ? `${item.author.profile_url}/membership` : '#';
    return (
      <article data-testid="item-card" aria-label="Members-only post" className="mt-card mt-card--feed">
        <AuthorChip author={item.author} badge={<IdentityBadge author={item.author} />} />
        <span className="mt-post__chip self-start">
          <Lock size={13} aria-hidden="true" />{chip}
        </span>
        {item.title && <h3 className="mt-post__title">{item.title}</h3>}
        {item.teaser && <p className="mt-post__body text-muted">{item.teaser}…</p>}
        <Link to={joinTo} className="mt-btn mt-btn--primary mt-btn--s self-start gap-2 no-underline">
          <Lock size={15} aria-hidden="true" />{cta}
        </Link>
      </article>
    );
  }

  const thread = item.kind === 'thread';
  const pinned = item.is_pinned && !detail;
  const question = item.format === 'question';
  const isOwn = !!viewerId && item.author?.id === viewerId;
  // Feed cards carry the "⋯" viewer menu; detail keeps its own author edit/delete actions.
  const menu = !detail && onReport ? <PostMenu item={item} onHide={onHide} onReport={onReport} isOwn={isOwn} canPin={canPin} /> : null;
  const label = item.title || item.author?.display_name || 'Post';
  // No "Announcement" tag — the role badge + space carry context now.
  const meta = [relTime(item.created_at), item.edited_at && 'edited'].filter(Boolean).join(' · ');
  const long = !detail && typeof item.body === 'string' && item.body.length > BODY_PREVIEW;
  const bodyText = long ? `${item.body.slice(0, BODY_PREVIEW).trimEnd()}…` : item.body;

  const space = item.space && (
    <Link to={`/community/s/${item.space.key}`} className="mt-post__chip">
      <SpaceIcon spaceKey={item.space.key} size={14} />{item.space.name}
    </Link>
  );

  return (
    <article data-testid="item-card" aria-label={pinned ? 'Pinned post' : label} className={`mt-card mt-card--feed ${pinned ? 'mt-card--blush' : ''}`}>
      {pinned && (
        <div className="mt-post__meta flex items-center gap-2 text-maroon">
          <Pin size={14} aria-hidden="true" />{item.space ? `Pinned in ${item.space.name}` : 'Pinned'}
        </div>
      )}

      {thread && !detail ? (
        <>
          <div className="flex flex-wrap items-center gap-3">
            {space}
            <span className="mt-post__meta">Thread · last reply {relTime(item.last_activity_at)}</span>
          </div>
          <Link to={item.url} className="mt-post__title">{item.title}</Link>
          <p className="mt-post__body line-clamp-3 text-muted">{item.body}</p>
          <div className="flex items-center gap-3">
            <AuthorChip author={item.author} size="s" badge={<IdentityBadge author={item.author} />} />
            {menu && <span className="shrink-0">{menu}</span>}
          </div>
        </>
      ) : (
        <>
          {detail && (question || item.accepted_comment_id) && (
            <div className="flex flex-wrap gap-2">
              {question && <span className="mt-badge mt-badge--s"><CircleHelp size={16} aria-hidden="true" />Question</span>}
              {item.accepted_comment_id && <span className="mt-badge mt-badge--s mt-badge--success"><CircleCheck size={16} aria-hidden="true" />Answered</span>}
            </div>
          )}
          {detail && item.title && (
            <h1 className="font-display text-3xl font-extrabold leading-tight tracking-tight text-maroon sm:text-4xl">{item.title}</h1>
          )}
          {/* One identity row for both views. The "⋯" is anchored to the card edge and
              never competes with the name for space. */}
          <div className="flex items-center gap-3">
            <AuthorChip author={item.author} meta={meta} badge={<IdentityBadge author={item.author} />} />
            {menu && <span className="shrink-0">{menu}</span>}
          </div>
          {/* Chips sit on their own row: inside the identity line they were what pushed
              the time, and then the handle, onto lines of their own. */}
          {((!detail && question) || (detail && !item.title && space)) && (
            <div className="flex flex-wrap items-center gap-2">
              {!detail && question && <span className="mt-badge mt-badge--s"><CircleHelp size={14} aria-hidden="true" />Question</span>}
              {detail && !item.title && space}
            </div>
          )}
          <p className="mt-post__body">
            <LinkifiedText text={bodyText} />
            {long && <> <Link to={item.url} className="mt-post__more">see more</Link></>}
          </p>
          <Photos media={item.media} author={item.author} />
        </>
      )}

      <div className="mt-actionrow">
        <Cell><LikeButton targetType="post" id={item.id} liked={item.viewer?.liked} count={item.like_count} /></Cell>
        <Cell>
          {detail ? (
            <button type="button" onClick={() => onReply?.(null)} className="mt-btn mt-btn--ghost mt-btn--s">
              <MessageCircle size={16} aria-hidden="true" />Reply
            </button>
          ) : (
            <Link
              to={item.url}
              aria-label={`${item.comment_count} ${item.comment_count === 1 ? 'reply' : 'replies'}, open ${thread ? 'thread' : 'post'}`}
              className="mt-btn mt-btn--ghost mt-btn--s no-underline"
            >
              <MessageCircle size={16} aria-hidden="true" />{item.comment_count}
            </Link>
          )}
        </Cell>
        <Cell>
          <button type="button" onClick={() => share(item)} className="mt-btn mt-btn--ghost mt-btn--s">
            <Share2 size={16} aria-hidden="true" />Share
          </button>
        </Cell>
        {!detail && <Cell><BookmarkButton id={item.id} saved={item.viewer?.saved} count={item.save_count} /></Cell>}
        {detail && actions && <span className="ml-auto pl-3">{actions}</span>}
      </div>
    </article>
  );
}

import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Briefcase, CircleCheck, CircleHelp, Lightbulb, Megaphone, MessageCircle, MessagesSquare, Pin, Share2,
} from 'lucide-react';
import { relTime } from '../../utils/relTime';
import AuthorChip, { Avatar } from './AuthorChip';
import LikeButton from './LikeButton';
import LinkifiedText from './LinkifiedText';
import PostMenu from './PostMenu';

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

// One feed/detail card. `detail` = full text, h1 title, Reply action (onReply).
// `actions` (detail only) = node for the More menu, built by the page that owns edit/delete/report.
export default function ItemCard({ item, detail = false, onReply, actions, onHide, onReport, viewerId, canPin = false }) {
  if (TOMBSTONE[item.status]) {
    return (
      <article data-testid="item-card" className="mt-card p-5 sm:p-6">
        <p className="text-sm font-medium text-muted">{TOMBSTONE[item.status]}</p>
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
  const meta = [
    item.format === 'announcement' && 'Announcement',
    relTime(item.created_at),
    item.edited_at && 'edited',
  ].filter(Boolean).join(' · ');

  const space = item.space && (
    <Link to={`/community/s/${item.space.key}`} className="inline-flex h-6 items-center gap-2 rounded-full bg-neutral-100 px-3 text-xs font-medium text-ink no-underline hover:bg-pink-200 hover:text-maroon">
      <SpaceIcon spaceKey={item.space.key} size={16} />{item.space.name}
    </Link>
  );

  return (
    <article data-testid="item-card" aria-label={pinned ? 'Pinned post' : label} className={`mt-card gap-5 p-5 sm:p-6 ${pinned ? 'mt-card--blush' : ''}`}>
      {pinned && (
        <div className="flex items-center gap-2 text-xs font-medium text-maroon">
          <Pin size={16} aria-hidden="true" />{item.space ? `Pinned in ${item.space.name}` : 'Pinned'}
        </div>
      )}

      {thread && !detail ? (
        <>
          <div className="flex flex-wrap items-center gap-3">
            {space}
            <span className="text-xs text-muted">Thread · last reply {relTime(item.last_activity_at)}</span>
          </div>
          <Link to={item.url} className="font-display text-xl font-extrabold leading-tight tracking-tight text-maroon no-underline hover:underline">
            {item.title}
          </Link>
          <p className="line-clamp-3 text-sm leading-relaxed text-muted">{item.body}</p>
          <div className="flex items-center gap-3">
            <Avatar author={item.author} size="s" />
            <AuthorChip author={item.author} avatar={false} />
            {menu && <span className="ml-auto">{menu}</span>}
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
          <div className="flex items-start gap-3">
            <AuthorChip author={item.author} meta={meta} size={pinned ? 's' : 'm'} />
            {!detail && question && <span className="mt-badge mt-badge--s shrink-0"><CircleHelp size={16} aria-hidden="true" />Question</span>}
            {menu && <span className="ml-auto">{menu}</span>}
          </div>
          {detail && !item.title && space && <div>{space}</div>}
          <p className={`text-sm leading-relaxed text-ink ${detail ? '' : 'line-clamp-6'}`}>
            <LinkifiedText text={item.body} />
          </p>
          {!detail && item.body.length > 400 && (
            <Link to={item.url} className="self-start text-sm font-medium text-maroon">Read more</Link>
          )}
          <Photos media={item.media} author={item.author} />
        </>
      )}

      <div className="flex flex-wrap items-center gap-1 border-t-2 border-ink/5 pt-3">
        <LikeButton targetType="post" id={item.id} liked={item.viewer?.liked} count={item.like_count} />
        {detail ? (
          <button type="button" onClick={() => onReply?.(null)} className="mt-btn mt-btn--ghost mt-btn--s gap-2 font-medium text-muted hover:text-maroon">
            <MessageCircle size={16} aria-hidden="true" />Reply
          </button>
        ) : (
          <Link
            to={item.url}
            aria-label={`${item.comment_count} ${item.comment_count === 1 ? 'reply' : 'replies'}, open ${thread ? 'thread' : 'post'}`}
            className="mt-btn mt-btn--ghost mt-btn--s gap-2 font-medium text-muted no-underline hover:text-maroon"
          >
            <MessageCircle size={16} aria-hidden="true" />{item.comment_count}
          </Link>
        )}
        <button type="button" onClick={() => share(item)} className="mt-btn mt-btn--ghost mt-btn--s gap-2 font-medium text-muted hover:text-maroon">
          <Share2 size={16} aria-hidden="true" />Share
        </button>
        {detail && actions && <span className="ml-auto">{actions}</span>}
      </div>
    </article>
  );
}

import { useState } from 'react';
import { CircleCheck, CornerDownRight } from 'lucide-react';
import { relTime } from '../../utils/relTime';
import AuthorChip, { Avatar } from './AuthorChip';
import LikeButton from './LikeButton';
import LinkifiedText from './LinkifiedText';
import { TOMBSTONE } from './ItemCard';
import MoreMenu from './MoreMenu';
import EditBox from './EditBox';
import { ConfirmDialog } from './Dialog';

const GONE_NOTE = { deleted: 'This reply was deleted by its author', removed: 'Removed by a moderator' };

// Flat replies, oldest first, with the accepted answer pinned to the top.
// Tombstones keep their place so the conversation still reads. `onReply(comment)` is the
// hook for the reply form; logged-out visitors are sent to log in first. Own replies get
// Edit / Delete (with confirmation) in a More menu; everyone else's get Report. The question
// author (`canAccept`) can mark one reply as the answer. All handlers are optional.
export default function CommentList({ comments, acceptedId, viewerId, canAccept, onReply, onEdit, onDelete, onReport, onAccept }) {
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);
  const byId = new Map(comments.map((c) => [c.id, c]));
  const accepted = comments.find((c) => c.id === acceptedId && !TOMBSTONE[c.status]);
  const ordered = accepted ? [accepted, ...comments.filter((c) => c !== accepted)] : comments;

  return (
    <>
    <ol className="flex list-none flex-col gap-4 p-0">
      {ordered.map((c) => {
        if (TOMBSTONE[c.status]) {
          return (
            <li key={c.id} id={`c-${c.id}`} className="flex gap-4 rounded-xl bg-neutral-100 p-5 sm:p-6">
              <Avatar author={null} />
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium text-muted">{TOMBSTONE[c.status]}</span>
                <span className="text-xs text-muted">{GONE_NOTE[c.status]} · {relTime(c.created_at)}</span>
              </div>
            </li>
          );
        }
        const parent = c.parent_id && byId.get(c.parent_id);
        const isAccepted = c === accepted;
        return (
          <li
            key={c.id}
            id={`c-${c.id}`}
            className={`flex gap-4 rounded-xl bg-white p-5 sm:p-6 ${isAccepted ? 'mt-card--accepted' : ''}`}
          >
            <Avatar author={c.author} />
            <div className="flex min-w-0 flex-1 flex-col gap-3">
              {parent && !TOMBSTONE[parent.status] && (
                <span className="inline-flex items-center gap-2 text-xs text-muted">
                  <CornerDownRight size={16} aria-hidden="true" />
                  Replying to <a href={`#c-${parent.id}`} className="font-medium text-maroon no-underline">{parent.author?.display_name}</a>
                </span>
              )}
              <div className="flex flex-wrap items-center gap-3">
                <AuthorChip author={c.author} avatar={false} meta={`${relTime(c.created_at)}${c.edited_at ? ' · edited' : ''}`} />
                {isAccepted && (
                  <span className="mt-badge mt-badge--s mt-badge--success"><CircleCheck size={16} aria-hidden="true" />Accepted answer</span>
                )}
              </div>
              {editing === c.id ? (
                <EditBox initial={{ body: c.body }} max={2000} onCancel={() => setEditing(null)} onSave={async (v) => { await onEdit(c, v.body); setEditing(null); }} />
              ) : (
                <p className="text-sm leading-relaxed text-ink"><LinkifiedText text={c.body} /></p>
              )}
              <div className="-mx-3 -mb-3 flex items-center gap-1">
                <LikeButton targetType="comment" id={c.id} liked={c.viewer?.liked} count={c.like_count} />
                <button type="button" onClick={() => onReply?.(c)} className="mt-btn mt-btn--ghost mt-btn--s font-medium text-muted hover:text-maroon">
                  Reply
                </button>
                {canAccept && !isAccepted && (
                  <button type="button" onClick={() => onAccept?.(c)} className="mt-btn mt-btn--ghost mt-btn--s font-medium text-muted hover:text-maroon">Mark as answer</button>
                )}
                <span className="ml-auto">
                  <MoreMenu
                    label="More actions for this reply"
                    items={c.author?.id && c.author.id === viewerId
                      ? [{ label: 'Edit', onSelect: () => setEditing(c.id) }, { label: 'Delete', onSelect: () => setDeleting(c) }]
                      : [{ label: 'Report reply', onSelect: () => onReport?.(c) }]}
                  />
                </span>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
    {deleting && (
      <ConfirmDialog
        title="Delete this reply?"
        text="It will be replaced by a note that the reply was deleted. This can't be undone."
        busy={busy}
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          setBusy(true);
          try { await onDelete(deleting); } finally { setBusy(false); setDeleting(null); }
        }}
      />
    )}
    </>
  );
}

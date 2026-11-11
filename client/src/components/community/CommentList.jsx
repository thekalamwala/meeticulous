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

// How deep we indent before flattening. Past this, replies render at the last indent
// level with a "Replying to X" breadcrumb instead — so a long back-and-forth can't push
// content off a phone screen. 3 levels reads as a thread without overflowing.
const MAX_DEPTH = 3;

// Nested reply tree. Replies carry parent_id (flat from the API); we group them into a
// tree and indent children under their parent, oldest first, with the accepted answer's
// whole subtree pinned to the top. A tombstone (deleted/removed) is kept ONLY when it has
// a visible descendant, so the child's thread context still reads; a childless tombstone
// is dropped (its row would exceed the visible comment_count in the heading). `onReply(comment)`
// opens the reply form; logged-out visitors are sent to log in first. Own replies get
// Edit / Delete (confirmed) in a More menu; others get Report. The question author
// (`canAccept`) can mark one reply as the answer. All handlers are optional.
export default function CommentList({ comments, acceptedId, viewerId, canAccept, onReply, onEdit, onDelete, onReport, onAccept }) {
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);

  const byId = new Map(comments.map((c) => [c.id, c]));
  // Children grouped by parent, preserving input order (oldest first). A reply whose parent
  // isn't in this page (deep pagination) is treated as a root so it never disappears.
  const kids = new Map();
  const roots = [];
  for (const c of comments) {
    const hasParent = c.parent_id && byId.has(c.parent_id);
    if (hasParent) (kids.get(c.parent_id) || kids.set(c.parent_id, []).get(c.parent_id)).push(c);
    else roots.push(c);
  }
  const childrenOf = (id) => kids.get(id) || [];

  // A node renders if it's visible, or it's a tombstone with at least one renderable
  // descendant (recursive — a tombstone under a tombstone still shows if a live reply
  // hangs below). Memoised across the render so the check isn't recomputed per node.
  const renderableCache = new Map();
  const isRenderable = (c) => {
    if (renderableCache.has(c.id)) return renderableCache.get(c.id);
    let ok;
    if (!TOMBSTONE[c.status]) ok = true;
    else ok = childrenOf(c.id).some(isRenderable);
    renderableCache.set(c.id, ok);
    return ok;
  };

  const accepted = acceptedId ? comments.find((c) => c.id === acceptedId && !TOMBSTONE[c.status]) : null;

  const actionsRow = (c) => (!c.pending && (
    <div className="-mx-3 -mb-3 flex items-center gap-1">
      <LikeButton targetType="comment" id={c.id} liked={c.viewer?.liked} count={c.like_count} />
      <button type="button" onClick={() => onReply?.(c)} className="mt-btn mt-btn--ghost mt-btn--s font-medium text-muted hover:text-maroon">
        Reply
      </button>
      {canAccept && c !== accepted && !TOMBSTONE[c.status] && (
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
  ));

  // Render one comment and (recursively) its renderable children. `depth` drives the indent;
  // `flattened` is true once we pass MAX_DEPTH — then we stop indenting and show the breadcrumb
  // so lineage is still clear. Tombstones render as a slim placeholder but still nest children.
  const renderNode = (c, depth, flattened) => {
    const children = childrenOf(c.id).filter(isRenderable);
    const parent = c.parent_id && byId.get(c.parent_id);
    const isAccepted = c === accepted;

    const node = TOMBSTONE[c.status] ? (
      <li key={c.id} id={`c-${c.id}`} className="flex gap-4 rounded-xl bg-neutral-100 p-5 sm:p-6">
        <Avatar author={null} />
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-muted">{TOMBSTONE[c.status]}</span>
          <span className="text-xs text-muted">{GONE_NOTE[c.status]} · {relTime(c.created_at)}</span>
        </div>
      </li>
    ) : (
      <li key={c.id} id={`c-${c.id}`} className={`flex gap-4 rounded-xl bg-white p-5 sm:p-6 ${isAccepted ? 'mt-card--accepted' : ''}`}>
        <Avatar author={c.author} />
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          {/* Breadcrumb only when the reply was flattened (indent no longer shows its parent)
              and the parent is a real, visible comment. Nested replies skip it — the indent is the cue. */}
          {flattened && parent && !TOMBSTONE[parent.status] && (
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
          {/* A still-saving reply has a temp id the server would 400 on, so hide every action. */}
          {actionsRow(c)}
        </div>
      </li>
    );

    if (!children.length) return node;
    // Indent the child list with a left rail — unless we've hit the cap, then render the
    // children at this same level (flattened) so the thread can't run off a narrow screen.
    const childFlattened = flattened || depth + 1 > MAX_DEPTH;
    return (
      <li key={`${c.id}-g`} className="list-none">
        <ol className="flex list-none flex-col gap-4 p-0">{node}</ol>
        <ol className={`flex list-none flex-col gap-4 p-0 ${childFlattened ? 'mt-4' : 'mt-4 border-l-2 border-blush pl-3 sm:pl-6'}`}>
          {children.map((k) => renderNode(k, depth + 1, childFlattened))}
        </ol>
      </li>
    );
  };

  // Accepted subtree first (pinned to top, pulled out of its natural spot so it isn't
  // rendered twice); then the remaining roots, oldest first.
  const topRoots = accepted
    ? [accepted, ...roots.filter((c) => c.id !== accepted.id)]
    : roots;
  const visibleRoots = topRoots.filter(isRenderable);
  // When the accepted answer is a nested reply, skip it wherever it appears as a descendant
  // (it's shown pinned at top instead). Done by filtering it out of childrenOf results above
  // would be cleaner, but it's always a root in practice; guard anyway:
  const skipId = accepted && !roots.includes(accepted) ? accepted.id : null;
  const renderRoot = (c) => (skipId && c.id === skipId ? null : renderNode(c, 0, false));

  return (
    <>
      <ol className="flex list-none flex-col gap-4 p-0">
        {visibleRoots.map(renderRoot)}
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

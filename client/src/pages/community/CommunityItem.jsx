import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ChevronRight, LogIn, Plus } from 'lucide-react';
import Seo from '../../components/common/Seo';
import ErrorPage from '../ErrorPage';
import { acceptAnswer, deleteComment, deleteItem, getComments, getItem, updateComment, updateItem } from '../../services/communityApi';
import { analytics, EVENTS } from '../../services/analytics';
import { useAuth } from '../../context/AuthContext';
import { SITE_URL } from '../../utils/seo';
import { communityBreadcrumbJsonLd, discussionForumPostingJsonLd, headlineOf, qaPageJsonLd } from '../../utils/communitySeo';
import ItemCard from '../../components/community/ItemCard';
import CommentList from '../../components/community/CommentList';
import useRequireLogin, { loginHref } from '../../components/community/useRequireLogin';
import Composer from '../../components/community/Composer';
import CommentForm from '../../components/community/CommentForm';
import ReportDialog from '../../components/community/ReportDialog';
import MoreMenu from '../../components/community/MoreMenu';
import EditBox from '../../components/community/EditBox';
import { ConfirmDialog } from '../../components/community/Dialog';
import { errorCopy } from '../../components/community/communityErrors';
import CommunityLayout, { ListStatus, TITLE_SUFFIX, flat } from './CommunityLayout';

function SpaceCard({ space, onCompose }) {
  return (
    <section className="mt-card mt-card--s" aria-labelledby="space-card-title">
      <span className="mt-card__kicker">Space</span>
      <h2 id="space-card-title" className="mt-card__title">{space.name}</h2>
      {space.description && <p className="mt-card__body">{space.description}</p>}
      {space.post_policy !== 'official' && (
        <button type="button" onClick={() => onCompose('thread')} className="mt-btn mt-btn--secondary mt-btn--s mt-btn--block">
          <Plus size={16} aria-hidden="true" />{space.key === 'help' ? 'Ask a question' : 'Start a thread'}
        </button>
      )}
    </section>
  );
}

export default function CommunityItem() {
  const { slug } = useParams();
  const { user } = useAuth();
  const loc = useLocation();
  const navigate = useNavigate();
  const requireLogin = useRequireLogin();
  const [s, setS] = useState({ loading: true, status: null });
  const [more, setMore] = useState(false);
  const [composeKind, setComposeKind] = useState(null);
  const [parent, setParent] = useState(null); // comment being answered (null = the post)
  const [tick, setTick] = useState(0);
  const [editing, setEditing] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [reporting, setReporting] = useState(null);
  const [pendingScroll, setPendingScroll] = useState(null);

  const load = useCallback(() => {
    let live = true;
    setS({ loading: true, status: null });
    getItem(slug)
      .then((d) => live && setS({ loading: false, status: 200, item: d.item, space: d.space, comments: d.comments || [], cursor: d.next_comment_cursor }))
      .catch((e) => live && setS({ loading: false, status: e?.response?.status || 0 }));
    return () => { live = false; };
  }, [slug]);
  useEffect(load, [load]);

  const item = s.item;
  useEffect(() => {
    if (!item) return;
    if (item.url !== loc.pathname) navigate(item.url, { replace: true }); // wrong t/p prefix
    analytics.track(EVENTS.COMMUNITY_VIEWED, { space: item.space?.key || null, item: item.id });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id]);

  const loadMore = async () => {
    setMore(true);
    try {
      const d = await getComments({ slug, cursor: s.cursor });
      setS((p) => ({ ...p, comments: [...p.comments, ...(d.comments || [])], cursor: d.next_cursor }));
    } catch {
      setS((p) => ({ ...p, cursor: null }));
    } finally {
      setMore(false);
    }
  };

  const reply = (c) => {
    if (!requireLogin()) return;
    setParent(c || null);
    setTick((t) => t + 1);
  };
  const compose = (kind = 'post') => { if (requireLogin()) setComposeKind(kind); };
  const report = (target) => { if (requireLogin()) setReporting(target); };

  // A new reply is appended in place (no refetch) and scrolled to once it has rendered.
  const added = (comment) => {
    setS((p) => ({ ...p, comments: [...p.comments, comment], item: { ...p.item, comment_count: p.item.comment_count + 1 } }));
    setParent(null);
    setPendingScroll(comment.id);
  };
  useEffect(() => {
    if (!pendingScroll) return;
    const el = document.getElementById(`c-${pendingScroll}`);
    el?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
    setPendingScroll(null);
  }, [pendingScroll]);

  const patchComment = (id, patch) => setS((p) => ({ ...p, comments: p.comments.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));
  const guardWrite = async (fn) => {
    try { return await fn(); } catch (e) { toast.error(errorCopy(e, user)); throw e; }
  };
  const editComment = async (c, body) => {
    const { comment } = await updateComment(c.id, { body }); // EditBox shows the error / NOT_EDITABLE toast
    patchComment(c.id, { body: comment.body, edited_at: comment.edited_at });
  };
  const removeComment = async (c) => {
    try {
      await deleteComment(c.id);
      patchComment(c.id, { status: 'deleted', body: '' });
    } catch (e) { toast.error(errorCopy(e, user)); }
  };
  const markAnswer = async (c) => {
    try {
      const d = await acceptAnswer(item.id, c.id);
      setS((p) => ({ ...p, item: { ...p.item, accepted_comment_id: d.accepted_comment_id } }));
    } catch (e) { toast.error(errorCopy(e, user)); }
  };
  const saveItem = async (v) => {
    const d = await updateItem(item.id, v);
    setS((p) => ({ ...p, item: { ...p.item, ...d.item } }));
    setEditing(false);
  };
  const removeItem = async () => {
    try {
      await guardWrite(() => deleteItem(item.id));
      toast.success('Deleted');
      navigate('/community', { replace: true });
    } catch { setConfirmDel(false); }
  };

  if (s.status === 404) return <ErrorPage code={404} />;

  if (s.status === 410) {
    return (
      <CommunityLayout active={null} onCompose={compose}>
        <Seo title={`This post was removed${TITLE_SUFFIX}`} description="This post is no longer available." robots="noindex,follow" />
        <div className="mt-card items-start">
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-maroon">This post was removed.</h1>
          <p className="text-sm text-muted">It's no longer available. There's plenty more to read in the community.</p>
          <Link to="/community" className="mt-btn no-underline">Back to the community</Link>
        </div>
        <Composer open={!!composeKind} defaultKind={composeKind} onClose={() => setComposeKind(null)} />
      </CommunityLayout>
    );
  }

  if (!item) {
    return <CommunityLayout active={null} onCompose={compose}><ListStatus list={{ ...s, items: [], reload: load }} /></CommunityLayout>;
  }

  const own = !!user && !!item.author?.id && item.author.id === user.id;
  const questionOwner = own && item.format === 'question';
  const repliesLocked = s.space?.reply_policy === 'hosts' && !!user && !user.is_host;
  const itemMenu = (
    <MoreMenu
      label="More actions for this post"
      items={own
        ? [{ label: 'Edit', onSelect: () => setEditing(true) }, { label: 'Delete', onSelect: () => setConfirmDel(true) }]
        : [{ label: item.kind === 'thread' ? 'Report thread' : 'Report post', onSelect: () => report({ type: 'post', id: item.id }) },
          ...(item.author?.id ? [{ label: 'Report author', onSelect: () => report({ type: 'member', id: item.author.id }) }] : [])]}
    />
  );
  const label = item.title || flat(item.body).slice(0, 60);
  const space = s.space || item.space;
  return (
    <CommunityLayout active={item.space?.key || 'feed'} onCompose={compose} aside={s.space && <SpaceCard space={s.space} onCompose={compose} />}>
      <Seo
        title={`${label}${TITLE_SUFFIX}`}
        description={flat(item.body).slice(0, 155) || headlineOf(item)}
        canonical={`${SITE_URL}${item.url}`}
        robots={item.is_indexable ? 'index,follow' : 'noindex,follow'}
        image={item.media?.[0]?.url}
        ogType="article"
        jsonLd={[
          // Google: a Q&A page uses QAPage instead of (not alongside) DiscussionForumPosting.
          qaPageJsonLd(item, s.comments, SITE_URL) || discussionForumPostingJsonLd(item, s.comments, SITE_URL),
          communityBreadcrumbJsonLd(item, item.space, SITE_URL),
        ]}
      />

      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-muted">
        <Link to="/community" className="text-muted no-underline hover:text-maroon hover:underline">Community</Link>
        {space && (
          <>
            <ChevronRight size={16} aria-hidden="true" />
            <Link to={`/community/s/${space.key}`} className="text-muted no-underline hover:text-maroon hover:underline">{space.name}</Link>
          </>
        )}
      </nav>

      {!item.title && <h1 className="sr-only">{headlineOf(item)}</h1>}
      {editing ? (
        <div className="mt-card gap-4 p-5 sm:p-6">
          <EditBox initial={item} max={item.kind === 'thread' ? 10000 : 1000} withTitle={item.kind === 'thread'} onSave={saveItem} onCancel={() => setEditing(false)} />
        </div>
      ) : (
        <ItemCard item={item} detail onReply={reply} actions={itemMenu} />
      )}

      <h2 className="mt-2 font-display text-xl font-extrabold tracking-tight text-maroon">
        {item.comment_count} {item.comment_count === 1 ? 'reply' : 'replies'}
      </h2>
      <CommentList
        comments={s.comments}
        acceptedId={item.accepted_comment_id}
        viewerId={user?.id}
        canAccept={questionOwner}
        onReply={reply}
        onEdit={editComment}
        onDelete={removeComment}
        onReport={(c) => report({ type: 'comment', id: c.id })}
        onAccept={markAnswer}
      />
      {s.cursor && (
        <button type="button" onClick={loadMore} disabled={more} className="mt-btn mt-btn--secondary mt-btn--s self-center">
          {more ? 'Loading…' : 'Show more replies'}
        </button>
      )}

      {user && repliesLocked && (
        <p className="rounded-xl bg-blush p-5 text-sm text-ink sm:p-6">Only hosts can reply in this space.</p>
      )}
      {user && !repliesLocked && (
        <CommentForm itemId={item.id} parent={parent} focusTick={tick} onCreated={added} onCancel={() => setParent(null)} />
      )}

      {!user && (
        <div className="flex flex-col items-start gap-4 rounded-xl bg-blush p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <p className="text-sm text-ink">Join the conversation. It takes a minute.</p>
          <Link to={loginHref(loc)} className="mt-btn no-underline"><LogIn size={20} aria-hidden="true" />Log in to reply</Link>
        </div>
      )}

      <Composer open={!!composeKind} defaultKind={composeKind} defaultSpaceKey={item.space?.key} onClose={() => setComposeKind(null)} />
      {reporting && <ReportDialog target={reporting} onClose={() => setReporting(null)} />}
      {confirmDel && (
        <ConfirmDialog title="Delete this post?" text="It will disappear from the community. This can't be undone." onConfirm={removeItem} onClose={() => setConfirmDel(false)} />
      )}
    </CommunityLayout>
  );
}

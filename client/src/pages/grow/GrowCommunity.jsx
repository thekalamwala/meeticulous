// Grow → Community — the host's view of /community, as one Grow tab with three
// views over the old routes: Activity (/activity; Mentions is a filter inside it,
// and /mentions opens it on that filter), Answer and Spaces. Same reads as the
// four old pages (communityApi), same gate (the routes stay inside SectionsRoute).
// Nothing here moderates or posts: rows open the thread on /community.
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, ChevronRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getAuthorActivity, getFeed, getMentions, getSpaces } from '../../services/communityApi';
import { ErrorState, Skeleton } from '../../components/dashboard/ui';
import { useRegisterRefresh } from '../../components/dashboard/ui/refreshContext';
import { Avatar, Tile, cn, relDay } from '../../components/dashboard/ui/v2';
import GrowShell, {
  Empty, PinnedBar, btnPrimary, btnSoft, card, ring, rowBase, tappable, useIsDesktop,
} from './GrowShell';

const VIEWS = [
  { key: 'activity', to: '/dashboard/community/activity', label: 'Activity' },
  { key: 'answer', to: '/dashboard/community/answer', label: 'Answer' },
  { key: 'spaces', to: '/dashboard/community/spaces', label: 'Spaces' },
];
const snippet = (s, n = 160) => { const t = String(s || '').replace(/\s+/g, ' ').trim(); return t.length > n ? `${t.slice(0, n)}…` : t; };
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
export const isOpenQuestion = (it) => it.format === 'question' && !it.accepted_comment_id && it.status === 'visible' && !it.locked;

// Activity filters. "Mentions" is the old Mentions page, folded in (founder, 2026-11-26).
export const ACTIVITY_FILTERS = [
  { key: 'all', label: 'All' }, { key: 'posts', label: 'Posts' },
  { key: 'comments', label: 'Comments' }, { key: 'mentions', label: 'Mentions' },
];

// One list from the three sources, newest first. Pure, tested.
export const activityRows = ({ posts = [], comments = [], mentions = [] }, filter = 'all') => {
  const rows = [
    ...(filter === 'all' || filter === 'posts' ? posts.map((p) => ({
      id: `p-${p.id}`, kind: 'Post', to: p.url || '/community', title: p.title || snippet(p.body, 80), body: p.title ? p.body : null, at: p.created_at,
      meta: [p.space?.name, plural(p.like_count || 0, 'like'), plural(p.comment_count || 0, 'reply', 'replies')].filter(Boolean).join(' · '),
    })) : []),
    ...(filter === 'all' || filter === 'comments' ? comments.map((c) => ({
      id: `c-${c.id}`, kind: 'Comment', to: c.parent?.url || '/community', title: c.parent?.title ? `On: ${c.parent.title}` : 'Your comment', body: c.body, at: c.created_at,
      meta: plural(c.like_count || 0, 'like'),
    })) : []),
    ...(filter === 'all' || filter === 'mentions' ? mentions.map((m) => ({
      id: `m-${m.id}`, kind: 'Mention', to: m.post?.url || '/community', title: m.post?.title || snippet(m.snippet, 80), body: m.post?.title ? m.snippet : null, at: m.created_at,
      meta: `${m.author?.display_name || 'Someone'} named you`,
    })) : []),
  ];
  return rows.sort((a, b) => new Date(b.at) - new Date(a.at));
};

const ViewChips = ({ view }) => (
  <div className="flex gap-2 overflow-x-auto dash-noscrollbar" role="navigation" aria-label="Community">
    {VIEWS.map((v) => (
      <Link key={v.key} to={v.to} aria-current={v.key === view ? 'page' : undefined}
        className={cn('inline-flex h-10 shrink-0 items-center rounded-[12px] px-4 text-[13.5px] font-semibold transition-colors', ring, tappable,
          v.key === view ? 'bg-ink text-white' : 'bg-white text-muted hover:bg-blush hover:text-maroon')}>
        {v.label}
      </Link>
    ))}
  </div>
);

const Row = ({ to, kind, title, body, meta, at }) => (
  <li>
    <Link to={to} className={cn(rowBase, 'items-start py-3.5')}>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          {kind && <span className="shrink-0 rounded-[8px] bg-cream px-2 py-0.5 text-[12px] font-semibold text-muted">{kind}</span>}
          <span className="truncate text-[12.5px] text-muted">{relDay(at)}</span>
        </span>
        <span className="mt-1 block truncate text-[14.5px] font-semibold text-ink">{title}</span>
        {body && <span className="mt-0.5 block truncate text-[13px] text-ink/70">{snippet(body, 120)}</span>}
        {meta && <span className="mt-0.5 block truncate text-[12.5px] text-muted">{meta}</span>}
      </span>
      <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-faint" strokeWidth={2} />
    </Link>
  </li>
);

const ListCard = ({ children, label }) => (
  <section aria-label={label} className={cn(card, 'overflow-hidden')}>{children}</section>
);
const Loading = () => (
  <div className="flex flex-col gap-3"><Skeleton className="h-[120px] rounded-[20px]" /><Skeleton className="h-[260px] rounded-[24px]" /></div>
);
const openCommunity = (label = 'Open the community') => (
  <Link to="/community" className={cn(btnSoft, tappable)}>{label} <ArrowUpRight className="h-4 w-4" strokeWidth={2.2} /></Link>
);

/* ── Activity (+ Mentions) ─────────────────────────────────────────────── */
const Activity = ({ initialFilter }) => {
  const { user } = useAuth();
  const [filter, setFilter] = useState(initialFilter);
  const [data, setData] = useState(undefined);
  useEffect(() => { setFilter(initialFilter); }, [initialFilter]);
  const load = useCallback(() => Promise.all([
    getAuthorActivity(user.id),
    getMentions().catch(() => null), // mentions failing must not hide your own activity
  ]).then(([a, m]) => setData({ posts: a?.posts || [], comments: a?.comments || [], mentions: m?.items || [], mentionsFailed: m === null }))
    .catch(() => setData(null)), [user?.id]);
  useEffect(() => { if (user?.id) load(); }, [load, user?.id]);
  useRegisterRefresh(load);

  if (data === undefined) return <Loading />;
  if (data === null) return <ErrorState message="Couldn't load your community activity." onRetry={load} />;

  const likes = data.posts.reduce((n, p) => n + (p.like_count || 0), 0) + data.comments.reduce((n, c) => n + (c.like_count || 0), 0);
  const replies = data.posts.reduce((n, p) => n + (p.comment_count || 0), 0);
  const rows = activityRows(data, filter);
  const counts = { all: activityRows(data).length, posts: data.posts.length, comments: data.comments.length, mentions: data.mentions.length };
  const nothing = counts.all === 0;
  const EMPTY = {
    all: ['No community activity yet', 'Posts and replies you write, and posts that name you, show here.'],
    posts: ['No posts yet', 'Ask a question or share what worked for you.'],
    comments: ['No comments yet', 'A helpful reply is the fastest way to get known.'],
    mentions: [data.mentionsFailed ? "Couldn't load your mentions" : 'No mentions yet', data.mentionsFailed ? 'Pull down to try again.' : 'When someone names you in a post, it shows here.'],
  };

  return (
    <>
      {!nothing && (
        <div className="grid grid-cols-3 gap-3 lg:gap-4">
          <Tile label="Posts" value={data.posts.length} hint="Recent" />
          <Tile label="Replies" value={replies} hint="On your posts" />
          <Tile label="Likes" value={likes} hint="Posts and comments" />
        </div>
      )}
      <ListCard label="Your activity">
        <div role="tablist" aria-label="Show" className="grid grid-cols-4 gap-1 border-b border-neutral-200 p-2">
          {ACTIVITY_FILTERS.map((f) => {
            const on = filter === f.key;
            return (
              <button key={f.key} type="button" role="tab" aria-selected={on} onClick={() => setFilter(f.key)}
                className={cn('inline-flex h-10 min-w-0 items-center justify-center gap-1 rounded-[10px] px-1 text-[13px] font-semibold transition-colors', ring, tappable,
                  on ? 'bg-maroon text-white' : 'text-muted hover:bg-blush hover:text-maroon')}>
                <span className="truncate">{f.label}</span>
                <span className={cn('hidden rounded-[6px] px-1 text-[12px] tabular-nums sm:inline', on ? 'bg-white/20' : 'bg-cream')}>{counts[f.key]}</span>
              </button>
            );
          })}
        </div>
        {rows.length === 0
          ? <Empty compact title={EMPTY[filter][0]} body={EMPTY[filter][1]} action={nothing ? openCommunity() : null} />
          : <ul className="divide-y divide-neutral-200">{rows.map((r) => <Row key={r.id} {...r} />)}</ul>}
      </ListCard>
    </>
  );
};

/* ── Answer — open questions without an accepted answer ────────────────── */
const Answer = () => {
  const [items, setItems] = useState(undefined);
  const [cursor, setCursor] = useState(null);
  const [more, setMore] = useState(false);
  const [moreErr, setMoreErr] = useState(false);
  const byNewest = (a, b) => new Date(b.created_at) - new Date(a.created_at);
  const load = useCallback(() => getFeed({ tab: 'everyone' })
    .then((r) => { setItems((r.items || []).filter(isOpenQuestion).sort(byNewest)); setCursor(r.next_cursor || null); })
    .catch(() => setItems(null)), []);
  useEffect(() => { load(); }, [load]);
  useRegisterRefresh(load);
  const loadMore = async () => {
    setMore(true); setMoreErr(false);
    try {
      const r = await getFeed({ tab: 'everyone', cursor });
      setItems((prev) => [...prev, ...(r.items || []).filter(isOpenQuestion)].sort(byNewest));
      setCursor(r.next_cursor || null);
    } catch { setMoreErr(true); }
    setMore(false);
  };

  if (items === undefined) return <Loading />;
  if (items === null) return <ErrorState message="Couldn't load community questions." onRetry={load} />;
  const unanswered = items.filter((i) => !i.comment_count).length;
  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:gap-4">
        <Tile label="Open questions" value={items.length || null} note="None right now" hint="No accepted answer yet" />
        <Tile label="No replies yet" value={unanswered || null} note="Every one has a reply" hint={unanswered ? 'Be the first to help' : 'Check back soon'} />
      </div>
      <ListCard label="Open questions">
        {items.length === 0
          ? <Empty compact title="No open questions right now" body={cursor ? 'None in the latest posts. Load older ones below.' : 'Every question has an accepted answer. Check back soon.'} />
          : (
            <ul className="divide-y divide-neutral-200">
              {items.map((q) => (
                <li key={q.id}>
                  <Link to={q.url} className={cn(rowBase, 'items-start py-3.5')}>
                    <Avatar name={q.author?.display_name} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14.5px] font-semibold text-ink">{q.title || snippet(q.body, 80)}</span>
                      {q.title && q.body && <span className="mt-0.5 block truncate text-[13px] text-ink/70">{snippet(q.body, 120)}</span>}
                      <span className="mt-0.5 block truncate text-[12.5px] text-muted">{[q.author?.display_name, relDay(q.created_at), q.space?.name].filter(Boolean).join(' · ')}</span>
                    </span>
                    <span className={cn('mt-0.5 shrink-0 rounded-[8px] px-2 py-0.5 text-[12px] font-semibold', q.comment_count ? 'bg-cream text-muted' : 'bg-pink-100 text-maroon')}>
                      {q.comment_count ? plural(q.comment_count, 'reply', 'replies') : 'No replies'}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        {(cursor || moreErr) && (
          <div className="flex items-center justify-center gap-3 border-t border-neutral-200 p-3">
            {moreErr && <span className="text-[13px] text-muted">Couldn&apos;t load more.</span>}
            <button type="button" onClick={loadMore} disabled={more} className={btnSoft}>{more ? 'Loading…' : 'Load older posts'}</button>
          </div>
        )}
      </ListCard>
    </>
  );
};

/* ── Spaces — the rooms, and whether you can post in each ──────────────── */
// Mirrors the server's canPost: 'official' = team only; 'everyone'/'hosts' = a host can.
const canPost = (s) => s.post_policy !== 'official';
const Spaces = () => {
  const [spaces, setSpaces] = useState(undefined);
  const load = useCallback(() => getSpaces().then((r) => setSpaces(r.spaces || [])).catch(() => setSpaces(null)), []);
  useEffect(() => { load(); }, [load]);
  useRegisterRefresh(load);
  if (spaces === undefined) return <Skeleton className="h-[260px] rounded-[24px]" />;
  if (spaces === null) return <ErrorState message="Couldn't load community spaces." onRetry={load} />;
  return (
    <ListCard label="Spaces">
      {spaces.length === 0 ? <Empty compact title="No spaces yet" body="Community rooms will show here." /> : (
        <ul className="divide-y divide-neutral-200">
          {spaces.map((s) => (
            <li key={s.key}>
              <Link to={`/community/s/${encodeURIComponent(s.key)}`} className={cn(rowBase, 'py-3.5')}>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14.5px] font-semibold text-ink">{s.name}</span>
                  {s.description && <span className="mt-0.5 block truncate text-[13px] text-muted">{s.description}</span>}
                </span>
                <span className={cn('shrink-0 rounded-[8px] px-2 py-0.5 text-[12px] font-semibold', canPost(s) ? 'bg-success-bg text-success-fg' : 'bg-neutral-100 text-ink/60')}>
                  {canPost(s) ? 'You can post' : 'Team only'}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </ListCard>
  );
};

export default function GrowCommunity({ view = 'activity' }) {
  const isDesktop = useIsDesktop();
  // /dashboard/community/mentions keeps working: it opens Activity on Mentions.
  const shown = view === 'mentions' ? 'activity' : view;
  return (
    <GrowShell sub="Ask, answer and get known by other creators."
      action={isDesktop ? <Link to="/community/new" className={cn(btnPrimary, tappable)}>Write a post</Link> : null}>
      <ViewChips view={shown} />
      {shown === 'activity' && <Activity initialFilter={view === 'mentions' ? 'mentions' : 'all'} />}
      {shown === 'answer' && <Answer />}
      {shown === 'spaces' && <Spaces />}
      {!isDesktop && (
        <>
          <PinnedBar><Link to="/community/new" className={cn(btnPrimary, tappable, 'w-full')}>Write a post</Link></PinnedBar>
          <div aria-hidden="true" className="h-14" />
        </>
      )}
    </GrowShell>
  );
}

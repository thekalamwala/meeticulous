// Community → Answer. Real GET /community/feed (tab=everyone), filtered client-side to
// question-format posts (item.format === 'question') that have no accepted answer
// (accepted_comment_id == null). Reply count is the real item.comment_count; questions with
// zero replies sort first signal-wise via the "No replies" tag, list order stays newest first.
// The feed is cursor-paged (20/page), so "Load more" walks next_cursor.
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { HelpCircle } from 'lucide-react';
import { getFeed } from '../../services/communityApi';
import { ErrorState, Skeleton, EmptyState } from '../../components/dashboard/ui';
import { PageHeading, Panel, SubNav, Tile, Avatar, relDay } from '../../components/dashboard/ui/v2';
import { COMMUNITY_NAV } from '../dashboardNav';

const snippet = (s, n = 160) => { const t = String(s || '').replace(/\s+/g, ' ').trim(); return t.length > n ? `${t.slice(0, n)}…` : t; };
const isOpenQuestion = (it) => it.format === 'question' && !it.accepted_comment_id && it.status === 'visible' && !it.locked;
const byNewest = (a, b) => new Date(b.created_at) - new Date(a.created_at);

const CommunityAnswer = () => {
  const [items, setItems] = useState(null);
  const [cursor, setCursor] = useState(null);
  const [err, setErr] = useState(false);
  const [more, setMore] = useState(false);
  const [moreErr, setMoreErr] = useState(false);

  const load = async () => {
    setErr(false);
    setItems(null);
    try {
      const r = await getFeed({ tab: 'everyone' });
      setItems((r.items || []).filter(isOpenQuestion).sort(byNewest));
      setCursor(r.next_cursor || null);
    } catch { setErr(true); }
  };
  useEffect(() => { load(); }, []);

  const loadMore = async () => {
    setMore(true);
    setMoreErr(false);
    try {
      const r = await getFeed({ tab: 'everyone', cursor });
      setItems((prev) => [...prev, ...(r.items || []).filter(isOpenQuestion)].sort(byNewest));
      setCursor(r.next_cursor || null);
    } catch { setMoreErr(true); }
    setMore(false);
  };

  const header = (
    <>
      <PageHeading title="Answer" sub="Open questions in the community — a helpful reply builds your name." />
    </>
  );

  if (err) return <div className="flex flex-col gap-4 sm:gap-6">{header}<ErrorState message="Couldn't load community questions." onRetry={load} /></div>;
  if (items === null) return <div className="flex flex-col gap-4 sm:gap-6">{header}<Skeleton className="h-20 rounded-xl" /><Skeleton className="h-64 rounded-xl" /></div>;

  const noReplies = items.filter((i) => !i.comment_count).length;

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      {header}

      <div className="grid grid-cols-2 gap-2">
        <Tile label="Open questions" value={items.length} hint="Without an accepted answer" accent />
        <Tile label="No replies yet" value={noReplies} hint="Be the first to help" />
      </div>

      <Panel title="Open questions in the community" subtitle="Newest first" flush>
        {items.length === 0 ? (
          <div className="p-3">
            <EmptyState icon={HelpCircle} title="No open questions right now"
              description={cursor ? 'None in the latest posts — load older ones below.' : 'Every question here has an accepted answer. Check back soon.'} />
          </div>
        ) : (
          <div className="overflow-hidden rounded-[8px]">
            {items.map((q) => (
              <Link key={q.id} to={q.url} className="flex items-start gap-2.5 border-b border-neutral-200 px-3 py-2.5 last:border-b-0 hover:bg-blush/50">
                <Avatar name={q.author?.display_name} />
                <div className="min-w-0 flex-1">
                  <p className="mb-0 text-[12.5px] font-bold text-ink">{q.title || snippet(q.body, 80)}</p>
                  {q.title && q.body && <p className="mb-0 mt-0.5 mt-post__meta">{snippet(q.body)}</p>}
                  <p className="mb-0 mt-1 mt-post__meta">
                    {q.author?.display_name} · {relDay(q.created_at)}{q.space ? ` · ${q.space.name}` : ''} · {q.comment_count || 0} {q.comment_count === 1 ? 'reply' : 'replies'}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
        {(cursor || moreErr) && (
          <div className="flex items-center justify-center gap-2 border-t border-neutral-200 p-2.5">
            {moreErr && <span className="mt-post__meta">Couldn't load more.</span>}
            <button type="button" onClick={loadMore} disabled={more} className="mt-btn">{more ? 'Loading…' : 'Load older posts'}</button>
          </div>
        )}
      </Panel>
    </div>
  );
};

export default CommunityAnswer;

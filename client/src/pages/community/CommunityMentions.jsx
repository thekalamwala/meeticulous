// Community → Mentions. Posts that @-mention the signed-in host, from getMentions()
// (cursor-paged, newest first). Field names read defensively.
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AtSign } from 'lucide-react';
import { getMentions } from '../../services/communityApi';
import { ErrorState, Skeleton, EmptyState } from '../../components/dashboard/ui';
import { Avatar, PageHeading, Panel, SubNav, relDay } from '../../components/dashboard/ui/v2';
import { COMMUNITY_NAV } from '../dashboardNav';

const CommunityMentions = () => {
  const [items, setItems] = useState(null);
  const [cursor, setCursor] = useState(null);
  const [err, setErr] = useState(false);
  const [more, setMore] = useState(false);
  const [moreErr, setMoreErr] = useState(false);

  const load = async () => {
    setErr(false);
    setItems(null);
    try {
      const res = await getMentions();
      setItems(res?.items || []);
      setCursor(res?.next_cursor || null);
    } catch { setErr(true); }
  };
  useEffect(() => { load(); }, []);

  const loadMore = async () => {
    setMore(true);
    setMoreErr(false);
    try {
      const res = await getMentions({ cursor });
      setItems((prev) => [...(prev || []), ...(res?.items || [])]);
      setCursor(res?.next_cursor || null);
    } catch { setMoreErr(true); }
    setMore(false);
  };

  const header = (
    <>
      <PageHeading title="Mentions" sub="Posts that name you — jump in while the thread is live." />
    </>
  );

  if (err) return <div className="flex flex-col gap-2.5">{header}<ErrorState message="Couldn't load your mentions." onRetry={load} /></div>;
  if (items === null) return <div className="flex flex-col gap-2.5">{header}<Skeleton className="h-64 rounded-xl" /></div>;

  if (!items.length) {
    return (
      <div className="flex flex-col gap-2.5">
        {header}
        <EmptyState icon={AtSign} title="No mentions yet"
          description="When someone names you in a post, it shows up here."
          action={<Link to="/community" className="mt-btn">Open the community</Link>} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      {header}
      <Panel flush>
        <div className="overflow-hidden rounded-[8px]">
          {items.map((m) => {
            const name = m.author?.display_name || 'Someone';
            const text = m.post?.title || m.snippet;
            return (
              <Link key={m.id} to={m.post?.url || '/community'}
                className="flex items-start gap-2.5 border-b border-neutral-200 px-3 py-2.5 last:border-b-0 hover:bg-blush/50">
                <Avatar name={name} />
                <div className="min-w-0">
                  {text && <p className="mb-0 truncate text-[12.5px] font-bold text-ink">{text}</p>}
                  {m.post?.title && m.snippet && <p className="mb-0 mt-0.5 line-clamp-2 text-[11.5px] font-medium text-ink/65">{m.snippet}</p>}
                  <p className="mb-0 mt-1 text-[10.5px] font-medium text-ink/50">{name} · {relDay(m.created_at)}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </Panel>
      {cursor && (
        <div className="flex flex-col items-center gap-1.5">
          {moreErr && <p className="mb-0 text-[11px] font-medium text-ink/55">Couldn't load more.</p>}
          <button type="button" onClick={loadMore} disabled={more} className="mt-btn">
            {more ? 'Loading…' : 'Load older'}
          </button>
        </div>
      )}
    </div>
  );
};

export default CommunityMentions;

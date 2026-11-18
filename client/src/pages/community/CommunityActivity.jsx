// Community → Activity. The signed-in host's OWN community posts + comments, from the
// real GET /community/users/:id/activity (posts newest first, comments with parent link).
// Counts are derived from that payload only; the endpoint returns one page (<=20 each).
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MessageSquare } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getAuthorActivity } from '../../services/communityApi';
import { ErrorState, Skeleton, EmptyState } from '../../components/dashboard/ui';
import { PageHeading, Panel, SubNav, Tile, relDay } from '../../components/dashboard/ui/v2';
import { COMMUNITY_NAV } from '../dashboardNav';

const snippet = (s, n = 140) => { const t = String(s || '').replace(/\s+/g, ' ').trim(); return t.length > n ? `${t.slice(0, n)}…` : t; };

const Row = ({ to, title, body, meta }) => (
  <Link to={to} className="block border-b border-neutral-200 px-3 py-2.5 last:border-b-0 hover:bg-blush/50">
    {title && <p className="mb-0 text-[12.5px] font-bold text-ink">{title}</p>}
    {body && <p className="mb-0 mt-0.5 text-[11.5px] font-medium text-ink/65">{snippet(body)}</p>}
    <p className="mb-0 mt-1 text-[10.5px] font-medium text-ink/50">{meta}</p>
  </Link>
);

const CommunityActivity = () => {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [err, setErr] = useState(false);

  const load = async () => {
    setErr(false);
    setData(null);
    try { setData(await getAuthorActivity(user.id)); }
    catch { setErr(true); }
  };
  useEffect(() => { if (user?.id) load(); }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const header = (
    <>
      <PageHeading title="Activity" sub="What you've posted and said in the community." />
    </>
  );

  if (err) return <div className="flex flex-col gap-2.5">{header}<ErrorState message="Couldn't load your community activity." onRetry={load} /></div>;
  if (data === null) return <div className="flex flex-col gap-2.5">{header}<Skeleton className="h-20 rounded-xl" /><Skeleton className="h-64 rounded-xl" /></div>;

  const posts = data.posts || [];
  const comments = data.comments || [];
  const likes = posts.reduce((n, p) => n + (p.like_count || 0), 0) + comments.reduce((n, c) => n + (c.like_count || 0), 0);
  const replies = posts.reduce((n, p) => n + (p.comment_count || 0), 0);

  if (!posts.length && !comments.length) {
    return (
      <div className="flex flex-col gap-2.5">
        {header}
        <EmptyState icon={MessageSquare} title="No community activity yet"
          description="Posts and replies you write in the community show up here."
          action={<Link to="/community" className="mt-btn">Open the community</Link>} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      {header}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Tile label="Posts" value={posts.length} hint="Recent" accent />
        <Tile label="Comments" value={comments.length} hint="Recent" />
        <Tile label="Likes earned" value={likes} hint="On the above" />
        <Tile label="Replies received" value={replies} hint="On your posts" />
      </div>

      <Panel title="Your posts" subtitle="Newest first" flush>
        <div className="overflow-hidden rounded-[8px]">
          {posts.length === 0
            ? <p className="mb-0 px-3 py-6 text-center text-[11.5px] font-medium text-ink/55">No posts yet.</p>
            : posts.map((p) => (
              <Row key={p.id} to={p.url} title={p.title} body={p.body}
                meta={`${relDay(p.created_at)}${p.space ? ` · ${p.space.name}` : ''} · ${p.like_count || 0} likes · ${p.comment_count || 0} replies`} />
            ))}
        </div>
      </Panel>

      <Panel title="Your comments" subtitle="Newest first" flush>
        <div className="overflow-hidden rounded-[8px]">
          {comments.length === 0
            ? <p className="mb-0 px-3 py-6 text-center text-[11.5px] font-medium text-ink/55">No comments yet.</p>
            : comments.map((c) => (
              <Row key={c.id} to={c.parent?.url || '/community'} title={c.parent?.title ? `On: ${c.parent.title}` : null} body={c.body}
                meta={`${relDay(c.created_at)} · ${c.like_count || 0} likes`} />
            ))}
        </div>
      </Panel>
    </div>
  );
};

export default CommunityActivity;

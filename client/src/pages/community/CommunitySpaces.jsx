// Community → Spaces. Real GET /community/spaces → { spaces: [{key,name,description,post_policy,reply_policy}] }.
// Posting rule mirrors the server's canPost (communityController: 'hosts' = hosts, 'official' = team only,
// 'everyone' = anyone). This page is the host dashboard, so the viewer is a host: everyone/hosts => can post.
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { LayoutGrid } from 'lucide-react';
import { getSpaces } from '../../services/communityApi';
import { ErrorState, Skeleton, EmptyState } from '../../components/dashboard/ui';
import { PageHeading, Panel, SubNav, StatusPill } from '../../components/dashboard/ui/v2';
import { COMMUNITY_NAV } from '../dashboardNav';

const canPost = (s) => s.post_policy !== 'official';

const CommunitySpaces = () => {
  const [spaces, setSpaces] = useState(null);
  const [err, setErr] = useState(false);

  const load = async () => {
    setErr(false);
    setSpaces(null);
    try { setSpaces((await getSpaces()).spaces || []); }
    catch { setErr(true); }
  };
  useEffect(() => { load(); }, []);

  const header = (
    <>
      <PageHeading title="Spaces" sub="The community's rooms, and where you can post." />
    </>
  );

  if (err) return <div className="flex flex-col gap-4 sm:gap-6">{header}<ErrorState message="Couldn't load community spaces." onRetry={load} /></div>;
  if (spaces === null) return <div className="flex flex-col gap-4 sm:gap-6">{header}<Skeleton className="h-64 rounded-xl" /></div>;
  if (spaces.length === 0) {
    return <div className="flex flex-col gap-4 sm:gap-6">{header}<EmptyState icon={LayoutGrid} title="No spaces yet" description="Community rooms will appear here." /></div>;
  }

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      {header}
      <Panel title="All spaces" subtitle={`${spaces.length} rooms`} flush>
        <div className="overflow-hidden rounded-[8px]">
          {spaces.map((s) => (
            <Link key={s.key} to={`/community/s/${encodeURIComponent(s.key)}`}
              className="flex items-start justify-between gap-3 border-b border-neutral-200 px-3 py-2.5 last:border-b-0 hover:bg-blush/50">
              <div className="min-w-0">
                <p className="mb-0 text-[12.5px] font-bold text-ink">{s.name}</p>
                {s.description && <p className="mb-0 mt-0.5 mt-post__meta">{s.description}</p>}
              </div>
              <StatusPill status={canPost(s) ? 'confirmed' : 'pending'}>{canPost(s) ? 'You can post' : 'Team only'}</StatusPill>
            </Link>
          ))}
        </div>
      </Panel>
    </div>
  );
};

export default CommunitySpaces;

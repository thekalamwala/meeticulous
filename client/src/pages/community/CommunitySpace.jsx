import { useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MessageSquarePlus } from 'lucide-react';
import Seo from '../../components/common/Seo';
import ErrorPage from '../ErrorPage';
import { useInfiniteScroll } from '../../components/dashboard/ui/useInfiniteScroll';
import { getSpaceThreads } from '../../services/communityApi';
import { analytics, EVENTS } from '../../services/analytics';
import { useAuth } from '../../context/AuthContext';
import { SITE_URL, collectionPageJsonLd } from '../../utils/seo';
import { communityBreadcrumbJsonLd, headlineOf } from '../../utils/communitySeo';
import ItemCard, { SpaceIcon } from '../../components/community/ItemCard';
import useRequireLogin from '../../components/community/useRequireLogin';
import CommunityLayout, { EmptyState, ListStatus, TITLE_SUFFIX, useCursorList } from './CommunityLayout';

const POLICY = {
  everyone: 'Everyone can start a thread.',
  hosts: 'Hosts start threads here. Everyone can read.',
  official: 'Posts come from the Meeticulous team.',
};

export default function CommunitySpace() {
  const { key } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const requireLogin = useRequireLogin();
  const list = useCursorList((cursor) => getSpaceThreads({ key, cursor }), key);
  const sentinel = useInfiniteScroll(list.loadMore, { hasMore: list.hasMore, loading: list.loading });
  const space = list.data?.space;

  const tracked = useRef(null);
  useEffect(() => {
    if (space && tracked.current !== key) {
      tracked.current = key;
      analytics.track(EVENTS.COMMUNITY_VIEWED, { space: key });
    }
  }, [space, key]);

  // Every "start" button here (and the layout's New post) opens a thread in this space.
  const compose = () => { if (requireLogin()) navigate(`/community/new?kind=thread&space=${encodeURIComponent(key)}`); };
  const canStart = space && (space.post_policy === 'everyone' || (space.post_policy === 'hosts' && (!user || user.is_host)));

  // 404 = gate closed or unknown space; a 200 with no space = tables not there yet (soft-fail).
  if (list.status === 404 || (list.status === 200 && !space)) return <ErrorPage code={404} />;

  const description = space?.description || `${space?.name || 'Space'} threads on the Meeticulous Community.`;
  const startBtn = canStart && (
    <button type="button" onClick={compose} className="mt-btn"><MessageSquarePlus size={20} aria-hidden="true" />Start a thread</button>
  );

  return (
    <CommunityLayout active={key} onCompose={compose}>
      {space && (
        <Seo
          title={`${space.name}${TITLE_SUFFIX}`}
          description={description}
          canonical={`${SITE_URL}/community/s/${space.key}`}
          robots="index,follow"
          jsonLd={[
            collectionPageJsonLd({
              name: space.name, description, url: `/community/s/${space.key}`,
              items: list.items.map((it) => ({ url: it.url, name: headlineOf(it) })),
            }),
            communityBreadcrumbJsonLd(null, space, SITE_URL),
          ]}
        />
      )}

      {space && (
        <header className="mt-card flex-row items-center gap-3 p-5 sm:p-6">
          <span className="mt-avatar rounded-md" aria-hidden="true"><SpaceIcon spaceKey={space.key} /></span>
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-2xl font-extrabold leading-tight tracking-tight text-maroon">{space.name}</h1>
            <p className="mt-0.5 text-xs leading-snug text-muted">{space.description} {POLICY[space.post_policy]}</p>
          </div>
          {list.items.length > 0 && <div className="hidden sm:block">{startBtn}</div>}
        </header>
      )}

      {list.items.map((it) => <ItemCard key={it.id} item={it} />)}
      <ListStatus list={list} />
      {space && !list.items.length && !list.loading && (
        <EmptyState
          illo="mt-illo-reminder-light.svg"
          title="No threads yet."
          script="Start the first one."
          text={space.description || 'Be the first to ask or share something here.'}
          action={startBtn}
        />
      )}
      <div ref={sentinel} aria-hidden="true" />
    </CommunityLayout>
  );
}

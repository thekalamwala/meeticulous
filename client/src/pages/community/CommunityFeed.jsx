import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CircleHelp, Image, MessagesSquare, SquarePen } from 'lucide-react';
import Seo from '../../components/common/Seo';
import ErrorPage from '../ErrorPage';
import { useInfiniteScroll } from '../../components/dashboard/ui/useInfiniteScroll';
import { getFeed } from '../../services/communityApi';
import { analytics, EVENTS } from '../../services/analytics';
import { useAuth } from '../../context/AuthContext';
import { useFeature } from '../../context/FeatureContext';
import { SITE_URL, collectionPageJsonLd } from '../../utils/seo';
import { communityBreadcrumbJsonLd, headlineOf } from '../../utils/communitySeo';
import ItemCard from '../../components/community/ItemCard';
import { Avatar } from '../../components/community/AuthorChip';
import useRequireLogin from '../../components/community/useRequireLogin';
import useHiddenPosts from '../../components/community/useHiddenPosts';
import ReportDialog from '../../components/community/ReportDialog';
import CommunityLayout, { EmptyState, ListStatus, SITE_DESC, useCursorList } from './CommunityLayout';

const TABS = [
  { key: 'everyone', label: 'Everyone' },
  { key: 'following', label: 'Following', soon: true }, // follows ship in a later phase
  { key: 'updates', label: 'Updates' },
];

export default function CommunityFeed() {
  const { user } = useAuth();
  const v2 = useFeature('community_v2');
  const navigate = useNavigate();
  const requireLogin = useRequireLogin();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'updates' ? 'updates' : 'everyone';
  const list = useCursorList((cursor) => getFeed({ tab, cursor }), tab);
  const sentinel = useInfiniteScroll(list.loadMore, { hasMore: list.hasMore, loading: list.loading });
  const { hide, isHidden } = useHiddenPosts();
  const [reportTarget, setReportTarget] = useState(null);

  const tracked = useRef(null);
  useEffect(() => {
    if (list.status === 200 && tracked.current !== tab) {
      tracked.current = tab;
      analytics.track(EVENTS.COMMUNITY_VIEWED, { tab });
    }
  }, [list.status, tab]);

  const compose = (kind = 'post') => {
    if (requireLogin()) navigate(`/community/new${kind && kind !== 'post' ? `?kind=${kind}` : ''}`);
  };

  if (list.status === 404) return <ErrorPage code={404} />;

  const title = 'Meeticulous Community';
  return (
    <CommunityLayout active="feed" onCompose={compose}>
      <Seo
        title={title}
        description={SITE_DESC}
        canonical={`${SITE_URL}/community`}
        robots="index,follow"
        jsonLd={[
          collectionPageJsonLd({
            name: title, description: SITE_DESC, url: '/community',
            items: list.items.map((it) => ({ url: it.url, name: headlineOf(it) })),
          }),
          communityBreadcrumbJsonLd(null, null, SITE_URL),
        ]}
      />

      {/* v2: a slim one-line greeting, not a full-height hero, so the first post
          sits above the fold on a 390px phone. v1: the original hero. */}
      <header className={`flex flex-col ${v2 ? 'gap-0.5 py-1' : 'gap-2 py-2'}`}>
        <h1 className={`font-display font-extrabold leading-tight tracking-tight text-maroon ${v2 ? 'text-xl' : 'text-3xl sm:text-4xl'}`}>
          Ask, share, learn. <span className="font-serif font-normal italic text-rose">Find your people.</span>
        </h1>
        <p className={`text-muted ${v2 ? 'text-xs' : 'text-sm'}`}>Hosts and guests talking about sessions, pricing and the craft.</p>
      </header>

      <div role="tablist" aria-label="Feed" className={v2 ? 'mt-tabs mt-tabs--underline flex overflow-x-auto' : 'mt-tabs flex'}>
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={t.key === tab}
            aria-disabled={t.soon || undefined}
            title={t.soon ? 'Following arrives soon' : undefined}
            onClick={() => { if (!t.soon && t.key !== tab) setParams(t.key === 'everyone' ? {} : { tab: t.key }); }}
            className={v2 ? 'mt-tab shrink-0' : 'mt-tab flex-1 justify-center px-3 sm:px-6'}
          >
            {t.label}{t.soon && <span className="mt-tab__count">soon</span>}
          </button>
        ))}
      </div>

      <div className="mt-card gap-4 p-5 sm:p-6">
        <div className="flex items-center gap-3">
          {user && <Avatar author={{ display_name: user.name || user.first_name, avatar_url: user.profile_image, role: user.is_host ? 'host' : 'guest' }} />}
          <button type="button" onClick={() => compose('post')} className="mt-input min-w-0 flex-1 cursor-text rounded-full text-left text-sm text-muted">
            Share something with the community
          </button>
        </div>
        <div className="flex flex-wrap justify-end gap-1">
          <button type="button" onClick={() => compose('photo')} className="mt-btn mt-btn--ghost mt-btn--s gap-2"><Image size={16} aria-hidden="true" />Photo</button>
          <button type="button" onClick={() => compose('question')} className="mt-btn mt-btn--ghost mt-btn--s gap-2"><CircleHelp size={16} aria-hidden="true" />Ask a question</button>
          <button type="button" onClick={() => compose('thread')} className="mt-btn mt-btn--ghost mt-btn--s gap-2"><MessagesSquare size={16} aria-hidden="true" />Start a thread</button>
        </div>
      </div>

      {list.items.filter((it) => !isHidden(it.id)).map((it) => (
        <ItemCard
          key={it.id}
          item={it}
          viewerId={user?.id}
          canPin={!!user?.is_admin}
          onHide={hide}
          onReport={(p) => setReportTarget({ type: 'post', id: p.id })}
        />
      ))}
      {reportTarget && <ReportDialog target={reportTarget} onClose={() => setReportTarget(null)} />}
      <ListStatus list={list} />
      {list.status === 200 && !list.items.length && (
        // The page header already carries this layout's one serif phrase.
        <EmptyState
          illo="mt-illo-group-light.svg"
          title="It's quiet in here. Say hello first."
          text="Share a win, ask a question or tell people what you teach."
          action={<button type="button" onClick={() => compose('post')} className="mt-btn"><SquarePen size={20} aria-hidden="true" />Write the first post</button>}
        />
      )}
      <div ref={sentinel} aria-hidden="true" />
    </CommunityLayout>
  );
}

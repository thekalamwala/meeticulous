import { useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Hash } from 'lucide-react';
import Seo from '../../components/common/Seo';
import ErrorPage from '../ErrorPage';
import { useInfiniteScroll } from '../../components/dashboard/ui/useInfiniteScroll';
import { getTagThreads } from '../../services/communityApi';
import { analytics, EVENTS } from '../../services/analytics';
import { SITE_URL, collectionPageJsonLd } from '../../utils/seo';
import { headlineOf } from '../../utils/communitySeo';
import ItemCard from '../../components/community/ItemCard';
import useRequireLogin from '../../components/community/useRequireLogin';
import CommunityLayout, { EmptyState, ListStatus, TITLE_SUFFIX, useCursorList } from './CommunityLayout';

// Topic hub: every question/thread carrying one tag. A read-only SEO/AEO surface
// (no posting here — tags are applied to threads, not started in a tag). Mirrors
// CommunitySpace, which is the other community "hub" page.
export default function CommunityTag() {
  const { tag } = useParams();
  const navigate = useNavigate();
  const requireLogin = useRequireLogin();
  const list = useCursorList((cursor) => getTagThreads({ tag, cursor }), tag);
  const compose = () => { if (requireLogin()) navigate('/community/new'); };
  const sentinel = useInfiniteScroll(list.loadMore, { hasMore: list.hasMore, loading: list.loading });
  const meta = list.data?.tag;

  const tracked = useRef(null);
  useEffect(() => {
    if (meta && tracked.current !== tag) {
      tracked.current = tag;
      analytics.track(EVENTS.COMMUNITY_VIEWED, { tag });
    }
  }, [meta, tag]);

  // 404 = unknown tag; a 200 with no tag = tables not there yet (soft-fail).
  if (list.status === 404 || (list.status === 200 && !meta)) return <ErrorPage code={404} />;

  const name = meta?.name || 'Topic';
  const description = `Questions and answers about ${name.toLowerCase()} on the Meeticulous Community — real questions from hosts and guests, answered by hosts and the Meeticulous team.`;
  const url = `/community/tag/${tag}`;
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Community', item: `${SITE_URL}/community` },
      { '@type': 'ListItem', position: 2, name, item: `${SITE_URL}${url}` },
    ],
  };

  return (
    <CommunityLayout active={`tag-${tag}`} onCompose={compose}>
      {meta && (
        <Seo
          title={`${name}${TITLE_SUFFIX}`}
          description={description}
          canonical={`${SITE_URL}${url}`}
          robots="index,follow"
          jsonLd={[
            collectionPageJsonLd({
              name, description, url,
              items: list.items.map((it) => ({ url: it.url, name: headlineOf(it) })),
            }),
            breadcrumb,
          ]}
        />
      )}

      {meta && (
        <header className="mt-card flex-row items-center gap-3 p-5 sm:p-6">
          <span className="mt-avatar rounded-md" aria-hidden="true"><Hash size={20} /></span>
          <div className="min-w-0 flex-1">
            <h1 className="mb-0 font-display text-2xl font-extrabold leading-tight tracking-tight text-maroon">{name}</h1>
            <p className="mt-0.5 text-xs leading-snug text-muted">
              {meta.count} {meta.count === 1 ? 'question' : 'questions'} from hosts and guests, answered.
            </p>
          </div>
        </header>
      )}

      {list.items.map((it) => <ItemCard key={it.id} item={it} />)}
      <ListStatus list={list} />
      {meta && !list.items.length && !list.loading && (
        <EmptyState
          illo="mt-illo-reminder-light.svg"
          title="Nothing here yet."
          text="No questions carry this topic right now."
        />
      )}
      <div ref={sentinel} aria-hidden="true" />
    </CommunityLayout>
  );
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { House, Lock, SquarePen } from 'lucide-react';
import { getSpaces } from '../../services/communityApi';
import { SpaceIcon } from '../../components/community/ItemCard';
import FeedSkeleton from '../../components/community/CommunitySkeleton';
import CommunityAd from '../../components/community/CommunityAd';

export const SITE_DESC = 'Questions, tips and updates from hosts and guests on Meeticulous, the booking platform for independent professionals.';
export const TITLE_SUFFIX = ' — Meeticulous Community'; // same suffix as server prerenderCommunity.js
export const flat = (s) => String(s || '').replace(/\s+/g, ' ').trim();

// Cursor-paged list for the feed and space pages. `status` is the FIRST page's HTTP status
// (200 / 404 gate closed / 0 network); a later page failing just stops paging.
export function useCursorList(fetchPage, key) {
  const [s, setS] = useState({ items: [], cursor: null, loading: true, status: null, data: null });
  const req = useRef(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const load = useCallback(async (cursor) => {
    const id = ++req.current;
    setS((p) => (cursor ? { ...p, loading: true } : { items: [], cursor: null, loading: true, status: null, data: null }));
    try {
      const data = await fetchPage(cursor);
      if (id !== req.current) return;
      setS((p) => ({ items: cursor ? [...p.items, ...(data.items || [])] : data.items || [], cursor: data.next_cursor || null, loading: false, status: 200, data }));
    } catch (e) {
      if (id !== req.current) return;
      if (cursor) toast.error("Couldn't load more. Try again later.");
      setS((p) => ({ ...p, loading: false, cursor: null, status: cursor ? p.status : e?.response?.status || 0 }));
    }
  }, [key]);
  useEffect(() => { load(null); }, [load]);
  const loadMore = useCallback(() => { if (s.cursor) load(s.cursor); }, [load, s.cursor]);
  return { ...s, hasMore: !!s.cursor, loadMore, reload: () => load(null) };
}

const navCls = (on) => `flex h-10 items-center gap-3 rounded-full px-3 text-sm no-underline transition-colors ${
  on ? 'bg-white font-semibold text-maroon' : 'font-medium text-ink hover:bg-pink-100 hover:text-maroon'}`;
const LOCK_LABEL = { hosts: 'Hosts post here', official: 'Team posts only' };

// Shell: spaces rail (desktop) or chip row (mobile), the main column, optional right rail.
// `active` = 'feed' or a space key. `onCompose(kind)` backs the "New post" button.
export default function CommunityLayout({ active, onCompose, aside, children }) {
  const [spaces, setSpaces] = useState([]);
  // The right rail always shows: it carries the ad slot (every audience has a deck,
  // including logged-out guests), plus any page-supplied `aside` above it.
  const showRail = true;
  useEffect(() => {
    let live = true;
    getSpaces().then((d) => { if (live) setSpaces(d.spaces || []); }).catch(() => {});
    return () => { live = false; };
  }, []);

  return (
    <main className="min-h-screen bg-cream pb-16">
      <nav aria-label="Spaces" className="flex gap-3 overflow-x-auto px-5 py-4 lg:hidden">
        <Link to="/community" aria-current={active === 'feed' ? 'page' : undefined} className={`mt-tag shrink-0 no-underline ${active === 'feed' ? 'mt-tag--selected' : ''}`}>All</Link>
        {spaces.map((s) => (
          <Link key={s.key} to={`/community/s/${s.key}`} aria-current={active === s.key ? 'page' : undefined} className={`mt-tag shrink-0 no-underline ${active === s.key ? 'mt-tag--selected' : ''}`}>
            {s.name}
          </Link>
        ))}
      </nav>

      {/* Columns: rail 240 · main ≤640 · aside 320 (aside only on xl, when given). */}
      <div className={`mx-auto max-w-7xl gap-6 px-4 lg:grid lg:grid-cols-[15rem_minmax(0,46rem)] lg:justify-center lg:px-5 lg:pt-6 ${
        showRail ? 'xl:grid-cols-[15rem_minmax(0,46rem)_20rem]' : ''}`}>
        <aside aria-label="Community navigation" className="sticky top-24 hidden flex-col gap-5 self-start lg:flex">
          <button type="button" onClick={() => onCompose?.('post')} className="mt-btn mt-btn--block">
            <SquarePen size={20} aria-hidden="true" />New post
          </button>
          <nav aria-label="Spaces" className="flex flex-col gap-1">
            <Link to="/community" aria-current={active === 'feed' ? 'page' : undefined} className={navCls(active === 'feed')}>
              <House size={20} aria-hidden="true" />Feed
            </Link>
            <span className="mt-card__kicker px-3 pb-1 pt-3">Spaces</span>
            {spaces.map((s) => (
              <Link key={s.key} to={`/community/s/${s.key}`} aria-current={active === s.key ? 'page' : undefined} className={navCls(active === s.key)}>
                <SpaceIcon spaceKey={s.key} />
                <span className="min-w-0 flex-1 truncate">{s.name}</span>
                {LOCK_LABEL[s.post_policy] && <Lock size={16} role="img" aria-label={LOCK_LABEL[s.post_policy]} className="text-neutral-500" />}
              </Link>
            ))}
          </nav>
          <div className="flex flex-wrap gap-x-4 gap-y-1 px-3 text-xs">
            <Link to="/community/guidelines" className="text-muted">Guidelines</Link>
            <Link to="/help" className="text-muted">Help centre</Link>
          </div>
        </aside>

        <div className="flex min-w-0 flex-col gap-5">{children}</div>

        {showRail && (
          <aside aria-label="About" className="sticky top-24 hidden flex-col gap-5 self-start xl:flex">
            {aside}
            <CommunityAd />
          </aside>
        )}
      </div>

      {/* Mobile "New post": bottom-LEFT, because the support-bot launcher (BotWidget) owns bottom-right. */}
      <button type="button" onClick={() => onCompose?.('post')} className="mt-btn mt-fab lg:hidden">
        <SquarePen size={20} aria-hidden="true" />New post
      </button>
    </main>
  );
}

// First-page loading skeleton or error card for a useCursorList-shaped object.
export function ListStatus({ list }) {
  if (list.loading && !list.items.length) {
    return (
      <div aria-live="polite" aria-busy="true">
        <span className="sr-only">Loading</span>
        <FeedSkeleton />
      </div>
    );
  }
  if (list.status !== 200) {
    return (
      <div role="alert" className="mt-card items-start">
        <p className="text-sm text-ink">We couldn't load this right now.</p>
        <button type="button" onClick={list.reload} className="mt-btn mt-btn--secondary mt-btn--s">Try again</button>
      </div>
    );
  }
  return null;
}

// Warm empty state: illustration, one heading, one line, one action.
export function EmptyState({ illo, title, script, text, action }) {
  return (
    <div className="mt-card items-center px-6 py-12 text-center">
      <img src={`/brand/ds/04-illustrations/${illo}`} alt="" width="240" height="160" className="h-auto w-60" />
      <h2 className="font-display text-2xl font-extrabold tracking-tight text-maroon">
        {title}{script && <> <span className="font-serif font-normal italic text-rose">{script}</span></>}
      </h2>
      <p className="max-w-sm text-sm text-muted">{text}</p>
      {action}
    </div>
  );
}

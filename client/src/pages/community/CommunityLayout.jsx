import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Bell, Calendar, House, LayoutGrid, Lock, MessageSquare, Search, SquarePen, UserRound } from 'lucide-react';
import { getSpaces } from '../../services/communityApi';
import { getNotifications } from '../../services/api';
import { SpaceIcon } from '../../components/community/ItemCard';
import FeedSkeleton from '../../components/community/CommunitySkeleton';
import CommunityAd from '../../components/community/CommunityAd';
import { useFeature } from '../../context/FeatureContext';
import { useAuth } from '../../context/AuthContext';
import ProfileDrawer from '../../components/community/ProfileDrawer';
import CommunityProfileRail from '../../components/community/CommunityProfileRail';
import '../../styles/community-v2.css';

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

// Dynamic community wordmark tag — intentionally varies (Gang/Circle/…), never
// collapsed to one name. Stable within a day so the navbar doesn't flicker.
// ponytail: a fixed rotation, not a naming engine; per-space names can come later.
const TAGS = ['Gang', 'Circle', 'Crew', 'Table', 'Room'];
const communityTag = () => TAGS[new Date().getDay() % TAGS.length];

// Desktop top-bar icon button: maroon on white, active = maroon fill + white icon.
const dIcon = (on) => `relative grid h-10 w-10 place-items-center rounded-xl border transition-colors ${
  on ? 'border-transparent bg-maroon text-white' : 'border-line bg-white text-maroon hover:bg-pink-100'}`;

// Shell: spaces rail (desktop) or chip row (mobile), the main column, optional right rail.
// `active` = 'feed' or a space key. `onCompose(kind)` backs the "New post" button.
export default function CommunityLayout({ active, onCompose, aside, children }) {
  const v2 = useFeature('community_v2');
  const { user } = useAuth();
  const [spaces, setSpaces] = useState([]);
  // Profile drawer (grid tile + Profile tab). The panel + focus-trap land in M3;
  // M2 wires the open state and the aria-expanded semantics on both triggers.
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const tag = communityTag();

  // Unread community-alert count for the bottom-bar badge (v2, signed-in).
  useEffect(() => {
    if (!v2 || !user) return undefined;
    let live = true;
    getNotifications(user.is_host ? 'host' : 'guest')
      .then((res) => {
        if (!live) return;
        const n = (res.data?.notifications || []).filter((x) => typeof x.type === 'string' && x.type.startsWith('COMMUNITY') && !x.read_at);
        setUnread(n.length);
      })
      .catch(() => {});
    return () => { live = false; };
  }, [v2, user, active]);
  // The right rail always shows: it carries the ad slot (every audience has a deck,
  // including logged-out guests), plus any page-supplied `aside` above it.
  const showRail = true;
  useEffect(() => {
    let live = true;
    getSpaces().then((d) => { if (live) setSpaces(d.spaces || []); }).catch(() => {});
    return () => { live = false; };
  }, []);

  return (
    <main className={`min-h-screen overflow-x-hidden bg-cream ${v2 ? 'community-v2 pb-24' : 'pb-16'}`}>
      {v2 && (
        <header
          className="sticky top-0 z-40 flex items-center justify-between border-b border-line bg-white px-4 lg:hidden"
          style={{ paddingTop: 'env(safe-area-inset-top)' }}
        >
          <Link to="/community" aria-label="Meeticulous Community" className="flex items-center gap-2 py-3 no-underline">
            <img src="/brand/meeticulous-wordmark.svg" alt="Meeticulous" width="110" height="18" className="h-[18px] w-auto" />
            <span className="rounded-full bg-pink-100 px-2 py-0.5 text-xs font-semibold text-maroon">{tag}</span>
          </Link>
          <button
            type="button"
            onClick={() => setDrawerOpen((o) => !o)}
            aria-label="Open profile menu"
            aria-expanded={drawerOpen}
            className="grid h-11 w-11 place-items-center rounded-2xl bg-cream text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-maroon/40"
          >
            <LayoutGrid size={20} aria-hidden="true" />
          </button>
        </header>
      )}

      {/* v2 desktop top bar: wordmark + search + icon actions (replaces the global
          navbar on the community shell; see inCommunityShell in App.jsx). */}
      {v2 && (
        <header className="sticky top-0 z-40 hidden border-b border-line bg-white/90 backdrop-blur lg:block" style={{ top: 'env(safe-area-inset-top)' }}>
          <div className="mx-auto flex max-w-7xl items-center gap-4 px-5 py-2.5">
            <Link to="/community" aria-label="Meeticulous Circle" className="flex shrink-0 items-center gap-2 no-underline">
              <img src="/brand/meeticulous-wordmark.svg" alt="Meeticulous" width="110" height="18" className="h-[18px] w-auto" />
              <span className="rounded-full bg-pink-100 px-2 py-0.5 text-xs font-semibold text-maroon">{tag}</span>
            </Link>
            <label className="flex max-w-md flex-1 items-center gap-2 rounded-full border border-line bg-cream px-4 py-2">
              <Search size={16} className="text-muted" aria-hidden="true" />
              <input type="search" aria-label="Search the community" placeholder="Search hosts, posts, spaces…" className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-muted" />
            </label>
            <div className="ml-auto flex items-center gap-1.5">
              <Link to="/community" aria-label="Spaces" aria-current={active === 'feed' ? 'page' : undefined} className={dIcon(active === 'feed')}><LayoutGrid size={19} aria-hidden="true" /></Link>
              <Link to="/dashboard/availability" aria-label="Your calendar" className={dIcon(false)}><Calendar size={19} aria-hidden="true" /></Link>
              <Link to="/dashboard/chat" aria-label="Messages" className={dIcon(false)}><MessageSquare size={19} aria-hidden="true" /></Link>
              <Link to="/community/alerts" aria-label={unread ? `Alerts, ${unread} unread` : 'Alerts'} aria-current={active === 'alerts' ? 'page' : undefined} className={dIcon(active === 'alerts')}>
                <Bell size={19} aria-hidden="true" />
                {unread > 0 && <span className="absolute -right-1 -top-1 min-w-[17px] rounded-full bg-maroon px-1 text-center text-[10px] font-bold leading-[17px] text-white">{unread > 9 ? '9+' : unread}</span>}
              </Link>
              <button type="button" onClick={() => setDrawerOpen(true)} aria-label="Open profile menu" aria-expanded={drawerOpen} className="ml-1 grid h-10 w-10 place-items-center rounded-xl font-display text-sm font-extrabold text-[#5c0620] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-maroon/40" style={{ background: 'radial-gradient(120% 120% at 30% 20%,#FFD7E0,#FF9FB0 60%,#E0506F)' }}>
                {(user?.name || user?.first_name || 'Y').charAt(0).toUpperCase()}
              </button>
            </div>
          </div>
        </header>
      )}

      <nav aria-label="Spaces" className={`gap-3 overflow-x-auto px-5 py-4 lg:hidden ${v2 ? 'hidden' : 'flex'}`}>
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
        <aside aria-label="Community navigation" className={`sticky hidden flex-col gap-5 self-start lg:flex ${v2 ? 'lg:top-[60px]' : 'top-24'}`}>
          {v2 ? (
            <CommunityProfileRail user={user} />
          ) : (
            <>
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
            </>
          )}
        </aside>

        <div className={`flex min-w-0 flex-col ${v2 ? 'gap-3' : 'gap-5'}`}>{children}</div>

        {showRail && (
          <aside aria-label="About" className={`sticky hidden flex-col gap-5 self-start xl:flex ${v2 ? 'lg:top-[60px]' : 'top-24'}`}>
            {aside}
            <CommunityAd />
            {v2 && (
              <div className="flex flex-col gap-2 px-1">
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                  <Link to="/about" className="text-muted hover:text-maroon">About</Link>
                  <Link to="/help" className="text-muted hover:text-maroon">Help</Link>
                  <Link to="/privacy" className="text-muted hover:text-maroon">Privacy</Link>
                  <Link to="/community/guidelines" className="text-muted hover:text-maroon">Guidelines</Link>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-muted">
                  Powered by <span className="font-display text-xs font-extrabold tracking-tight text-ink">Me<span className="text-[#FF6E8A]">e</span>ticulous</span>
                </div>
              </div>
            )}
          </aside>
        )}
      </div>

      {/* Mobile "New post" FAB: v1 only. v2 drops it (overlapped content); posting
          lives in the inline composer + the full-screen composer (M4). */}
      {!v2 && (
        <button type="button" onClick={() => onCompose?.('post')} className="mt-btn mt-fab lg:hidden">
          <SquarePen size={20} aria-hidden="true" />New post
        </button>
      )}

      {/* v2 mobile bottom tab bar: Home · Search · Alerts · Profile. Safe-area aware.
          Alerts wires to the Alerts tab in M6; Search is a placeholder until its
          page exists. Profile opens the same drawer as the grid tile (panel in M3). */}
      {v2 && (
        <nav
          aria-label="Community"
          className="fixed inset-x-0 bottom-0 z-40 flex items-stretch justify-around border-t border-line bg-white lg:hidden"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <Link
            to="/community"
            aria-current={active === 'feed' ? 'page' : undefined}
            className={`flex min-h-[44px] flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium no-underline ${active === 'feed' ? 'text-maroon' : 'text-muted'}`}
          >
            <House size={22} aria-hidden="true" />Home
          </Link>
          <button type="button" disabled aria-label="Search (coming soon)" title="Soon" className="flex min-h-[44px] flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium text-muted opacity-60">
            <Search size={22} aria-hidden="true" />Search
          </button>
          <Link
            to="/community/alerts"
            aria-current={active === 'alerts' ? 'page' : undefined}
            aria-label={unread ? `Alerts, ${unread} unread` : 'Alerts'}
            className={`relative flex min-h-[44px] flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium no-underline ${active === 'alerts' ? 'text-maroon' : 'text-muted'}`}
          >
            <span className="relative">
              <Bell size={22} aria-hidden="true" />
              {unread > 0 && <span className="absolute -right-1.5 -top-1 min-w-[16px] rounded-full bg-maroon px-1 text-center text-[10px] font-semibold leading-4 text-white">{unread > 9 ? '9+' : unread}</span>}
            </span>
            Alerts
          </Link>
          <button
            type="button"
            onClick={() => setDrawerOpen((o) => !o)}
            aria-label="Open profile menu"
            aria-expanded={drawerOpen}
            className="flex min-h-[44px] flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-maroon/40"
          >
            <UserRound size={22} aria-hidden="true" />Profile
          </button>
        </nav>
      )}

      {v2 && <ProfileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} user={user} />}
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

import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Bell, Clock, House, LayoutGrid, ListFilter, Lock, Plus, Search, SquarePen, UserRound } from 'lucide-react';
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

// Spaces-sheet chip: wrapping pill, sized to its label (fluid, many per row).
const chipCls = (on) => `rounded-full border px-3.5 py-2 text-sm font-semibold no-underline transition-colors ${
  on ? 'border-transparent bg-maroon text-cream' : 'border-line bg-cream text-ink hover:border-maroon/40 hover:text-maroon'}`;
const LOCK_LABEL = { hosts: 'Hosts post here', official: 'Team posts only' };

// Dynamic community wordmark tag — intentionally varies (Gang/Circle/…), never
// collapsed to one name. Stable within a day so the navbar doesn't flicker.
// ponytail: a fixed rotation, not a naming engine; per-space names can come later.
const TAGS = ['Gang', 'Circle', 'Crew', 'Table', 'Room'];
const communityTag = () => TAGS[new Date().getDay() % TAGS.length];

// Canned prompts shown in the search dropdown until a real search index exists.
const SEARCH_SUGGESTIONS = ['pricing', 'no-shows', 'getting more bookings', 'payouts', 'reviews'];
const RECENT_KEY = 'mt_community_recent';

// Desktop top-bar icon button: maroon on white, active = maroon fill + white icon.
const dIcon = (on) => `relative grid h-10 w-10 place-items-center rounded-xl border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-maroon/40 ${
  on ? 'border-transparent bg-maroon text-white' : 'border-line bg-white text-maroon hover:bg-pink-100'}`;

// Desktop top-bar ghost icon button (bell): no border, hover fill.
const gIcon = (on) => `relative grid h-9 w-9 place-items-center rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-maroon/40 ${
  on ? 'bg-maroon text-white' : 'text-ink hover:bg-pink-100 hover:text-maroon'}`;

// Desktop top-bar space pill: the community nav as words, active = maroon fill.
const cSpace = (on) => `shrink-0 rounded-full px-3 py-1.5 text-[13px] font-semibold no-underline transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-maroon/40 ${
  on ? 'bg-maroon text-white' : 'text-muted hover:bg-pink-100 hover:text-ink'}`;

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
  const [spacesOpen, setSpacesOpen] = useState(false); // mobile: grid tile → spaces sheet
  const [spaceQuery, setSpaceQuery] = useState(''); // live filter inside the spaces sheet
  const [filterOpen, setFilterOpen] = useState(false); // mobile: bottom-bar filter sheet
  const [searchFocused, setSearchFocused] = useState(false); // desktop search dropdown
  const [searchQuery, setSearchQuery] = useState('');
  const [recent, setRecent] = useState([]);
  const searchRef = useRef(null);
  const [sp] = useSearchParams();
  const curTab = sp.get('tab') || 'everyone';
  const tag = communityTag();

  // ⌘K / Ctrl-K focuses the top-bar search; Esc blurs it and closes any sheet.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); searchRef.current?.focus(); }
      else if (e.key === 'Escape') { searchRef.current?.blur(); setSpacesOpen(false); setFilterOpen(false); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Recent searches live in this browser only (per-viewer convenience).
  useEffect(() => {
    try { const r = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); if (Array.isArray(r)) setRecent(r.slice(0, 5)); } catch { /* ignore */ }
  }, []);
  const pushRecent = (q) => setRecent((prev) => {
    const next = [q, ...prev.filter((x) => x !== q)].slice(0, 5);
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch { /* ignore */ }
    return next;
  });
  const clearRecent = () => { setRecent([]); try { localStorage.removeItem(RECENT_KEY); } catch { /* ignore */ } };
  const runSuggest = (q) => { setSearchQuery(q); pushRecent(q); searchRef.current?.focus(); };

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
          className="sticky top-0 z-40 flex items-center justify-between border-b border-line bg-white px-4 pb-[2px] lg:hidden"
          style={{ paddingTop: 'env(safe-area-inset-top)' }}
        >
          <Link to="/community" aria-label="Meeticulous Community" className="flex items-center gap-2 py-3 no-underline">
            <img src="/brand/meeticulous-wordmark.svg" alt="Meeticulous" width="110" height="18" className="h-[18px] w-auto" />
            <span className="rounded-full bg-pink-100 px-2 py-0.5 text-xs font-semibold text-maroon">{tag}</span>
          </Link>
          <button
            type="button"
            onClick={() => { setSpaceQuery(''); setSpacesOpen(true); }}
            aria-label="Browse spaces"
            aria-expanded={spacesOpen}
            className="grid h-11 w-11 place-items-center rounded-2xl bg-cream text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-maroon/40"
          >
            <LayoutGrid size={18} aria-hidden="true" />
          </button>
        </header>
      )}

      {/* Mobile Spaces sheet — opened by the header grid tile (distinct from the
          Profile drawer the bottom bar opens). */}
      {v2 && spacesOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Spaces">
          <div className="absolute inset-0 bg-ink/30" onClick={() => setSpacesOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 max-h-[78vh] overflow-y-auto rounded-t-3xl bg-white p-4 shadow-2xl" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line" />
            <form role="search" onSubmit={(e) => e.preventDefault()} className="mb-3 flex items-center gap-2">
              {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
              <input autoFocus type="search" value={spaceQuery} onChange={(e) => setSpaceQuery(e.target.value)} aria-label="Search spaces" placeholder="Search spaces…" className="min-w-0 flex-1 rounded-full border border-line bg-cream px-4 py-2.5 text-sm text-ink outline-none placeholder:text-muted focus:border-maroon/40 focus:ring-2 focus:ring-maroon/20" />
              <button type="submit" aria-label="Search" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-maroon text-cream transition-colors hover:bg-maroon-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-maroon/40">
                <Search size={18} aria-hidden="true" />
              </button>
            </form>
            <nav aria-label="Spaces" className="flex flex-wrap gap-2">
              {!spaceQuery && (
                <Link to="/community" onClick={() => setSpacesOpen(false)} aria-current={active === 'feed' ? 'page' : undefined} className={chipCls(active === 'feed')}>All</Link>
              )}
              {spaces.filter((s) => (s.title || '').toLowerCase().includes(spaceQuery.toLowerCase())).map((s) => (
                <Link key={s.key} to={`/community/s/${s.key}`} onClick={() => setSpacesOpen(false)} aria-current={active === s.key ? 'page' : undefined} className={chipCls(active === s.key)}>{s.title}</Link>
              ))}
              {spaceQuery && spaces.filter((s) => (s.title || '').toLowerCase().includes(spaceQuery.toLowerCase())).length === 0 && (
                <p className="px-3 py-6 text-center text-sm text-muted">No spaces match “{spaceQuery}”.</p>
              )}
            </nav>
          </div>
        </div>
      )}

      {/* v2 desktop top bar: wordmark + search + icon actions (replaces the global
          navbar on the community shell; see inCommunityShell in App.jsx). */}
      {v2 && (
        <header className="sticky top-0 z-40 hidden border-b border-line bg-white/90 backdrop-blur lg:block" style={{ top: 'env(safe-area-inset-top)' }}>
          <div className="mx-auto flex max-w-7xl items-center gap-3 px-5 py-[11.5px]">
            {/* Zone 1 — identity */}
            <Link to="/community" aria-label="Meeticulous Circle" className="flex shrink-0 items-center gap-2 no-underline">
              <img src="/brand/meeticulous-wordmark.svg" alt="Meeticulous" width="110" height="18" className="h-[18px] w-auto" />
              <span className="rounded-full bg-blush px-2 py-0.5 text-xs font-semibold text-maroon">{tag}</span>
            </Link>

            {/* Zone 2 — community nav: spaces as words */}
            <nav aria-label="Spaces" className="flex min-w-0 items-center gap-1 overflow-x-auto">
              <Link to="/community" aria-current={active === 'feed' ? 'page' : undefined} className={cSpace(active === 'feed')}>All</Link>
              {spaces.map((s) => (
                <Link key={s.key} to={`/community/s/${s.key}`} aria-current={active === s.key ? 'page' : undefined} className={cSpace(active === s.key)}>{s.title}</Link>
              ))}
            </nav>

            {/* Zone 3 — search: visible bar that widens on focus and drops a
                suggestions panel (Recent + prompts). Panel items use onMouseDown
                so the choice registers before the input's blur closes it. */}
            <div className="relative ml-auto shrink-0">
              <form role="search" onSubmit={(e) => { e.preventDefault(); const q = searchQuery.trim(); if (q) pushRecent(q); }} className="flex w-40 items-center gap-2 rounded-full bg-cream px-3.5 py-1.5 transition-[width] duration-200 ease-out focus-within:w-72 focus-within:ring-2 focus-within:ring-maroon/20">
                <Search size={14} className="shrink-0 text-muted" aria-hidden="true" />
                <input ref={searchRef} type="search" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onFocus={() => setSearchFocused(true)} onBlur={() => setTimeout(() => setSearchFocused(false), 150)} aria-label="Search the community" aria-expanded={searchFocused} placeholder="Search hosts, posts, spaces…" className="h-6 min-h-0 min-w-0 flex-1 appearance-none border-0 bg-transparent p-0 text-[13px] leading-6 text-ink outline-none placeholder:text-muted focus:border-0 focus:outline-none focus:shadow-none focus:ring-0" />
              </form>
              {searchFocused && (
                <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-80 overflow-hidden rounded-2xl border border-line bg-white py-2 shadow-xl">
                  {recent.length > 0 && (
                    <>
                      <div className="flex items-center justify-between px-4 pb-1 pt-1">
                        <span className="text-[11px] font-bold uppercase tracking-wide text-muted">Recent</span>
                        <button type="button" onMouseDown={(e) => { e.preventDefault(); clearRecent(); }} className="text-xs font-semibold text-maroon hover:underline">Clear all</button>
                      </div>
                      {recent.map((q) => (
                        <button key={`r-${q}`} type="button" onMouseDown={(e) => { e.preventDefault(); runSuggest(q); }} className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-ink hover:bg-pink-100">
                          <Clock size={16} className="shrink-0 text-muted" aria-hidden="true" /><span className="truncate">{q}</span>
                        </button>
                      ))}
                      <div className="my-1.5 border-t border-line" />
                    </>
                  )}
                  <div className="px-4 pb-1 pt-1 text-[11px] font-bold uppercase tracking-wide text-muted">Try searching for</div>
                  {SEARCH_SUGGESTIONS.map((q) => (
                    <button key={`s-${q}`} type="button" onMouseDown={(e) => { e.preventDefault(); runSuggest(q); }} className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-ink hover:bg-pink-100">
                      <Search size={16} className="shrink-0 text-muted" aria-hidden="true" /><span className="truncate">{q}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex shrink-0 items-center gap-2">
              <button type="button" onClick={() => onCompose?.('post')} className="flex items-center gap-1 rounded-full bg-maroon px-3.5 py-1.5 text-[13px] font-semibold text-cream shadow-sm transition-colors hover:bg-maroon-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-maroon/40">
                <Plus size={14} aria-hidden="true" /> Post
              </button>

              <Link to="/community/alerts" aria-label={unread ? `Alerts, ${unread} unread` : 'Alerts'} aria-current={active === 'alerts' ? 'page' : undefined} className={gIcon(active === 'alerts')}>
                <Bell size={16} aria-hidden="true" />
                {unread > 0 && <span className="absolute -right-1 -top-1 min-w-[17px] rounded-full bg-maroon px-1 text-center text-[10px] font-bold leading-[17px] text-white">{unread > 9 ? '9+' : unread}</span>}
              </Link>

              <button type="button" onClick={() => setDrawerOpen(true)} aria-label="Open profile menu" aria-expanded={drawerOpen} className="ml-0.5 grid h-9 w-9 place-items-center rounded-xl font-display text-[13px] font-extrabold text-[#5c0620] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-maroon/40" style={{ background: 'radial-gradient(120% 120% at 30% 20%,#FFD7E0,#FF9FB0 60%,#E0506F)' }}>
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
                <div className="flex items-center gap-1.5 text-[11px] leading-none text-muted">
                  Powered by <img src="/brand/meeticulous-wordmark.svg" alt="Meeticulous" width="84" height="14" className="relative top-[0.5px] h-[13px] w-auto" />
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
          <button type="button" onClick={() => setFilterOpen(true)} aria-label="Filter the feed" aria-expanded={filterOpen} className={`flex min-h-[44px] flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-maroon/40 ${curTab !== 'everyone' ? 'text-maroon' : 'text-muted'}`}>
            <ListFilter size={22} aria-hidden="true" />Filter
          </button>
          <div className="flex flex-1 items-center justify-center">
            <button type="button" onClick={() => onCompose?.('post')} aria-label="Add a post" className="grid h-14 w-14 -translate-y-4 place-items-center rounded-full bg-maroon text-cream shadow-lg shadow-maroon/40 ring-4 ring-white transition-transform hover:bg-maroon-dark active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-maroon">
              <Plus size={26} strokeWidth={2.6} aria-hidden="true" />
            </button>
          </div>
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

      {/* Mobile feed-filter sheet — opened by the bottom-bar Filter icon. Options
          drive the feed via the ?tab= param, so no shared state is needed. */}
      {v2 && filterOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Filter the feed">
          <div className="absolute inset-0 bg-ink/30" onClick={() => setFilterOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 rounded-t-3xl bg-white p-4 shadow-2xl" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line" />
            <h2 className="px-1 pb-1 font-display text-base font-extrabold text-ink">Show</h2>
            <nav aria-label="Feed filter" className="flex flex-col">
              {[{ key: 'everyone', label: 'Everyone', to: '/community' }, { key: 'updates', label: 'Updates', to: '/community?tab=updates' }].map((o) => (
                <Link key={o.key} to={o.to} onClick={() => setFilterOpen(false)} aria-current={curTab === o.key ? 'page' : undefined} className={navCls(curTab === o.key)}>{o.label}</Link>
              ))}
            </nav>
          </div>
        </div>
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

// ─────────────────────────────────────────────────────────────────────────────
// DashboardLayoutV2 — the Host Lab shell, on the REAL dashboard.
//
// This is the flat/compact/chevron rail prototyped in pages/hostlab, adopted as
// the actual host dashboard layout behind the `dashboard_v2` flag (ships OFF).
// Unlike the lab it drives EVERYTHING off the live nav model and real pages:
//   · nav rows + sub-pages come from NAV_V2 + its helpers (ConsoleSidebar.jsx),
//     the same real `/dashboard/*` routes ConsoleSidebar serves — not mockData;
//   · topbar notifications, profile and the mobile tab bar are the real
//     components, with real auth and real API calls;
//   · `children` is the real routed page, wrapped unchanged.
//
// Groups: NAV_V2's flat sections are bucketed into Main / Business / Account to
// match the lab's IA. A section with one page is a straight link; a section with
// several expands its pages IN PLACE under a chevron. Collapsed, the rail is
// icon-only and the pages arrive in a hover flyout, so nothing becomes
// unreachable. navParity.test.jsx pins that every NAV route stays reachable.
//
// No command-palette search here: the lab's was mock-backed, and there is no
// /host/search endpoint yet. ponytail: add search when that endpoint lands.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, NavLink, useLocation } from 'react-router-dom';
import {
  Home, CalendarDays, Users, MessagesSquare, Package, CalendarRange,
  CreditCard, TrendingUp, Settings, ChevronRight, PanelLeft, Sparkles, X,
  LifeBuoy,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import useIsMobile from '../../hooks/useIsMobile';
import useSupportUnread from '../../hooks/useSupportUnread';
import useFeatureFlags from '../../hooks/useFeatureFlags';
import { normalizePlan } from '../../utils/themeUtils';
import { cn } from '../dashboard/ui/cn';
import { PageTransition } from '../dashboard/ui/PageTransition';
import {
  visibleSections, resolveActive, firstItemTo, isLocked, computeBadges, isLeafSection,
} from './ConsoleSidebar';
import { NotifBell, ProfileMenu } from './DashboardLayout';
import { GROUPS } from './dashboardV2Groups';
import MobileTabBar from './MobileTabBar';
import KycNudgeStrip from '../dashboard/KycNudgeStrip';
import PullToRefresh from '../dashboard/ui/PullToRefresh';
import { RefreshProvider } from '../dashboard/ui/refreshContext';
import '../dashboard/ui/tokens.css';

const RAIL = 200;      // expanded
const RAIL_MIN = 56;   // icon only
const RAIL_KEY = 'dashboard:rail';
const ring = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose';

// Monoline glyph per section id — the lab's flat look, keyed by the live NAV_V2
// section ids so adding a section just needs an entry here (falls back to Home).
const ICONS = {
  home: Home, bookings: CalendarDays, clients: Users, messages: MessagesSquare,
  catalog: Package, schedule: CalendarRange, money: CreditCard, grow: TrendingUp,
  settings: Settings,
};

/** Collapse state, remembered per viewer. Storage can throw / be cleared, so it
 *  is never trusted and never required. */
const useRailState = () => {
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(RAIL_KEY) === '1'; } catch { return false; }
  });
  const toggle = () => setCollapsed((v) => {
    try { localStorage.setItem(RAIL_KEY, v ? '0' : '1'); } catch { /* not worth caring about */ }
    return !v;
  });
  return [collapsed, toggle];
};

const Icon = ({ id, className, strokeWidth = 2.2 }) => {
  const El = ICONS[id] || Home;
  return <El className={className} strokeWidth={strokeWidth} />;
};

const Badge = ({ n, on }) => (
  <span className={cn('ml-auto grid min-h-[16px] min-w-[16px] place-items-center rounded-full px-1 text-[9.5px] font-bold leading-none', on ? 'bg-white text-maroon' : 'bg-rose text-white')}>
    {n > 99 ? '99+' : n}
  </span>
);

/** One section row. A multi-page section carries a chevron that expands it in
 *  place; the row itself still navigates to the section's first page, so the
 *  chevron is never the only way in. */
const NavRow = ({ section, plan, badges, activeTo, expanded, onToggle, onNavigate, collapsed }) => {
  const landing = firstItemTo(section, plan);
  const multi = !isLeafSection(section);
  const attention = section.items.some((i) => (i.badgeKey ? badges[i.badgeKey] || 0 : 0) > 0);
  const sectionActive = section.items.some((i) => i.to === activeTo);

  if (collapsed) {
    return (
      <li className="group/row relative">
        <NavLink
          to={landing || '#'}
          onClick={onNavigate}
          title={section.label}
          className={cn('relative mx-auto grid h-8 w-8 place-items-center rounded-sm transition', ring,
            sectionActive ? 'bg-maroon text-white' : 'text-ink/55 hover:bg-blush hover:text-ink')}
        >
          <Icon id={section.id} className="h-[15px] w-[15px]" />
          {attention && <span className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-rose" />}
        </NavLink>
        <div className="pointer-events-none absolute left-full top-0 z-50 hidden pl-1.5 group-hover/row:block group-focus-within/row:block">
          <div className="pointer-events-auto min-w-[150px] overflow-hidden rounded-sm border-2 border-neutral-200 bg-white py-1 dash-elev-3">
            <p className="px-2.5 py-1 text-[11.5px] font-bold text-ink">{section.label}</p>
            {multi && (
              <ul className="border-t-2 border-neutral-200 pt-1">
                {section.items.map((pg) => (
                  <li key={pg.to}>
                    <NavLink
                      to={isLocked(pg, plan) ? '#' : pg.to}
                      onClick={isLocked(pg, plan) ? (e) => e.preventDefault() : onNavigate}
                      className={cn('block px-2.5 py-1 text-[11.5px] transition', ring,
                        pg.to === activeTo ? 'bg-blush font-semibold text-maroon' : 'font-medium text-ink/55 hover:bg-cream hover:text-ink')}
                    >
                      {pg.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </li>
    );
  }

  return (
    <li>
      <div className="relative">
        <NavLink
          to={landing || '#'}
          onClick={onNavigate}
          className={cn('flex h-7 items-center gap-2 rounded-sm px-2 text-[12px] font-semibold transition', ring,
            multi && 'pr-7',
            sectionActive ? 'bg-maroon text-white' : 'text-ink/60 hover:bg-blush hover:text-ink')}
        >
          <Icon id={section.id} className="h-[15px] w-[15px] shrink-0" />
          <span className="flex-1 truncate">{section.label}</span>
          {attention && <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-rose" />}
        </NavLink>
        {multi && (
          <button
            type="button"
            onClick={() => onToggle(section.id)}
            aria-expanded={expanded}
            aria-label={`${expanded ? 'Collapse' : 'Expand'} ${section.label}`}
            className={cn('absolute right-1 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-xs text-ink/40 transition hover:text-ink', ring)}
          >
            <ChevronRight className={cn('h-3.5 w-3.5 transition-transform', expanded && 'rotate-90')} strokeWidth={2.6} />
          </button>
        )}
      </div>

      {multi && expanded && (
        <ul className="ml-[15px] mt-0.5 flex flex-col gap-px border-l-2 border-neutral-200 pl-2.5">
          {section.items.map((pg) => {
            const locked = isLocked(pg, plan);
            const count = pg.badgeKey ? badges[pg.badgeKey] || 0 : 0;
            return (
              <li key={pg.to}>
                <NavLink
                  to={locked ? '#' : pg.to}
                  onClick={locked ? (e) => e.preventDefault() : onNavigate}
                  className={cn('flex h-6 items-center rounded-xs px-2 text-[11.5px] transition', ring,
                    pg.to === activeTo ? 'bg-blush font-semibold text-maroon' : 'font-medium text-ink/50 hover:bg-cream hover:text-ink',
                    locked && 'cursor-default text-ink/25 hover:bg-transparent')}
                >
                  <span className="truncate">{pg.label}</span>
                  {locked && <span className="ml-auto text-[9px] font-semibold uppercase tracking-wide text-ink/25">Locked</span>}
                  {count > 0 && <Badge n={count} />}
                </NavLink>
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
};

const SidebarBody = ({ sections, plan, badges, activeTo, onNavigate, collapsed = false }) => {
  const active = resolveActive(useLocation().pathname, sections);
  const [open, setOpen] = useState(() => active.sectionId || null);
  useEffect(() => { if (active.sectionId) setOpen(active.sectionId); }, [active.sectionId]);

  const byId = (id) => sections.find((s) => s.id === id);

  return (
    <>
      <nav aria-label="Dashboard sections" className="dash-noscrollbar flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-2 py-2">
        {GROUPS.map((group, i) => {
          const rows = group.ids.map(byId).filter(Boolean);
          if (rows.length === 0) return null;
          return (
            <div key={group.label}>
              {collapsed
                ? i > 0 && <div className="mx-auto mb-1.5 h-px w-6 bg-neutral-200" />
                : <p className="px-2 pb-1 text-[9.5px] font-bold uppercase tracking-[0.1em] text-ink/35">{group.label}</p>}
              <ul className="flex flex-col gap-px">
                {rows.map((section) => (
                  <NavRow
                    key={section.id}
                    section={section}
                    plan={plan}
                    badges={badges}
                    activeTo={activeTo}
                    collapsed={collapsed}
                    expanded={open === section.id}
                    onToggle={(id) => setOpen((o) => (o === id ? null : id))}
                    onNavigate={onNavigate}
                  />
                ))}
              </ul>
            </div>
          );
        })}
      </nav>

      <div className="shrink-0 border-t-2 border-neutral-200 px-2 py-1.5">
        {collapsed ? (
          <a href="/changelog" target="_blank" rel="noreferrer" title="View changelog"
            className={cn('mx-auto grid h-7 w-7 place-items-center rounded-sm text-ink/35 transition hover:bg-blush hover:text-maroon', ring)}>
            <Sparkles className="h-3.5 w-3.5" strokeWidth={2.2} />
          </a>
        ) : (
          <>
            <a href="/changelog" target="_blank" rel="noreferrer"
              className={cn('flex items-center gap-1.5 rounded-xs px-1.5 py-1 text-[11px] font-semibold text-ink/50 transition hover:bg-blush hover:text-maroon', ring)}>
              <Sparkles className="h-3 w-3 shrink-0" strokeWidth={2.4} />
              View changelog
            </a>
            <p className="px-1.5 pt-0.5 text-[9.5px] font-medium text-ink/30">© 2026 Meeticulous</p>
          </>
        )}
      </div>
    </>
  );
};

/* Topbar — real notifications + profile, no mock search. */
const TopbarV2 = ({ onOpenNav, user, plan, planStyle, initial, logout }) => (
  <header className="sticky top-0 z-30 flex h-11 shrink-0 items-center gap-1.5 border-b-2 border-neutral-200 bg-cream/95 px-2.5 backdrop-blur sm:px-4">
    <Link to="/dashboard" title="Meeticulous — Home" aria-label="Meeticulous — Home" className="lg:hidden">
      <img src="/brand/meeticulous-icon.svg" alt="Meeticulous" className="h-7 w-7 object-contain" />
    </Link>
    <div className="ml-auto flex shrink-0 items-center gap-1">
      <Link to="/help" title="Support" aria-label="Support"
        className="grid h-9 w-9 place-items-center rounded-full text-neutral-500 transition-colors hover:bg-primary/5 hover:text-primary">
        <LifeBuoy className="h-[19px] w-[19px]" strokeWidth={1.7} />
      </Link>
      <NotifBell />
      <ProfileMenu user={user} plan={plan} planStyle={planStyle} initial={initial} logout={logout} />
    </div>
  </header>
);

const DashboardLayoutV2 = ({ children }) => {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const isMobile = useIsMobile('(max-width: 1023px)');

  const [navOpen, setNavOpen] = useState(false);
  const [railCollapsed, toggleRail] = useRailState();
  const navTriggerRef = useRef(null);
  const mainRef = useRef(null);

  useEffect(() => { setNavOpen(false); mainRef.current?.scrollTo?.({ top: 0 }); }, [pathname]);

  const plan = normalizePlan(user?.plan);
  const initial = (user?.name || user?.email || 'U').trim().charAt(0).toUpperCase();
  const { flags } = useFeatureFlags();
  // The v2 shell IS the redesigned grouping, so the rail always uses NAV_V2
  // regardless of the separate console_v2 flag (navFor keys off console_v2).
  // Forcing it here keeps Clients/Schedule/Grow — which only exist as their own
  // sections in NAV_V2 — on the rail even when console_v2 is off. navParity's
  // GROUPS-coverage test pins that every NAV_V2 section has a bucket.
  const sections = visibleSections({ user, plan, flags: { ...flags, console_v2: true } });
  const chatUnread = useSupportUnread();
  const badges = { ...computeBadges(user), chatUnread };
  const activeTo = resolveActive(pathname, sections).to;

  const closeNav = useCallback(() => setNavOpen(false), []);

  return (
    <RefreshProvider>
      <div className="dash min-h-[100dvh] bg-cream">
        {/* index.css's unlayered `button{min-height:40px}` / input/select floors
            would bloat every compact control here, exactly as in the lab. Lifted
            only under .dash-v2; nothing here relies on the floor (controls are
            ≥24px, the WCAG 2.2 AA target min). */}
        <style>{`
          .dash-v2 button { min-height: 0; }
          .dash-v2 input, .dash-v2 select { min-height: 0; }
        `}</style>

        {/* Desktop rail */}
        <aside
          className="dash-v2 group/rail fixed bottom-0 left-0 top-0 z-40 hidden flex-col border-r-2 border-neutral-200 bg-cream transition-[width] duration-200 lg:flex"
          style={{ width: railCollapsed ? RAIL_MIN : RAIL }}
        >
          <div className={cn('flex h-11 shrink-0 items-center border-b-2 border-neutral-200', railCollapsed ? 'justify-center px-0' : 'gap-1.5 px-2.5')}>
            <Link to="/dashboard" aria-label="Meeticulous — Home" className={cn('grid shrink-0 place-items-center rounded-xs', ring)}>
              <img src="/brand/meeticulous-icon.svg" alt="" aria-hidden="true" className="h-6 w-6 object-contain" />
            </Link>
            {!railCollapsed && <span className="flex-1 truncate font-display text-[12.5px] font-bold tracking-[-0.02em] text-ink">Meeticulous</span>}
            <button
              type="button"
              onClick={toggleRail}
              aria-label={railCollapsed ? 'Expand navigation' : 'Collapse navigation'}
              title={railCollapsed ? 'Expand' : 'Collapse'}
              className={cn('grid h-6 w-6 shrink-0 place-items-center rounded-xs text-ink/35 transition hover:bg-blush hover:text-maroon', ring,
                railCollapsed ? 'absolute -right-3 top-3 border-2 border-neutral-200 bg-cream' : 'opacity-0 group-hover/rail:opacity-100 focus-visible:opacity-100')}
            >
              <PanelLeft className="h-3.5 w-3.5" strokeWidth={2.2} />
            </button>
          </div>
          <SidebarBody sections={sections} plan={plan} badges={badges} activeTo={activeTo} collapsed={railCollapsed} />
        </aside>

        {/* Mobile drawer */}
        {isMobile && navOpen && createPortal(
          <div className="lg:hidden">
            <div className="fixed inset-0 z-[60] bg-ink/40" onClick={closeNav} aria-hidden="true" />
            <div role="dialog" aria-modal="true" aria-label="Navigation" className="dash-v2 fixed inset-y-0 left-0 z-[60] flex w-[248px] max-w-[84vw] flex-col bg-cream">
              <div className="flex h-11 shrink-0 items-center gap-1.5 border-b-2 border-neutral-200 px-2.5">
                <img src="/brand/meeticulous-icon.svg" alt="" aria-hidden="true" className="h-6 w-6 object-contain" />
                <span className="flex-1 font-display text-[12.5px] font-bold text-ink">Meeticulous</span>
                <button type="button" onClick={closeNav} aria-label="Close navigation" className="grid h-8 w-8 place-items-center rounded-full text-ink/50 hover:bg-blush">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <SidebarBody sections={sections} plan={plan} badges={badges} activeTo={activeTo} onNavigate={closeNav} />
            </div>
          </div>,
          document.body,
        )}

        {/* Content — offset by the fixed rail on lg+. */}
        <div className={cn('transition-[padding] duration-200', railCollapsed ? 'lg:pl-[56px]' : 'lg:pl-[200px]')}>
          <TopbarV2 onOpenNav={() => setNavOpen(true)} user={user} plan={plan} initial={initial} logout={logout} />
          <main ref={mainRef} className="min-h-[calc(100dvh-44px)]">
            <PullToRefresh scrollerRef={mainRef}>
              <div className="mx-auto w-full max-w-[1180px] px-2.5 pb-20 pt-3.5 sm:px-4 lg:pb-7">
                <KycNudgeStrip />
                <PageTransition>{children}</PageTransition>
              </div>
            </PullToRefresh>
          </main>
        </div>

        <MobileTabBar onOpenMore={() => setNavOpen(true)} moreTriggerRef={navTriggerRef} />
      </div>
    </RefreshProvider>
  );
};

export default DashboardLayoutV2;

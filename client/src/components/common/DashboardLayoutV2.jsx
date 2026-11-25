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
  LifeBuoy, Copy, ArrowUpRight,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { markLinkShared } from '../../services/api';
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
import useDashboardChrome from '../../hooks/useDashboardChrome';
import KycNudgeStrip from '../dashboard/KycNudgeStrip';
import PullToRefresh from '../dashboard/ui/PullToRefresh';
import { RefreshProvider } from '../dashboard/ui/refreshContext';
import '../dashboard/ui/tokens.css';

const RAIL = 232;      // expanded (Kept: 13.5px rows, compact enough for 768px-tall screens)
const RAIL_MIN = 64;   // icon only
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
          className={cn('relative mx-auto grid h-9 w-9 place-items-center rounded-[10px] transition', ring,
            sectionActive ? 'bg-white text-maroon shadow-[var(--shadow-sm)]' : 'text-muted hover:bg-white/70 hover:text-ink')}
        >
          <Icon id={section.id} className="h-[18px] w-[18px]" />
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
          className={cn('flex h-[34px] items-center gap-2.5 rounded-[10px] px-2.5 text-[13.5px] font-medium transition', ring,
            multi && 'pr-9',
            // Kept: the active row is a white pill with maroon text — never a solid
            // maroon block, which was the loudest thing on every page.
            sectionActive ? 'bg-white font-semibold text-maroon shadow-[var(--shadow-sm)]' : 'text-ink hover:bg-white/70')}
        >
          <Icon id={section.id} className={cn('h-[18px] w-[18px] shrink-0', sectionActive ? 'text-maroon' : 'text-muted')} />
          <span className="flex-1 truncate">{section.label}</span>
          {attention && <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-rose" />}
        </NavLink>
        {multi && (
          <button
            type="button"
            onClick={() => onToggle(section.id)}
            aria-expanded={expanded}
            aria-label={`${expanded ? 'Collapse' : 'Expand'} ${section.label}`}
            className={cn('absolute right-1.5 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-[10px] text-faint transition hover:text-ink', ring)}
          >
            <ChevronRight className={cn('h-3.5 w-3.5 transition-transform', expanded && 'rotate-90')} strokeWidth={2.6} />
          </button>
        )}
      </div>

      {multi && expanded && (
        <ul className="mb-0.5 ml-[19px] mt-0.5 flex flex-col gap-px border-l-2 border-neutral-200 pl-2.5">
          {section.items.map((pg) => {
            const locked = isLocked(pg, plan);
            const count = pg.badgeKey ? badges[pg.badgeKey] || 0 : 0;
            return (
              <li key={pg.to}>
                <NavLink
                  to={locked ? '#' : pg.to}
                  onClick={locked ? (e) => e.preventDefault() : onNavigate}
                  className={cn('flex h-7 items-center rounded-[8px] px-2.5 text-[13px] transition', ring,
                    pg.to === activeTo ? 'font-semibold text-maroon' : 'text-muted hover:bg-white/70 hover:text-ink',
                    locked && 'cursor-default text-ink/30 hover:bg-transparent')}
                >
                  <span className="truncate">{pg.label}</span>
                  {locked && <span className="ml-auto rounded-[6px] bg-blush px-2 text-[11px] font-semibold text-maroon">Pro</span>}
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
      <nav aria-label="Dashboard sections" className="dash-noscrollbar flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-3 py-2">
        {GROUPS.map((group, i) => {
          const rows = group.ids.map(byId).filter(Boolean);
          if (rows.length === 0) return null;
          return (
            <div key={group.label}>
              {collapsed
                ? i > 0 && <div className="mx-auto mb-1.5 h-px w-6 bg-neutral-200" />
                : <p className="mb-0 px-2.5 pb-1 text-[11.5px] font-medium text-faint">{group.label}</p>}
              <ul className="flex flex-col gap-0.5">
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

/* Booking link — the creator's most-used control, top-right on every page
 * (founder pick, after Topmate). Opens the public page; Copy is its own button. */
const copyBookingLink = async (username) => {
  if (!username) { toast.error('Set your username first.'); return; }
  try {
    await navigator.clipboard.writeText(`${window.location.origin}/${username}`);
    toast.success('Booking link copied');
    try { localStorage.setItem('mt_golive_link_shared', '1'); } catch { /* fine */ }
    markLinkShared();
  } catch { toast.error('Could not copy your link.'); }
};
/* Booking link card — bottom-left of the rail (founder pick, 2026-11-25): your
 * page, one tap to copy, one to open. Collapsed rail shows just the copy button. */
const BookingLinkCard = ({ user, collapsed }) => {
  if (!user?.username) return null;
  const host = window.location.host.replace(/^www\./, '');
  const copy = () => copyBookingLink(user.username);
  if (collapsed) {
    return (
      <button type="button" onClick={copy} aria-label="Copy booking link" title="Copy booking link"
        className={cn('mx-auto grid h-10 w-10 place-items-center rounded-[12px] bg-white text-maroon transition hover:bg-pink-100', ring)}>
        <Copy className="h-[18px] w-[18px]" strokeWidth={2.2} />
      </button>
    );
  }
  return (
    <div className="rounded-[14px] bg-white p-2.5 pl-3">
      <p className="mb-0 text-[11.5px] font-medium text-faint">Your booking page</p>
      <div className="mt-0.5 flex items-center gap-1.5">
        <a href={`/${user.username}`} target="_blank" rel="noreferrer" title="Open your booking page"
          className={cn('flex min-w-0 flex-1 items-center gap-1 rounded-[6px] text-[13px] font-semibold text-ink transition hover:text-maroon', ring)}>
          <span className="min-w-0 truncate">{host}/{user.username}</span>
          <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-faint" strokeWidth={2.2} />
        </a>
        <button type="button" onClick={copy} aria-label="Copy booking link" title="Copy booking link"
          className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-[8px] bg-maroon text-white transition hover:bg-maroon-dark', ring)}>
          <Copy className="h-3.5 w-3.5" strokeWidth={2.4} />
        </button>
      </div>
    </div>
  );
};

/* Topbar — help, notifications and the profile card (top-right corner, founder
 * pick). Desktop shows the card with your name; phones show just the avatar. */
const TopbarV2 = ({ onOpenNav, user, plan, planStyle, initial, logout, onHome }) => (
  <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 bg-cream/90 px-4 pt-[env(safe-area-inset-top,0px)] backdrop-blur-md sm:px-6 lg:h-16 lg:px-8">
    {/* Mobile: the logo is Home (founder decision, 2026-11-25), so it looks pressable
        and carries a maroon underline while you're on Today. */}
    <Link to="/dashboard" title="Meeticulous — Home" aria-label="Meeticulous — Home"
      className="group/home grid justify-items-center gap-1 rounded-[12px] p-1 transition active:scale-95 lg:hidden">
      <img src="/brand/meeticulous-icon.svg" alt="Meeticulous" className="h-8 w-8 object-contain" />
      <span aria-hidden="true" className={cn('h-[3px] w-4 rounded-full', onHome ? 'bg-maroon' : 'bg-transparent')} />
    </Link>
    <div className="ml-auto flex shrink-0 items-center gap-2">
      <Link to="/help" title="Support" aria-label="Support"
        className="grid h-10 w-10 place-items-center rounded-[12px] bg-white text-muted transition-colors hover:text-maroon">
        <LifeBuoy className="h-[19px] w-[19px]" strokeWidth={1.8} />
      </Link>
      <NotifBell />
      <div className="hidden lg:block">
        <ProfileMenu user={user} plan={plan} planStyle={planStyle} initial={initial} logout={logout} identity
          triggerClassName="flex h-12 max-w-[260px] items-center gap-2.5 rounded-[14px] bg-white py-1.5 pl-1.5 pr-3 transition hover:bg-pink-100"
          chevronClassName="h-4 w-4 shrink-0 text-faint" />
      </div>
      <div className="lg:hidden"><ProfileMenu user={user} plan={plan} planStyle={planStyle} initial={initial} logout={logout} /></div>
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

  // The window scrolls in this shell (<main> is min-h, not a scroll container), so
  // reset the window on navigation, not <main>.
  useEffect(() => { setNavOpen(false); window.scrollTo({ top: 0 }); }, [pathname]);
  useDashboardChrome();

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
          className="dash-v2 group/rail fixed bottom-0 left-0 top-0 z-40 hidden flex-col bg-neutral-100 transition-[width] duration-200 lg:flex"
          style={{ width: railCollapsed ? RAIL_MIN : RAIL }}
        >
          <div className={cn('flex h-14 shrink-0 items-center', railCollapsed ? 'justify-center px-0' : 'gap-2.5 px-4')}>
            <Link to="/dashboard" aria-label="Meeticulous — Home" className={cn('grid shrink-0 place-items-center rounded-xs', ring)}>
              <img src="/brand/meeticulous-icon.svg" alt="" aria-hidden="true" className="h-7 w-7 object-contain" />
            </Link>
            {!railCollapsed && <span className="flex-1 truncate font-display text-[17px] font-extrabold tracking-[-0.02em] text-maroon">Meeticulous</span>}
            <button
              type="button"
              onClick={toggleRail}
              aria-label={railCollapsed ? 'Expand navigation' : 'Collapse navigation'}
              title={railCollapsed ? 'Expand' : 'Collapse'}
              className={cn('grid h-6 w-6 shrink-0 place-items-center rounded-xs text-ink/35 transition hover:bg-blush hover:text-maroon', ring,
                railCollapsed ? 'absolute -right-3 top-5 bg-white shadow-[var(--shadow-sm)]' : 'opacity-0 group-hover/rail:opacity-100 focus-visible:opacity-100')}
            >
              <PanelLeft className="h-3.5 w-3.5" strokeWidth={2.2} />
            </button>
          </div>
          <SidebarBody sections={sections} plan={plan} badges={badges} activeTo={activeTo} collapsed={railCollapsed} />
          <div className="shrink-0 p-3 pt-0">
            <BookingLinkCard user={user} collapsed={railCollapsed} />
          </div>
        </aside>

        {/* Mobile drawer */}
        {isMobile && navOpen && createPortal(
          <div className="lg:hidden">
            <div className="fixed inset-0 z-[60] bg-ink/40" onClick={closeNav} aria-hidden="true" />
            <div role="dialog" aria-modal="true" aria-label="Navigation" className="dash-v2 fixed inset-y-0 left-0 z-[60] flex w-[288px] max-w-[86vw] flex-col bg-neutral-100 pb-[env(safe-area-inset-bottom,0px)] pt-[env(safe-area-inset-top,0px)]">
              <div className="flex h-16 shrink-0 items-center gap-2.5 px-5">
                <img src="/brand/meeticulous-icon.svg" alt="" aria-hidden="true" className="h-8 w-8 object-contain" />
                <span className="flex-1 font-display text-[18px] font-extrabold tracking-[-0.02em] text-maroon">Meeticulous</span>
                <button type="button" onClick={closeNav} aria-label="Close navigation" className="grid h-10 w-10 place-items-center rounded-[12px] text-muted hover:bg-white">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <SidebarBody sections={sections} plan={plan} badges={badges} activeTo={activeTo} onNavigate={closeNav} />
            </div>
          </div>,
          document.body,
        )}

        {/* Content — offset by the fixed rail on lg+. */}
        <div className={cn('transition-[padding] duration-200', railCollapsed ? 'lg:pl-[64px]' : 'lg:pl-[232px]')}>
          <TopbarV2 onOpenNav={() => setNavOpen(true)} user={user} plan={plan} initial={initial} logout={logout} onHome={pathname === '/dashboard'} />
          <main className="min-h-[calc(100dvh-44px)]">
            {/* No scrollerRef: the window scrolls here. Passing <main> made scrollTop read 0
                on every drag, so scrolling back UP on a phone was hijacked into a refresh. */}
            <PullToRefresh>
              <div className="mx-auto w-full max-w-[1240px] px-4 pb-28 pt-2 sm:px-6 lg:mx-0 lg:px-8 lg:pb-12 lg:pt-4">
                {/* Today shows KYC inside its own "Needs you" card, so the shell notice
                    would say the same thing twice there. */}
                {pathname !== '/dashboard' && <KycNudgeStrip />}
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

import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  X, ExternalLink, LogOut, Headset, ChevronDown, Bell, LifeBuoy,
  User, CreditCard, ShieldCheck, Check, Copy, BadgeCheck,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { isHost } from '../../utils/roleRoutes';
import useIsMobile from '../../hooks/useIsMobile';
import useLiveNotifications from '../../hooks/useLiveNotifications';
import { getNotifications, markAllNotificationsRead, markNotificationRead, markLinkShared, getMyAccountManager } from '../../services/api';
import { normalizePlan, GIFTED_PRO_LABEL } from '../../utils/themeUtils';
import { cn } from '../dashboard/ui/cn';
import { PageTransition } from '../dashboard/ui/PageTransition';
import ConsoleSidebar from './ConsoleSidebar';
import MobileTabBar from './MobileTabBar';
import useDashboardChrome from '../../hooks/useDashboardChrome';
import KycNudgeStrip from '../dashboard/KycNudgeStrip';
import PullToRefresh from '../dashboard/ui/PullToRefresh';
import { RefreshProvider } from '../dashboard/ui/refreshContext';
import '../dashboard/ui/tokens.css';

// Keyed by canonical plan slug (see normalizePlan) — legacy aliases like
// `explorer`/`free`/`pro` are collapsed before lookup.
const PLAN_STYLES = {
  free: { label: 'Starter', bg: 'bg-neutral-100', text: 'text-neutral-600' },
  premium: { label: 'Pro', bg: 'bg-blush', text: 'text-maroon' },
  // Archived rows: hidden from the catalogue, but their existing subscribers
  // still see a badge and carry Pro entitlements at the old price.
  creator: { label: 'Pro', bg: 'bg-blush', text: 'text-maroon' },
  professional: { label: 'Pro', bg: 'bg-blush', text: 'text-maroon' },
  supreme: { label: 'Supreme', bg: 'bg-maroon', text: 'text-white' },
};

// Humanize a category slug ("career-coaching" -> "Career Coaching"). Falls back
// to a plain role label so the profile block always has a subtitle.
const humanizeCategory = (raw) => {
  const v = (raw || '').toString().trim();
  if (!v) return 'Host';
  return v.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
};

// Shared row style for the profile-menu links. Inset rounded slot (not an
// edge-to-edge band) so the menu reads as a stack of objects, with a rounded
// icon tile that lifts on hover.
const MENU_ROW =
  'group mx-2 flex w-[calc(100%-16px)] items-center gap-2.5 rounded-xl px-2 py-2 text-left text-sm font-medium text-neutral-700 transition-colors hover:bg-blush hover:text-ink';
const ROW_TILE =
  'grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-neutral-100 text-neutral-500 transition group-hover:bg-white group-hover:text-maroon';

// Lock body scroll while a mobile sheet / drawer is open (no-op when inactive).
const useBodyScrollLock = (active) => {
  useEffect(() => {
    if (!active) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [active]);
};

// One popup surface, three shapes: an anchored dropdown on desktop; on mobile
// either an app-style bottom sheet (notifications) or a native-feel right
// side-drawer (`variant="drawer"`, the account menu). Both mobile shapes are
// portaled to body so the topbar's backdrop-blur — which would otherwise become
// the containing block for `fixed` — can't trap them.
const MenuSurface = ({ open, onClose, isMobile, title, align = 'right', width = 'w-72', role = 'menu', variant = 'sheet', placement = 'down', children }) => {
  // Right side-drawer: always mounted so the translate-x slide can animate both
  // ways; off-screen + inert while closed.
  if (isMobile && variant === 'drawer') {
    return createPortal(
      <div className={cn('fixed inset-0 z-[90] lg:hidden', open ? '' : 'pointer-events-none')} aria-hidden={!open}>
        <div
          onClick={onClose}
          aria-hidden="true"
          className={cn('absolute inset-0 bg-ink/40 transition-opacity duration-300', open ? 'opacity-100' : 'opacity-0')}
        />
        <div
          role={role}
          aria-label={title}
          className={cn(
            'absolute inset-y-0 right-0 flex w-[86%] max-w-[340px] flex-col overflow-y-auto bg-white shadow-[0_0_48px_-8px_rgba(43,10,20,0.45)] transition-transform duration-300 ease-out',
            open ? 'translate-x-0' : 'translate-x-full',
          )}
        >
          <div className="flex items-center justify-between border-b border-neutral-200/60 px-5 py-3">
            <span className="text-base font-semibold text-neutral-900">{title}</span>
            <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600">
              <X className="h-5 w-5" />
            </button>
          </div>
          {children}
        </div>
      </div>,
      document.body,
    );
  }
  if (!open) return null;
  if (isMobile) {
    return createPortal(
      <div className="lg:hidden">
        <div className="fixed inset-0 z-[60] bg-black/40" onClick={onClose} aria-hidden="true" />
        <div
          className="fixed inset-x-0 bottom-0 z-[60] max-h-[85vh] overflow-y-auto rounded-t-2xl border-t border-neutral-100 bg-white pb-[max(1rem,env(safe-area-inset-bottom))] dash-elev-3"
          role={role}
          aria-label={title}
        >
          <div className="mx-auto mt-2 h-1 w-9 rounded-full bg-neutral-200" aria-hidden="true" />
          <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-3">
            <span className="text-base font-semibold text-neutral-900">{title}</span>
            <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600">
              <X className="h-5 w-5" />
            </button>
          </div>
          {children}
        </div>
      </div>,
      document.body,
    );
  }
  return (
    <div
      className={cn(
        'absolute z-50 overflow-hidden rounded-2xl border border-neutral-200/70 bg-white shadow-[0_4px_12px_-4px_rgba(43,10,20,0.1),0_16px_40px_-16px_rgba(43,10,20,0.25)]',
        placement === 'up' ? 'bottom-full mb-2' : 'top-full mt-2',
        align === 'right' ? 'right-0' : 'left-0',
        width,
      )}
      role={role}
      aria-label={title}
    >
      {children}
    </div>
  );
};

/** Support — leftmost topbar action. Routes to the Help centre. */
const SupportButton = () => (
  <Link
    to="/help"
    title="Support"
    aria-label="Support"
    className="grid h-9 w-9 place-items-center rounded-full text-neutral-500 transition-colors hover:bg-primary/5 hover:text-primary"
  >
    <LifeBuoy className="h-[19px] w-[19px]" strokeWidth={1.7} />
  </Link>
);

/** Notification bell. Anchored panel on desktop, bottom sheet on mobile.
 *  The trigger can be re-skinned by callers (the Overview shell uses white/pink)
 *  without duplicating the panel + live-update logic. */
export const NotifBell = ({
  triggerClassName = 'relative grid h-9 w-9 place-items-center rounded-full text-neutral-500 transition-colors hover:bg-primary/5 hover:text-primary',
  badgeClassName = 'absolute right-1 top-1 grid min-h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[9px] font-bold leading-none text-white',
  iconClassName = 'h-[19px] w-[19px]',
  // Minimum badge value — the Overview reference always shows a "1" marker.
  minBadge = 0,
} = {}) => {
  const [open, setOpen] = useState(false);
  const [notifs, setNotifs] = useState([]);
  const [unread, setUnread] = useState(0);
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'error'
  const ref = useRef(null);
  const isMobile = useIsMobile();
  const { user } = useAuth();

  const load = useCallback(() => {
    getNotifications('host')
      .then(({ data }) => {
        setNotifs(data.notifications || []);
        setUnread(data.unreadCount || 0);
        setStatus('ready');
      })
      .catch(() => setStatus((s) => (s === 'loading' ? 'error' : s))); // keep a good list on a later blip
  }, []);
  useEffect(() => { load(); }, [load]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (open) load(); }, [open]);
  // Live updates — refetch when the server broadcasts a new notification.
  useLiveNotifications(user?.id, load);

  // ESC closes on any size; outside-click only matters for the desktop dropdown
  // (the mobile sheet is portaled and closes via its backdrop / close button).
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
  useEffect(() => {
    if (isMobile) return undefined;
    const onPointer = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, [isMobile]);
  useBodyScrollLock(open && isMobile);

  const shownUnread = Math.max(unread, minBadge);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={triggerClassName}
        aria-label={`Notifications${shownUnread > 0 ? `, ${shownUnread} unread` : ''}`}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <Bell className={iconClassName} strokeWidth={1.7} />
        {shownUnread > 0 && (
          <span className={badgeClassName}>
            {shownUnread > 9 ? '9+' : shownUnread}
          </span>
        )}
      </button>

      <MenuSurface open={open} onClose={() => setOpen(false)} isMobile={isMobile} title="Notifications" width="w-80" role="dialog">
        <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3 md:py-3">
          {!isMobile && <span className="text-sm font-semibold text-neutral-900">Notifications</span>}
          <button
            type="button"
            className="ml-auto text-xs font-medium text-primary hover:underline"
            onClick={() => markAllNotificationsRead('host').then(load).catch(() => {})}
          >
            Mark all read
          </button>
        </div>
        {status === 'loading' && notifs.length === 0 ? (
          <ul className="max-h-80 overflow-y-auto" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <li key={i} className="flex flex-col gap-2 border-b border-neutral-50 px-4 py-3.5">
                <span className="h-3 w-2/5 animate-pulse rounded bg-neutral-100" />
                <span className="h-2.5 w-3/4 animate-pulse rounded bg-neutral-100" />
              </li>
            ))}
          </ul>
        ) : status === 'error' && notifs.length === 0 ? (
          <div className="py-10 text-center">
            <Bell className="mx-auto mb-2 h-7 w-7 text-neutral-200" />
            <p className="text-sm text-neutral-400">Couldn't load notifications</p>
            <button type="button" onClick={load} className="mt-2 text-xs font-medium text-primary hover:underline">
              Try again
            </button>
          </div>
        ) : notifs.length === 0 ? (
          <div className="py-10 text-center">
            <Bell className="mx-auto mb-2 h-7 w-7 text-neutral-200" />
            <p className="text-sm text-neutral-400">No new notifications</p>
          </div>
        ) : (
          <ul className="max-h-80 overflow-y-auto md:max-h-80">
            {notifs.map((n) => (
              <li key={n.id}>
                <Link
                  to={n.link || '#'}
                  onClick={() => {
                    markNotificationRead(n.id).catch(() => {});
                    setNotifs((list) => list.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)));
                    setUnread((u) => (n.read_at ? u : Math.max(0, u - 1)));
                    setOpen(false);
                  }}
                  className={cn(
                    'flex w-full flex-col items-start gap-0.5 border-b border-neutral-50 px-4 py-3 text-left transition-colors hover:bg-neutral-50 hover:no-underline',
                    !n.read_at && 'bg-primary/5',
                  )}
                >
                  <span className="text-sm font-medium text-neutral-800">{n.title}</span>
                  {n.body && <span className="text-xs text-neutral-500">{n.body}</span>}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </MenuSurface>
    </div>
  );
};

/** Profile avatar — anchored menu on desktop, bottom sheet on mobile. */
export const ProfileMenu = ({
  user, plan, planStyle, initial, logout,
  triggerClassName = 'flex items-center gap-1.5 rounded-full p-0.5 transition-colors hover:bg-neutral-100',
  avatarClassName = 'bg-primary/10 text-primary',
  chevronClassName = 'h-4 w-4 text-neutral-400',
  // Sidebar placement (Kept rail footer): the trigger shows name + email and the
  // menu opens upward from the bottom-left. Defaults keep the topbar behaviour.
  identity = false,
  menuPlacement = 'down',
  menuAlign = 'right',
}) => {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [acctMgr, setAcctMgr] = useState(null); // assigned account manager, or null
  const ref = useRef(null);
  const isMobile = useIsMobile();
  const category = humanizeCategory(user?.category || user?.primary_category);
  const close = () => setOpen(false);

  // Dual-capability mode switch (unified identity) — only for an account that
  // owns both spaces. Switching navigates into that space and closes the menu.
  const { mode, setMode } = useAuth();
  const navigate = useNavigate();
  const switchMode = (next) => {
    close();
    if (next === mode) return;
    setMode(next);
    navigate(next === 'hosting' ? '/dashboard' : '/user');
  };

  // Fetch the assigned account manager the first time the menu opens (lazy — avoids
  // a call on every page load). Soft-fails to null → falls back to generic support.
  const mgrFetched = useRef(false);
  useEffect(() => {
    if (!open || mgrFetched.current) return;
    mgrFetched.current = true;
    getMyAccountManager().then((d) => setAcctMgr(d?.account_manager || null));
  }, [open]);

  // Verification tick by the name: orange (brand) when verified, grey otherwise.
  const kyc = (user?.kyc_status || '').toLowerCase();
  const kycVerified = ['approved', 'verified'].includes(kyc);
  const kycTitle = kycVerified
    ? 'Verified host — view verification'
    : 'Not verified — complete verification to get paid';

  // meeticulous.com is the canonical public domain (never .in).
  const publicUrl = user?.username ? `https://meeticulous.com/${user.username}` : null;
  const copyLink = async () => {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
      markLinkShared(); // activation-funnel "shared" signal (idempotent, fire-and-forget)
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard blocked — no-op */ }
  };

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
  useEffect(() => {
    if (isMobile) return undefined;
    const onPointer = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, [isMobile]);
  useBodyScrollLock(open && isMobile);

  const Avatar = ({ size }) =>
    user?.profile_image ? (
      <img src={user.profile_image} alt={user?.name || 'Profile'} className={cn('shrink-0 rounded-full object-cover', size)} />
    ) : (
      <div className={cn('grid shrink-0 place-items-center rounded-full font-bold', avatarClassName, size)}>
        {initial}
      </div>
    );

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={triggerClassName}
        aria-label="Profile menu"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <Avatar size="h-9 w-9 text-sm" />
        {identity && (
          <span className="min-w-0 flex-1 text-left">
            <span className="block truncate text-[14px] font-semibold text-ink">{user?.name || 'Host'}</span>
            <span className="block truncate text-[12px] text-faint">{user?.username ? `@${user.username}` : (user?.email || '')}</span>
          </span>
        )}
        <ChevronDown className={cn(chevronClassName, 'transition-transform', open && 'rotate-180')} />
      </button>

      <MenuSurface open={open} onClose={close} isMobile={isMobile} title="Account" width="w-72" variant="drawer" placement={menuPlacement} align={menuAlign}>
        {/* Identity — a blush ground gives the menu a head instead of a first
            row; the two tone-on-tone arcs are the ee-thread brand motif, one per
            surface. Name + verify tick + plan badge, email beneath. */}
        <div className="relative overflow-hidden bg-blush px-4 pb-4 pt-4">
          <span aria-hidden="true" className="absolute -left-6 -top-8 h-20 w-20 rounded-full border-[3px] border-maroon/10" />
          <span aria-hidden="true" className="absolute -right-7 top-5 h-16 w-16 rounded-full border-[3px] border-maroon/10" />
          <div className="relative flex items-center gap-3">
            <Avatar size="h-12 w-12 text-base ring-[3px] ring-white" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="truncate text-sm font-bold text-neutral-900">{user?.name || 'Host'}</p>
                <Link
                  to="/dashboard/kyc"
                  onClick={close}
                  title={kycTitle}
                  aria-label={kycVerified ? 'Verified host' : 'Not verified — complete verification'}
                  className="shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <BadgeCheck
                    className={cn('h-4 w-4', kycVerified ? 'text-maroon' : 'text-neutral-400')}
                    strokeWidth={2.2}
                  />
                </Link>
              </div>
              <p className="truncate text-xs font-medium text-maroon/60">{user?.username ? `@${user.username}` : category}</p>
            </div>
          </div>
        </div>

        {/* Mode switch — Hosting / Guesting (dual-capability accounts only) */}
        {isHost(user) && (
          <div className="border-t border-neutral-200/50 px-4 py-3">
            <div className="flex gap-1 rounded-full bg-neutral-100 p-0.5">
              <button
                type="button"
                onClick={() => switchMode('hosting')}
                className={cn('flex-1 rounded-full px-3 py-1.5 text-xs font-semibold transition',
                  mode === 'hosting' ? 'bg-maroon text-white shadow-sm' : 'text-neutral-500 hover:text-neutral-800')}
              >
                Hosting
              </button>
              <button
                type="button"
                onClick={() => switchMode('traveling')}
                className={cn('flex-1 rounded-full px-3 py-1.5 text-xs font-semibold transition',
                  mode === 'traveling' ? 'bg-maroon text-white shadow-sm' : 'text-neutral-500 hover:text-neutral-800')}
              >
                Guesting
              </button>
            </div>
          </div>
        )}

        {/* Account */}
        <div className="border-t border-neutral-200/50 py-1.5">
          <Link to="/dashboard/profile" onClick={close} className={MENU_ROW}>
            <span className={ROW_TILE}><User className="h-4 w-4" strokeWidth={1.8} /></span>
            <span className="flex-1">Account information</span>
          </Link>
          <Link to="/dashboard/upgrade" onClick={close} className={MENU_ROW}>
            <span className={ROW_TILE}><CreditCard className="h-4 w-4" strokeWidth={1.8} /></span>
            <span className="flex-1">Plan &amp; billing</span>
          </Link>
          <Link to="/dashboard/kyc" onClick={close} className={MENU_ROW}>
            <span className={ROW_TILE}><ShieldCheck className="h-4 w-4" strokeWidth={1.8} /></span>
            <span className="flex-1">Verification</span>
          </Link>
        </div>

        {/* Your page */}
        <div className="border-t border-neutral-200/50 py-1.5">
          {user?.username && (
            <a href={`/${user.username}`} target="_blank" rel="noreferrer" onClick={close} className={MENU_ROW}>
              <span className={ROW_TILE}><ExternalLink className="h-4 w-4" strokeWidth={1.8} /></span>
              <span className="flex-1">View public profile</span>
            </a>
          )}
          {publicUrl && (
            <button type="button" onClick={copyLink} className={MENU_ROW}>
              <span className={ROW_TILE}>
                {copied
                  ? <Check className="h-4 w-4 text-success-fg" strokeWidth={2.4} />
                  : <Copy className="h-4 w-4" strokeWidth={1.8} />}
              </span>
              <span className="flex-1">{copied ? 'Copied' : 'Copy link'}</span>
            </button>
          )}
        </div>

        {/* Support — Help lives in the topbar; this is the human line.
            Show the assigned account manager's contact when one exists; otherwise
            fall back to the generic support line. */}
        <div className="border-t border-neutral-200/50 py-1.5">
          {acctMgr ? (
            <a
              href={acctMgr.email ? `mailto:${acctMgr.email}` : (acctMgr.phone ? `tel:${acctMgr.phone}` : '/bolt958')}
              target={acctMgr.email || acctMgr.phone ? undefined : '_blank'}
              rel="noreferrer"
              onClick={close}
              className={MENU_ROW}
            >
              <span className={ROW_TILE}><Headset className="h-4 w-4" strokeWidth={1.8} /></span>
              <span className="flex-1 min-w-0">
                <span className="block truncate">{acctMgr.name}</span>
                <span className="block truncate text-xs text-neutral-400">Your account manager</span>
              </span>
            </a>
          ) : (
            <a href="/bolt958" target="_blank" rel="noreferrer" onClick={close} className={MENU_ROW}>
              <span className={ROW_TILE}><Headset className="h-4 w-4" strokeWidth={1.8} /></span>
              <span className="flex-1">Account manager</span>
              <ExternalLink className="h-3.5 w-3.5 shrink-0 text-neutral-300" strokeWidth={1.8} />
            </a>
          )}
        </div>

        {/* Logout */}
        <div className="border-t border-neutral-200/50 py-1.5">
          <button
            type="button"
            onClick={() => { close(); logout?.(); }}
            className={cn(MENU_ROW, 'text-error-fg hover:bg-error-bg hover:text-error-fg')}
          >
            <span className={cn(ROW_TILE, 'group-hover:text-error-fg')}><LogOut className="h-4 w-4" strokeWidth={1.8} /></span>
            <span className="flex-1">Log out</span>
          </button>
        </div>
      </MenuSurface>
    </div>
  );
};

/** Sticky dashboard topbar. Right: Profile, Notifs, Support. On mobile the nav
 *  opener moved to the bottom tab bar's "More" button. */
const DashTopbar = ({ user, plan, planStyle, initial, logout }) => (
  <header className="sticky top-0 z-30 flex min-h-14 shrink-0 items-center border-b border-neutral-200/80 bg-white/95 px-4 pt-[env(safe-area-inset-top)] backdrop-blur sm:px-6 md:px-8">
    {/* Mobile-only brand logo → Home (desktop shows it in the sidebar top bar). */}
    <Link to="/dashboard" title="Meeticulous — Home" aria-label="Meeticulous — Home" className="lg:hidden">
      <img src="/brand/meeticulous-icon.svg" alt="Meeticulous" className="h-8 w-8 object-contain" />
    </Link>
    <div className="ml-auto flex items-center gap-1">
      <SupportButton />
      <NotifBell />
      <ProfileMenu user={user} plan={plan} planStyle={planStyle} initial={initial} logout={logout} />
    </div>
  </header>
);

const DashboardLayout = ({ children }) => {
  const { user, logout } = useAuth();
  useDashboardChrome();
  const { pathname } = useLocation();

  const [navOpen, setNavOpen] = useState(false);
  const navTriggerRef = useRef(null);
  const mainRef = useRef(null);
  // Route change closes the mobile drawer, and resets scroll to the top. The
  // dashboard scrolls INSIDE <main> (overflow-y-auto), so the global window-based
  // ScrollToTop can't reset it — without this you land mid-page after navigating.
  useEffect(() => {
    setNavOpen(false);
    mainRef.current?.scrollTo?.({ top: 0 });
  }, [pathname]);
  useBodyScrollLock(navOpen);

  const plan = normalizePlan(user?.plan);
  const planStyle = user?.gift
    ? { ...PLAN_STYLES.premium, label: GIFTED_PRO_LABEL }
    : PLAN_STYLES[plan] || PLAN_STYLES.starter;
  const initial = (user?.name || user?.email || 'U').trim().charAt(0).toUpperCase();

  return (
    <RefreshProvider>
    {/* h-[100dvh] + overflow-hidden (NOT min-h-screen): the shell must be viewport-
        bounded so the inner <main overflow-y-auto> is the real scroll container. With
        min-h-screen the shell grew to content height, <main> never scrolled (the window
        did), so main.scrollTop stayed 0 — and PullToRefresh (scrollerRef={mainRef}) read
        that as "always at the top" and preventDefault'd every downward touch, killing
        touch scroll on mobile. dvh tracks the mobile browser chrome. */}
    <div className="dash flex h-[100dvh] overflow-hidden bg-canvas">
      <ConsoleSidebar open={navOpen} onClose={() => setNavOpen(false)} triggerRef={navTriggerRef} />

      {/* Main — offset by the fixed single-column sidebar (272px) on lg+ (the
          sidebar is out of flow). overscroll-contain hands the top overscroll
          to pull-to-refresh instead of the browser's native gesture. */}
      <main ref={mainRef} className="flex min-w-0 flex-1 flex-col overflow-y-auto overscroll-y-contain lg:pl-[272px]">
        <DashTopbar
          user={user}
          plan={plan}
          planStyle={planStyle}
          initial={initial}
          logout={logout}
        />
        {/* pb clears the fixed mobile tab bar (+ safe area); desktop keeps py-6. */}
        <PullToRefresh scrollerRef={mainRef}>
          <div className="px-4 py-6 pb-[calc(68px+env(safe-area-inset-bottom))] sm:px-6 md:px-8 lg:pb-6">
            <div className="mx-auto w-full max-w-6xl">
              {/* KYC nudge on every host page (home renders its own inline). */}
              <KycNudgeStrip />
              <PageTransition>{children}</PageTransition>
            </div>
          </div>
        </PullToRefresh>
      </main>

      {/* Native-app bottom tab bar — mobile only (< lg). Its "More" button is the
          mobile nav opener (the topbar hamburger moved here). */}
      <MobileTabBar onOpenMore={() => setNavOpen(true)} moreTriggerRef={navTriggerRef} />
    </div>
    </RefreshProvider>
  );
};

export default DashboardLayout;

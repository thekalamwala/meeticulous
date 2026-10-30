import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation } from 'react-router-dom';
import {
  Menu, X, ExternalLink, LogOut, Headset, ChevronDown, Bell, LifeBuoy,
  User, CreditCard, ShieldCheck, Check, Copy, BadgeCheck,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import useIsMobile from '../../hooks/useIsMobile';
import useLiveNotifications from '../../hooks/useLiveNotifications';
import { getNotifications, markAllNotificationsRead, markNotificationRead, markLinkShared } from '../../services/api';
import { normalizePlan } from '../../utils/themeUtils';
import { cn } from '../dashboard/ui/cn';
import { PageTransition } from '../dashboard/ui/PageTransition';
import ConsoleSidebar from './ConsoleSidebar';
import '../dashboard/ui/tokens.css';

// Keyed by canonical plan slug (see normalizePlan) — legacy aliases like
// `explorer`/`free`/`pro` are collapsed before lookup.
const PLAN_STYLES = {
  free: { label: 'Sloth', bg: 'bg-gray-100', text: 'text-gray-600' },
  premium: { label: 'Sloth Active', bg: 'bg-amber-100', text: 'text-amber-700' },
  // Archived rows: hidden from the catalogue, but their existing subscribers
  // still see a badge and carry Sloth Active entitlements at the old price.
  creator: { label: 'Sloth Active', bg: 'bg-amber-100', text: 'text-amber-700' },
  professional: { label: 'Sloth Active', bg: 'bg-amber-100', text: 'text-amber-700' },
  supreme: { label: 'Supreme', bg: 'bg-violet-100', text: 'text-violet-700' },
};

// Humanize a category slug ("career-coaching" -> "Career Coaching"). Falls back
// to a plain role label so the profile block always has a subtitle.
const humanizeCategory = (raw) => {
  const v = (raw || '').toString().trim();
  if (!v) return 'Host';
  return v.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
};

// Shared row style for the profile-menu links.
const MENU_ROW =
  'flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-gray-700 transition-colors hover:bg-gray-50';

// Lock body scroll while a mobile sheet / drawer is open (no-op when inactive).
const useBodyScrollLock = (active) => {
  useEffect(() => {
    if (!active) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [active]);
};

// One popup surface, two shapes: an anchored dropdown on desktop, an app-style
// bottom sheet on mobile (portaled to body so the topbar's backdrop-blur — which
// would otherwise become the containing block for `fixed` — can't trap it).
const MenuSurface = ({ open, onClose, isMobile, title, align = 'right', width = 'w-72', role = 'menu', children }) => {
  if (!open) return null;
  if (isMobile) {
    return createPortal(
      <div className="lg:hidden">
        <div className="fixed inset-0 z-[60] bg-black/40" onClick={onClose} aria-hidden="true" />
        <div
          className="fixed inset-x-0 bottom-0 z-[60] max-h-[85vh] overflow-y-auto rounded-t-2xl border-t border-gray-100 bg-white pb-[max(1rem,env(safe-area-inset-bottom))] dash-elev-3"
          role={role}
          aria-label={title}
        >
          <div className="mx-auto mt-2 h-1 w-9 rounded-full bg-gray-200" aria-hidden="true" />
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
            <span className="text-base font-semibold text-gray-900">{title}</span>
            <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
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
        'absolute top-full z-50 mt-2 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-[0_8px_32px_rgba(0,0,0,0.12)]',
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

/** Sloth Support — leftmost topbar action. Routes to the Help centre. */
const SupportButton = () => (
  <Link
    to="/help"
    title="Sloth Support"
    aria-label="Sloth Support"
    className="grid h-9 w-9 place-items-center rounded-full text-gray-500 transition-colors hover:bg-primary/5 hover:text-primary"
  >
    <LifeBuoy className="h-[19px] w-[19px]" strokeWidth={1.7} />
  </Link>
);

/** Notification bell. Anchored panel on desktop, bottom sheet on mobile. */
const NotifBell = () => {
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

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative grid h-9 w-9 place-items-center rounded-full text-gray-500 transition-colors hover:bg-primary/5 hover:text-primary"
        aria-label={`Notifications${unread > 0 ? `, ${unread} unread` : ''}`}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <Bell className="h-[19px] w-[19px]" strokeWidth={1.7} />
        {unread > 0 && (
          <span className="absolute right-1 top-1 grid min-h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[9px] font-bold leading-none text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      <MenuSurface open={open} onClose={() => setOpen(false)} isMobile={isMobile} title="Notifications" width="w-80" role="dialog">
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 md:py-3">
          {!isMobile && <span className="text-sm font-semibold text-gray-900">Notifications</span>}
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
              <li key={i} className="flex flex-col gap-2 border-b border-gray-50 px-4 py-3.5">
                <span className="h-3 w-2/5 animate-pulse rounded bg-gray-100" />
                <span className="h-2.5 w-3/4 animate-pulse rounded bg-gray-100" />
              </li>
            ))}
          </ul>
        ) : status === 'error' && notifs.length === 0 ? (
          <div className="py-10 text-center">
            <Bell className="mx-auto mb-2 h-7 w-7 text-gray-200" />
            <p className="text-sm text-gray-400">Couldn't load notifications</p>
            <button type="button" onClick={load} className="mt-2 text-xs font-medium text-primary hover:underline">
              Try again
            </button>
          </div>
        ) : notifs.length === 0 ? (
          <div className="py-10 text-center">
            <Bell className="mx-auto mb-2 h-7 w-7 text-gray-200" />
            <p className="text-sm text-gray-400">No new notifications</p>
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
                    'flex w-full flex-col items-start gap-0.5 border-b border-gray-50 px-4 py-3 text-left transition-colors hover:bg-gray-50 hover:no-underline',
                    !n.read_at && 'bg-primary/5',
                  )}
                >
                  <span className="text-sm font-medium text-gray-800">{n.title}</span>
                  {n.body && <span className="text-xs text-gray-500">{n.body}</span>}
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
const ProfileMenu = ({ user, plan, planStyle, initial, logout }) => {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef(null);
  const isMobile = useIsMobile();
  const category = humanizeCategory(user?.category || user?.primary_category);
  const close = () => setOpen(false);

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
      <div className={cn('grid shrink-0 place-items-center rounded-full bg-primary/10 font-bold text-primary', size)}>
        {initial}
      </div>
    );

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-full p-0.5 transition-colors hover:bg-gray-100"
        aria-label="Profile menu"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <Avatar size="h-9 w-9 text-sm" />
        <ChevronDown className={cn('h-4 w-4 text-gray-400 transition-transform', open && 'rotate-180')} />
      </button>

      <MenuSurface open={open} onClose={close} isMobile={isMobile} title="Account" width="w-72">
        {/* Identity: photo + name + @username + plan chip (+ verify pill) */}
        <div className="flex items-center gap-3 border-b border-gray-100 px-4 py-4">
          <Avatar size="h-12 w-12 text-base" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="truncate text-sm font-bold text-gray-900">{user?.name || 'Host'}</p>
              <Link
                to="/dashboard/kyc"
                onClick={close}
                title={kycTitle}
                aria-label={kycVerified ? 'Verified host' : 'Not verified — complete verification'}
                className="shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <BadgeCheck
                  className="h-4 w-4"
                  strokeWidth={2.2}
                  style={{ color: kycVerified ? '#960D32' : '#9ca3af' }}
                />
              </Link>
            </div>
            <p className="truncate text-xs text-gray-500">{user?.username ? `@${user.username}` : category}</p>
            <div className="mt-1.5">
              <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold', planStyle.bg, planStyle.text)}>
                {planStyle.label}
              </span>
            </div>
          </div>
        </div>

        {/* Account */}
        <div className="border-t border-gray-100 py-1.5">
          <Link to="/dashboard/profile" onClick={close} className={MENU_ROW}>
            <User className="h-4 w-4 shrink-0" strokeWidth={1.7} />
            <span className="flex-1">Account information</span>
          </Link>
          <Link to="/dashboard/upgrade" onClick={close} className={MENU_ROW}>
            <CreditCard className="h-4 w-4 shrink-0" strokeWidth={1.7} />
            <span className="flex-1">Plan &amp; billing</span>
          </Link>
          <Link to="/dashboard/kyc" onClick={close} className={MENU_ROW}>
            <ShieldCheck className="h-4 w-4 shrink-0" strokeWidth={1.7} />
            <span className="flex-1">Verification</span>
          </Link>
        </div>

        {/* Your page */}
        <div className="border-t border-gray-100 py-1.5">
          {user?.username && (
            <a href={`/${user.username}`} target="_blank" rel="noreferrer" onClick={close} className={MENU_ROW}>
              <ExternalLink className="h-4 w-4 shrink-0" strokeWidth={1.7} />
              <span className="flex-1">View public profile</span>
            </a>
          )}
          {publicUrl && (
            <button type="button" onClick={copyLink} className={MENU_ROW}>
              {copied
                ? <Check className="h-4 w-4 shrink-0 text-emerald-600" strokeWidth={2.4} />
                : <Copy className="h-4 w-4 shrink-0" strokeWidth={1.7} />}
              <span className="flex-1">{copied ? 'Copied' : 'Copy link'}</span>
            </button>
          )}
        </div>

        {/* Support — Help lives in the topbar; this is the human line. */}
        <div className="border-t border-gray-100 py-1.5">
          <a href="/bolt958" target="_blank" rel="noreferrer" onClick={close} className={MENU_ROW}>
            <Headset className="h-4 w-4 shrink-0" strokeWidth={1.7} />
            <span className="flex-1">Account manager</span>
            <ExternalLink className="h-3.5 w-3.5 shrink-0 text-gray-300" strokeWidth={1.8} />
          </a>
        </div>

        {/* Logout */}
        <div className="border-t border-gray-100 py-1.5">
          <button
            type="button"
            onClick={() => { close(); logout?.(); }}
            className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-red-500 transition-colors hover:bg-red-50"
          >
            <LogOut className="h-4 w-4 shrink-0" strokeWidth={1.7} />
            <span className="flex-1">Log out</span>
          </button>
        </div>
      </MenuSurface>
    </div>
  );
};

/** Sticky dashboard topbar. Left: mobile nav hamburger. Right: Profile, Notifs, Support. */
const DashTopbar = ({ user, plan, planStyle, initial, logout, onOpenNav, navTriggerRef }) => (
  <header className="sticky top-0 z-30 flex min-h-14 shrink-0 items-center border-b border-gray-200/80 bg-white/95 px-4 pt-[env(safe-area-inset-top)] backdrop-blur sm:px-6 md:px-8">
    <button
      ref={navTriggerRef}
      type="button"
      onClick={onOpenNav}
      aria-label="Open navigation"
      aria-haspopup="dialog"
      className="mr-1 grid h-9 w-9 place-items-center rounded-full text-gray-500 transition-colors hover:bg-primary/5 hover:text-primary lg:hidden"
    >
      <Menu className="h-[19px] w-[19px]" strokeWidth={1.8} />
    </button>
    <div className="ml-auto flex items-center gap-1">
      <SupportButton />
      <NotifBell />
      <ProfileMenu user={user} plan={plan} planStyle={planStyle} initial={initial} logout={logout} />
    </div>
  </header>
);

const DashboardLayout = ({ children }) => {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();

  const [navOpen, setNavOpen] = useState(false);
  const navTriggerRef = useRef(null);
  // Route change closes the mobile drawer.
  useEffect(() => { setNavOpen(false); }, [pathname]);
  useBodyScrollLock(navOpen);

  const plan = normalizePlan(user?.plan);
  const planStyle = PLAN_STYLES[plan] || PLAN_STYLES.starter;
  const initial = (user?.name || user?.email || 'U').trim().charAt(0).toUpperCase();

  return (
    <div className="dash flex min-h-screen overflow-x-hidden bg-canvas">
      <ConsoleSidebar open={navOpen} onClose={() => setNavOpen(false)} triggerRef={navTriggerRef} />

      {/* Main — offset by the fixed rail (56) + panel (220) = 276px on lg+
          (the sidebar is out of flow). */}
      <main className="flex min-w-0 flex-1 flex-col overflow-y-auto lg:pl-[276px]">
        <DashTopbar
          user={user}
          plan={plan}
          planStyle={planStyle}
          initial={initial}
          logout={logout}
          onOpenNav={() => setNavOpen(true)}
          navTriggerRef={navTriggerRef}
        />
        <div className="px-4 py-6 sm:px-6 md:px-8">
          <div className="mx-auto w-full max-w-6xl">
            <PageTransition>{children}</PageTransition>
          </div>
        </div>
      </main>
    </div>
  );
};

export default DashboardLayout;

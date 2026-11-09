import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { Menu, X, CalendarPlus, Rocket, ArrowRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getMyServices } from '../../services/api';
import { normalizePlan } from '../../utils/themeUtils';
import { cn } from '../dashboard/ui/cn';
import { PageTransition } from '../dashboard/ui/PageTransition';
import ProfileCompletionPanel from '../dashboard/ProfileCompletionPanel';
import { NotifBell, ProfileMenu } from './DashboardLayout';
import ConsoleSidebar from './ConsoleSidebar';
import { OverviewChromeContext } from './overviewChrome';

/* --------------------------------------------------------------------------
 * Overview chrome (the /dashboard overview page only).
 *
 * Sidebar: the ORIGINAL two-level ConsoleSidebar (56px icon rail + 220px panel)
 * — reused verbatim, never the flat pink reference sidebar. Only the top toolbar
 * (search + "Add a New Meeting" + profile-completion + notifications + avatar)
 * and the pink page surface are specific to the overview; everything else is the
 * existing host console. Scoped so nothing here leaks to other host pages.
 * ------------------------------------------------------------------------ */

const useBodyScrollLock = (active) => {
  useEffect(() => {
    if (!active) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [active]);
};

/* ------------------------------------------------------------------ */
/* New-meeting modal — reuses the real public booking flow             */
/* ------------------------------------------------------------------ */

const NewMeetingModal = ({ open, onClose, user }) => {
  const [services, setServices] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(false);
    setServices(null);
    getMyServices()
      .then(({ data }) => setServices(data || []))
      .catch(() => { setError(true); setServices([]); });
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useBodyScrollLock(open);
  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center p-0 sm:items-center sm:p-6">
      <div className="absolute inset-0 bg-[#17164A]/35 backdrop-blur-[2px]" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Start a new meeting"
        className="relative z-10 w-full max-w-md rounded-t-3xl border border-[#FFD8ED] bg-white p-5 shadow-[0_24px_60px_-20px_rgba(23,22,74,0.45)] sm:rounded-3xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-heading text-lg font-bold text-[#17164A]">Start a new meeting</h2>
            <p className="mt-0.5 text-xs text-[#71639E]">Pick a service — it opens your live booking page.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1.5 text-[#71639E] transition hover:bg-[#FFF0F8] hover:text-[#F50069]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 max-h-72 space-y-2 overflow-y-auto">
          {services === null && (
            <div className="space-y-2" aria-busy="true">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-12 animate-pulse rounded-xl bg-[#FFF0F8]" />
              ))}
            </div>
          )}

          {services !== null && services.length === 0 && (
            <div className="rounded-xl border border-[#FFE1F1] bg-[#FFF7FB] p-4 text-center">
              <p className="text-sm font-semibold text-[#17164A]">
                {error ? "Couldn't load your services." : 'No services yet.'}
              </p>
              <a
                href="/dashboard/services"
                onClick={onClose}
                className="mt-3 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-[#F50069] to-[#D90059] px-4 py-2 text-xs font-semibold text-white"
              >
                Add a service <ArrowRight className="h-3.5 w-3.5" />
              </a>
            </div>
          )}

          {services !== null && services.map((s) => {
            const href = user?.username
              ? `/${user.username}/booking/${s.slug}`
              : '/dashboard/profile';
            const disabled = !user?.username || !s.slug || s.is_active === false;
            return (
              <a
                key={s.id || s.slug || s.title}
                href={disabled ? undefined : href}
                target={disabled ? undefined : '_blank'}
                rel="noreferrer"
                onClick={(e) => { if (disabled) { e.preventDefault(); return; } onClose(); }}
                className={cn(
                  'flex items-center justify-between gap-3 rounded-xl border border-[#FFE1F1] px-3.5 py-3 transition',
                  disabled ? 'cursor-not-allowed opacity-50' : 'hover:border-[#F50069]/40 hover:bg-[#FFF7FB]',
                )}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-[#17164A]">{s.title || 'Service'}</span>
                  <span className="block text-[11px] text-[#71639E]">{s.duration || 30} min</span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-[#F50069]" />
              </a>
            );
          })}
        </div>

        {!user?.username && (
          <p className="mt-3 rounded-lg bg-[#FFF0F8] px-3 py-2 text-[11px] text-[#71639E]">
            Set your username first — it's the address guests book from.
          </p>
        )}
      </div>
    </div>,
    document.body,
  );
};

/* ------------------------------------------------------------------ */
/* Top toolbar                                                         */
/* ------------------------------------------------------------------ */

/* Profile-completion popover: the rocket trigger + the floating panel. Opens on
 * hover / keyboard focus on pointer-capable devices, and on click/tap on
 * touch devices. A short close delay + a shared hover region (trigger AND panel
 * in one group) let the pointer travel into the panel without it closing. The
 * panel is absolutely positioned (z-[70]) so it never affects dashboard layout. */
const ProfileCompletionRocket = ({ user }) => {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const closeTimer = useRef(null);
  // Hover-capable (mouse) vs touch — decides hover-open vs tap-toggle.
  const canHover = useRef(
    typeof window !== 'undefined' && !!window.matchMedia?.('(hover: hover)')?.matches,
  );

  const clearClose = () => { if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; } };
  const openNow = () => { clearClose(); setOpen(true); };
  const closeSoon = () => { clearClose(); closeTimer.current = setTimeout(() => setOpen(false), 160); };

  useEffect(() => () => clearClose(), []);

  // Esc closes; on touch, an outside tap closes.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    let onDown;
    if (!canHover.current) {
      onDown = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
      document.addEventListener('pointerdown', onDown);
    }
    return () => {
      document.removeEventListener('keydown', onKey);
      if (onDown) document.removeEventListener('pointerdown', onDown);
    };
  }, [open]);

  const hoverProps = canHover.current
    ? { onMouseEnter: openNow, onMouseLeave: closeSoon }
    : {};
  const focusProps = canHover.current
    ? {
        onFocus: openNow,
        onBlur: (e) => { if (!e.currentTarget.contains(e.relatedTarget)) closeSoon(); },
      }
    : {};

  return (
    <div ref={wrapRef} className="relative" {...hoverProps} {...focusProps}>
      <button
        type="button"
        onClick={() => { if (!canHover.current) setOpen((o) => !o); }}
        aria-label="Profile completion"
        aria-expanded={open}
        aria-haspopup="dialog"
        className="relative grid h-10 w-10 place-items-center rounded-full border border-[#FFD8ED] bg-[#FFE1F1] text-[#F50069] transition hover:brightness-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F50069]/35"
      >
        <span aria-hidden="true" className="absolute -top-0.5 left-1.5 h-1 w-1 rounded-full bg-[#F50069]" />
        <span aria-hidden="true" className="absolute -top-1 left-2.5 h-1.5 w-[2px] rotate-45 rounded-full bg-[#FF9FB0]" />
        <Rocket className="h-[18px] w-[18px]" strokeWidth={1.9} />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Profile completion"
          /* Mobile: a viewport-anchored sheet just under the toolbar (the rocket
             sits mid-cluster, so a right-anchored panel would clip off-screen).
             Desktop (lg+): an absolute popover anchored to the rocket. */
          className="fixed inset-x-3 top-[66px] z-[70] w-auto lg:absolute lg:inset-x-auto lg:right-0 lg:top-full lg:mt-2 lg:w-[330px]"
        >
          <ProfileCompletionPanel user={user} onNavigate={() => setOpen(false)} />
        </div>
      )}
    </div>
  );
};

const OverviewTopbar = ({
  user, initial, planStyle, logout, onOpenNav, navTriggerRef, onNewMeeting,
}) => (
    <header className="sticky top-0 z-30 flex min-h-[64px] items-center gap-2.5 border-b border-[#FFD8ED] bg-[#FFF7FB]/85 px-4 py-2 backdrop-blur sm:gap-3 sm:px-6">
      <button
        ref={navTriggerRef}
        type="button"
        onClick={onOpenNav}
        aria-label="Open navigation"
        aria-haspopup="dialog"
        className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-[#71639E] transition hover:bg-[#FFE1F1] hover:text-[#F50069] lg:hidden"
      >
        <Menu className="h-5 w-5" strokeWidth={1.8} />
      </button>

      {/* Toolbar actions, right-aligned (the search bar was removed). Add a New
          Meeting sits immediately before the rocket; notification + profile
          follow, with a consistent gap. */}
      <div className="ml-auto flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={onNewMeeting}
          className="inline-flex h-[42px] shrink-0 items-center gap-2 rounded-full bg-maroon px-3.5 text-sm font-semibold text-white shadow-[0_8px_20px_-10px_rgba(150,13,50,0.5)] transition hover:bg-maroon-dark focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose sm:px-5"
        >
          <CalendarPlus className="h-[17px] w-[17px]" strokeWidth={2} />
          <span className="hidden whitespace-nowrap sm:inline">Add a New Booking</span>
          <span className="sm:hidden">New</span>
        </button>

        <ProfileCompletionRocket user={user} />

        <NotifBell
          triggerClassName="relative grid h-10 w-10 place-items-center rounded-full border border-[#FFD8ED] bg-white text-[#71639E] transition hover:bg-[#FFF0F8] hover:text-[#F50069] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F50069]/30"
          badgeClassName="absolute right-1 top-1 grid min-h-4 min-w-4 place-items-center rounded-full bg-[#F50069] px-1 text-[9px] font-bold leading-none text-white"
          iconClassName="h-[18px] w-[18px]"
          minBadge={1}
        />

        <ProfileMenu
          user={user}
          plan={planStyle.label}
          planStyle={planStyle}
          initial={initial}
          logout={logout}
          triggerClassName="flex items-center gap-1 rounded-full p-0.5 transition hover:bg-[#FFE1F1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F50069]/30"
          avatarClassName="bg-gradient-to-br from-[#F50069] to-[#D90059] text-white"
          chevronClassName="h-3.5 w-3.5 text-[#71639E]"
        />
      </div>
    </header>
  );

/* ------------------------------------------------------------------ */
/* Layout                                                              */
/* ------------------------------------------------------------------ */

const OverviewLayout = ({ children }) => {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();

  const [newMeetingOpen, setNewMeetingOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const navTriggerRef = useRef(null);

  const plan = normalizePlan(user?.plan);
  const planStyle = plan === 'free'
    ? { label: 'Starter', bg: 'bg-[#FFE1F1]', text: 'text-[#D90059]' }
    : { label: 'Pro', bg: 'bg-[#FFE1F1]', text: 'text-[#D90059]' };
  const initial = (user?.name || user?.email || 'M').trim().charAt(0).toUpperCase();

  useEffect(() => { setNavOpen(false); }, [pathname]);
  useBodyScrollLock(navOpen);

  const openNewMeeting = useCallback(() => setNewMeetingOpen(true), []);

  return (
    <OverviewChromeContext.Provider value={{ openNewMeeting }}>
      <div
        className="ov-shell min-h-screen bg-[#FFF0F8] text-[#17164A]"
        style={{
          backgroundImage:
            'radial-gradient(1100px 520px at 78% -8%, rgba(245,0,105,0.10), transparent 62%), radial-gradient(760px 420px at 8% 12%, rgba(255,225,241,0.85), transparent 70%), linear-gradient(180deg, #FFF0F8 0%, #FFF7FB 48%, #FBECF5 100%)',
        }}
      >
        {/* Original two-level host sidebar (icon rail + panel), reused verbatim.
            It owns its own desktop-fixed shell AND mobile drawer, driven here by
            navOpen / the toolbar hamburger. */}
        <ConsoleSidebar open={navOpen} onClose={() => setNavOpen(false)} triggerRef={navTriggerRef} />

        {/* Main column — offset by the fixed rail (56) + panel (220) = 276px. */}
        <div className="lg:pl-[276px]">
          <OverviewTopbar
            user={user}
            initial={initial}
            planStyle={planStyle}
            logout={logout}
            onOpenNav={() => setNavOpen(true)}
            navTriggerRef={navTriggerRef}
            onNewMeeting={openNewMeeting}
          />

          <main className="px-4 py-4 sm:px-6">
            <PageTransition>{children}</PageTransition>
          </main>
        </div>

        <NewMeetingModal open={newMeetingOpen} onClose={() => setNewMeetingOpen(false)} user={user} />
      </div>
    </OverviewChromeContext.Provider>
  );
};

export default OverviewLayout;

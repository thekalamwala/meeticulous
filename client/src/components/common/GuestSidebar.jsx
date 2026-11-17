import { useEffect, useRef } from 'react';
import { NavLink } from 'react-router-dom';
import { Home, CalendarDays, FileText, Star, Gift, MessageCircle, User, Video, Crown, X } from 'lucide-react';
import useSupportUnread from '../../hooks/useSupportUnread';

// Guest console — a single-level nav rail for the logged-in customer space
// (/user/*). Deliberately flat (no rail+panel two-level like the host
// ConsoleSidebar): a guest has only a handful of destinations, so one labelled
// column reads cleaner than an empty second panel. No mode switch, no
// "become a host" door — this is guest-only chrome by design.
//
// Layout: a fixed left column on lg+, a slide-in drawer on mobile (opened by the
// topbar hamburger). Adding a page = one entry in NAV.

// Path suffixes off the console base. The real console is based at /user; the
// restyle prototype reuses this exact rail at /preview/guest by passing `base`.
const NAV = [
  { path: '', label: 'Home', icon: Home, end: true },
  { path: 'my-bookings', label: 'Bookings', icon: CalendarDays },
  { path: 'courses', label: 'My Courses', icon: Video },
  { path: 'memberships', label: 'Memberships', icon: Crown },
  { path: 'invoices', label: 'Invoices', icon: FileText },
  { path: 'reviews', label: 'Reviews', icon: Star },
  { path: 'loyalty', label: 'Rewards', icon: Gift },
  { path: 'chat', label: 'Chat', icon: MessageCircle, badge: 'chat' },
  { path: 'profile', label: 'Profile', icon: User },
];
const hrefFor = (base, path) => (path ? `${base}/${path}` : base);

// STYLING (explore/console-restyle): Loop & Slot rail — solid maroon active row
// (like the Host Lab rail), blush hover, rose unread badge.
const rowClass = ({ isActive }) =>
  `flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose ${
    isActive
      ? 'bg-maroon text-white'
      : 'text-ink/60 hover:bg-blush hover:text-ink'
  }`;

// Shared nav list — rendered in both the desktop column and the mobile drawer.
const NavList = ({ chatUnread, onNavigate, base }) => (
  <nav className="flex flex-col gap-1" aria-label="Your account">
    {NAV.map(({ path, label, icon: Icon, end, badge }) => (
      <NavLink key={path} to={hrefFor(base, path)} end={end} onClick={onNavigate} className={rowClass}>
        {({ isActive }) => (
          <>
            <Icon size={17} strokeWidth={2} className="shrink-0" />
            <span className="flex-1">{label}</span>
            {badge === 'chat' && chatUnread > 0 && (
              <span className={`grid min-w-[18px] place-items-center rounded-full px-1 text-[10px] font-bold leading-[18px] ${isActive ? 'bg-white text-maroon' : 'bg-rose text-white'}`}>
                {chatUnread > 9 ? '9+' : chatUnread}
              </span>
            )}
          </>
        )}
      </NavLink>
    ))}
  </nav>
);

const GuestSidebar = ({ open, onClose, triggerRef, base = '/user' }) => {
  const chatUnread = useSupportUnread();
  const drawerRef = useRef(null);

  // Mobile drawer: ESC closes, and focus moves into the drawer on open / back to
  // the trigger on close — same a11y contract the host sidebar honors.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    drawerRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      triggerRef?.current?.focus?.();
    };
  }, [open, onClose, triggerRef]);

  return (
    <>
      {/* Desktop: fixed left column (out of flow — main offsets by its width). */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-56 flex-col border-r-2 border-neutral-200 bg-cream lg:flex">
        <div className="flex h-14 items-center px-5">
          <span className="font-display text-[18px] font-extrabold tracking-[-0.03em] text-maroon">Meeticulous</span>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-2">
          <NavList chatUnread={chatUnread} base={base} />
        </div>
      </aside>

      {/* Mobile: slide-in drawer + backdrop. */}
      {open && (
        <div className="lg:hidden">
          <div
            className="fixed inset-0 z-40 bg-black/40"
            onClick={onClose}
            aria-hidden="true"
          />
          <aside
            ref={drawerRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            className="fixed inset-y-0 left-0 z-50 flex w-64 max-w-[80%] flex-col bg-cream shadow-xl focus:outline-none"
          >
            <div className="flex h-14 items-center justify-between px-5">
              <span className="font-display text-[18px] font-extrabold tracking-[-0.03em] text-maroon">Meeticulous</span>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close navigation"
                className="grid h-9 w-9 place-items-center rounded-full text-ink/50 hover:bg-blush hover:text-maroon"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-2">
              <NavList chatUnread={chatUnread} onNavigate={onClose} base={base} />
            </div>
          </aside>
        </div>
      )}
    </>
  );
};

export default GuestSidebar;

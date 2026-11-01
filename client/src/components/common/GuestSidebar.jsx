import { useEffect, useRef } from 'react';
import { NavLink } from 'react-router-dom';
import { Home, CalendarDays, FileText, Star, Gift, MessageCircle, User, X } from 'lucide-react';
import useSupportUnread from '../../hooks/useSupportUnread';

// Guest console — a single-level nav rail for the logged-in customer space
// (/user/*). Deliberately flat (no rail+panel two-level like the host
// ConsoleSidebar): a guest has only a handful of destinations, so one labelled
// column reads cleaner than an empty second panel. No mode switch, no
// "become a host" door — this is guest-only chrome by design.
//
// Layout: a fixed left column on lg+, a slide-in drawer on mobile (opened by the
// topbar hamburger). Adding a page = one entry in NAV.

const NAV = [
  { to: '/user', label: 'Home', icon: Home, end: true },
  { to: '/user/my-bookings', label: 'Bookings', icon: CalendarDays },
  { to: '/user/invoices', label: 'Invoices', icon: FileText },
  { to: '/user/reviews', label: 'Reviews', icon: Star },
  { to: '/user/loyalty', label: 'Rewards', icon: Gift },
  { to: '/user/chat', label: 'Chat', icon: MessageCircle, badge: 'chat' },
  { to: '/user/profile', label: 'Profile', icon: User },
];

const rowClass = ({ isActive }) =>
  `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
    isActive
      ? 'bg-primary/10 text-primary'
      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
  }`;

// Shared nav list — rendered in both the desktop column and the mobile drawer.
const NavList = ({ chatUnread, onNavigate }) => (
  <nav className="flex flex-col gap-1" aria-label="Your account">
    {NAV.map(({ to, label, icon: Icon, end, badge }) => (
      <NavLink key={to} to={to} end={end} onClick={onNavigate} className={rowClass}>
        <Icon size={18} strokeWidth={1.8} className="shrink-0" />
        <span className="flex-1">{label}</span>
        {badge === 'chat' && chatUnread > 0 && (
          <span className="grid min-w-[18px] place-items-center rounded-full bg-primary px-1 text-[10px] font-bold leading-[18px] text-white">
            {chatUnread > 9 ? '9+' : chatUnread}
          </span>
        )}
      </NavLink>
    ))}
  </nav>
);

const GuestSidebar = ({ open, onClose, triggerRef }) => {
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
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-56 flex-col border-r border-gray-200 bg-white lg:flex">
        <div className="flex h-14 items-center px-5">
          <span className="text-lg font-bold text-gray-900">
            Mee<span className="text-primary">ticulous</span>
          </span>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-2">
          <NavList chatUnread={chatUnread} />
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
            className="fixed inset-y-0 left-0 z-50 flex w-64 max-w-[80%] flex-col bg-white shadow-xl focus:outline-none"
          >
            <div className="flex h-14 items-center justify-between px-5">
              <span className="text-lg font-bold text-gray-900">
                Mee<span className="text-primary">ticulous</span>
              </span>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close navigation"
                className="grid h-9 w-9 place-items-center rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-800"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-2">
              <NavList chatUnread={chatUnread} onNavigate={onClose} />
            </div>
          </aside>
        </div>
      )}
    </>
  );
};

export default GuestSidebar;

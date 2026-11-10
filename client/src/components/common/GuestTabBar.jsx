import { useLocation, useNavigate } from 'react-router-dom';
import { Home, MessageCircle, CalendarDays, FileText, Menu } from 'lucide-react';
import useSupportUnread from '../../hooks/useSupportUnread';
import { cn } from '../dashboard/ui/cn';

/* Native-app bottom tab bar for the guest space (/user) on mobile (< lg). Mirrors
 * the host MobileTabBar: four destinations with Bookings raised dead-centre
 * (what a guest checks most), plus a right-hand "More" burger that opens the full
 * nav drawer (Reviews, Rewards, Profile, …). Hidden on desktop (lg:hidden). */

const MAROON = '#960D32';

// Slots left -> right: [LEFT…] [CENTER raised] [RIGHT…] [More].
const LEFT = [
  { to: '/user', label: 'Home', icon: Home, end: true },
  { to: '/user/chat', label: 'Chat', icon: MessageCircle, badge: 'chat' },
];
const CENTER = { to: '/user/my-bookings', label: 'Bookings' };
const RIGHT = [
  { to: '/user/invoices', label: 'Invoices', icon: FileText },
];

const isActive = (pathname, { to, end }) => (end ? pathname === to : pathname === to || pathname.startsWith(`${to}/`));

const AttentionDot = () => (
  <span aria-hidden="true" className="absolute -right-1 -top-0.5 h-2 w-2 rounded-full bg-rose ring-2 ring-white" />
);

const Tab = ({ item, active, badgeCount, onClick }) => {
  const Icon = item.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      aria-label={item.label}
      className={cn(
        'relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary',
        active ? 'text-maroon' : 'text-neutral-500 active:bg-neutral-100',
      )}
    >
      {active && <span aria-hidden="true" className="absolute inset-x-[22%] top-0 h-[3px] rounded-full bg-maroon" />}
      <span className="relative">
        <Icon className="h-[22px] w-[22px]" strokeWidth={active ? 2.2 : 1.8} />
        {badgeCount > 0 && <AttentionDot />}
      </span>
      <span className="max-w-full truncate text-[10px] font-semibold leading-none">{item.label}</span>
    </button>
  );
};

const GuestTabBar = ({ onOpenMore, moreTriggerRef }) => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const chatUnread = useSupportUnread();

  const centerActive = isActive(pathname, CENTER);

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 flex items-stretch border-t border-neutral-200/80 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      {LEFT.map((item) => (
        <Tab
          key={item.to}
          item={item}
          active={isActive(pathname, item)}
          badgeCount={item.badge === 'chat' ? chatUnread : 0}
          onClick={() => navigate(item.to)}
        />
      ))}

      {/* Centre — Bookings, raised + emphasised (most-visited). */}
      <button
        type="button"
        onClick={() => navigate(CENTER.to)}
        aria-current={centerActive ? 'page' : undefined}
        aria-label={CENTER.label}
        className="group flex min-w-0 flex-1 flex-col items-center justify-end gap-1 py-1.5 focus-visible:outline-none"
      >
        <span
          className={cn(
            '-mt-8 grid h-14 w-14 place-items-center rounded-full text-white shadow-[0_8px_18px_-6px_rgba(150,13,50,0.55)] ring-4 ring-white transition-transform group-active:scale-95',
            centerActive ? 'bg-maroon' : 'bg-maroon/90',
          )}
        >
          <CalendarDays className="h-7 w-7" strokeWidth={2} />
        </span>
        <span className={cn('text-[10px] font-semibold leading-none', centerActive ? 'text-maroon' : 'text-neutral-500')} style={centerActive ? { color: MAROON } : undefined}>
          {CENTER.label}
        </span>
      </button>

      {RIGHT.map((item) => (
        <Tab key={item.to} item={item} active={isActive(pathname, item)} badgeCount={0} onClick={() => navigate(item.to)} />
      ))}

      {/* More — opens the full nav drawer (Reviews, Rewards, Profile, …). */}
      <button
        ref={moreTriggerRef}
        type="button"
        onClick={onOpenMore}
        aria-haspopup="dialog"
        aria-label="More"
        className="relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-neutral-500 transition-colors active:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
      >
        <Menu className="h-[22px] w-[22px]" strokeWidth={1.9} />
        <span className="text-[10px] font-semibold leading-none">More</span>
      </button>
    </nav>
  );
};

export default GuestTabBar;

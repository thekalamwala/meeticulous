// KeptTabBar — the host dashboard's bottom bar on phones (Kept shell only; the old
// layouts keep MobileTabBar). Founder-approved 2026-11-25:
//
//   Today · Bookings · ( Grow ) · Money · More
//
// No new grammar, just the one people already know from Instagram, GPay and iOS:
// five equal slots so the raised centre is truly centred; the active tab's icon
// turns solid maroon (no backing); one 12px label size; a rose dot
// only when something needs you. Tapping the tab you're on scrolls to the top.
// "More" rises as a bottom sheet with everything else as big tiles.
//
// Reuses the sidebar's nav model, active-route resolution and badges verbatim, so
// the bar, the sheet and the desktop rail can never disagree.
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  House, CalendarDays, TrendingUp, Wallet, LayoutGrid, Users, MessageCircle, Package,
  Clock, ChartColumn, MessagesSquare, Settings, LifeBuoy, X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import useSupportUnread from '../../hooks/useSupportUnread';
import useFeatureFlags from '../../hooks/useFeatureFlags';
import { normalizePlan } from '../../utils/themeUtils';
import { cn } from '../dashboard/ui/cn';
import { visibleSections, resolveActive, firstItemTo, computeBadges } from './ConsoleSidebar';

const ICON = {
  home: House, bookings: CalendarDays, grow: TrendingUp, money: Wallet, clients: Users,
  messages: MessageCircle, catalog: Package, schedule: Clock, intelligence: ChartColumn,
  community: MessagesSquare, settings: Settings, help: LifeBuoy,
};
// One plain line under each tile, so a host knows what's behind it before tapping.
const SUB = {
  clients: 'Who booked you', messages: 'Guest chats', catalog: 'What you sell',
  schedule: 'Your hours', intelligence: 'Your numbers', community: 'Ask and answer',
  settings: 'Account, plan', help: 'Chat with us', bookings: 'Every booking', grow: 'Get found',
};
const SHEET_ORDER = ['clients', 'messages', 'catalog', 'schedule', 'intelligence', 'community', 'settings'];
const HELP = { id: 'help', label: 'Help', to: '/dashboard/chat' };

// Solid twins of the outline icons, for the active tab (founder call, 2026-11-25):
// active = a filled glyph, no background. Drawn on lucide's 24px grid so they sit
// exactly where the outline ones do; details (door, date dots, clasp) are cut out
// with evenodd so a filled icon still reads as itself.
const solid = (paths) => function SolidIcon({ className }) {
  // Scaled 1.1x about the centre: an outline's 2px stroke reaches 2–22 on the grid,
  // a fill drawn on the path line stops at 3–21, so unscaled it read a size smaller.
  return <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}><g transform="translate(12 12) scale(1.1) translate(-12 -12)">{paths}</g></svg>;
};
const SOLID = {
  home: solid(<path d="M10.6 2.6a2 2 0 0 1 2.8 0l7 6.3A2 2 0 0 1 21 10.4V19a2 2 0 0 1-2 2h-4v-6a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v6H5a2 2 0 0 1-2-2v-8.6a2 2 0 0 1 .6-1.5z" />),
  bookings: solid(<>
    <path d="M8 2a1 1 0 0 1 1 1v1h6V3a1 1 0 1 1 2 0v1h1a3 3 0 0 1 3 3v1H3V7a3 3 0 0 1 3-3h1V3a1 1 0 0 1 1-1z" />
    <path fillRule="evenodd" d="M3 10h18v9a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3zm5 3.2a1.1 1.1 0 1 0 0 2.2 1.1 1.1 0 0 0 0-2.2zm4 0a1.1 1.1 0 1 0 0 2.2 1.1 1.1 0 0 0 0-2.2zm4 0a1.1 1.1 0 1 0 0 2.2 1.1 1.1 0 0 0 0-2.2zm-8 4a1.1 1.1 0 1 0 0 2.2 1.1 1.1 0 0 0 0-2.2zm4 0a1.1 1.1 0 1 0 0 2.2 1.1 1.1 0 0 0 0-2.2zm4 0a1.1 1.1 0 1 0 0 2.2 1.1 1.1 0 0 0 0-2.2z" />
  </>),
  money: solid(<path fillRule="evenodd" d="M5 3h12a2 2 0 0 1 2 2v2H6a1 1 0 0 0 0 2h13a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm12 13.6a1.6 1.6 0 1 0 0-3.2 1.6 1.6 0 0 0 0 3.2z" />),
  more: solid(<>
    <rect x="3" y="3" width="7.5" height="7.5" rx="2" /><rect x="13.5" y="3" width="7.5" height="7.5" rx="2" />
    <rect x="3" y="13.5" width="7.5" height="7.5" rx="2" /><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2" />
  </>),
};

const Dot = ({ className = '' }) => (
  <span aria-hidden="true" className={cn('absolute h-2.5 w-2.5 rounded-full bg-rose ring-2 ring-white', className)} />
);

// Material 3 navigation-bar proportions: 12px top and bottom, a 56×32 indicator
// around a 24px icon, a 4px gap, a 12px label on a 16px line. The 16px line box
// matters: truncate clips overflow, and a 12px box cut the bottoms off g and y.
const label12 = 'block max-w-full truncate px-1 text-[12px] leading-4';

const press = 'transition-transform duration-100 ease-out group-active:scale-[0.97] motion-reduce:transition-none motion-reduce:group-active:scale-100';

const Tab = ({ label, Icon, SolidIcon, active, dot, onClick, buttonRef, ...rest }) => (
  <button ref={buttonRef} type="button" onClick={onClick} aria-current={active ? 'page' : undefined}
    aria-label={dot ? `${label}, needs your attention` : label}
    className="group flex min-w-0 flex-col items-center justify-end gap-1 pb-3 pt-3 focus-visible:outline-none" {...rest}>
    <span className={cn('relative grid h-8 w-14 place-items-center rounded-[12px] transition-colors group-focus-visible:ring-[3px] group-focus-visible:ring-rose', press,
      active ? 'text-maroon' : 'text-muted')}>
      {active && SolidIcon ? <SolidIcon className="h-6 w-6" /> : <Icon className="h-6 w-6" strokeWidth={active ? 2.3 : 1.8} />}
      {dot && <Dot className="right-3 top-0.5" />}
    </span>
    <span className={cn(label12, active ? 'font-semibold text-maroon' : 'font-medium text-muted')}>{label}</span>
  </button>
);

// The raised centre: a maroon circle that sits above the bar, label on the same
// baseline as every other tab.
const CentreTab = ({ label, Icon, active, dot, onClick }) => (
  <button type="button" onClick={onClick} aria-current={active ? 'page' : undefined}
    aria-label={dot ? `${label}, needs your attention` : label}
    className="group flex min-w-0 flex-col items-center justify-end gap-1 pb-3 focus-visible:outline-none">
    <span className={cn('relative -mt-7 grid h-14 w-14 place-items-center rounded-full bg-maroon text-white ring-4 ring-white shadow-[var(--shadow-md)] group-focus-visible:ring-rose', press)}>
      <Icon className="h-6 w-6" strokeWidth={2.4} />
      {dot && <Dot className="right-0.5 top-0.5" />}
    </span>
    <span className={cn(label12, active ? 'font-semibold text-maroon' : 'font-medium text-muted')}>{label}</span>
  </button>
);

const MoreSheet = ({ open, onClose, items, activeId, attention, onPick }) => {
  const sheetRef = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    // Focus the sheet itself, not the first tile, so nothing looks pre-selected.
    const t = setTimeout(() => sheetRef.current?.focus(), 60);
    return () => { clearTimeout(t); document.body.style.overflow = prev; document.removeEventListener('keydown', onKey); };
  }, [open, onClose]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div key="more-backdrop" className="fixed inset-0 z-[70] bg-ink/40 lg:hidden" aria-hidden="true" onClick={onClose}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} />
          <motion.div key="more-sheet" ref={sheetRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="More"
            className="dash-v2 fixed inset-x-0 outline-none bottom-0 z-[71] rounded-t-[28px] bg-cream pb-[calc(env(safe-area-inset-bottom,0px)+16px)] pt-2 lg:hidden"
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ duration: 0.26, ease: [0.22, 0.61, 0.36, 1] }}
            drag="y" dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => { if (info.offset.y > 80 || info.velocity.y > 500) onClose(); }}>
            <div aria-hidden="true" className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-neutral-300" />
            <div className="flex items-center justify-between px-5 pb-3">
              <h2 className="mb-0 font-display text-[20px] font-bold tracking-[-0.02em] text-ink">More</h2>
              <button type="button" onClick={onClose} aria-label="Close"
                className="grid h-10 w-10 place-items-center rounded-[12px] text-muted transition hover:bg-blush hover:text-maroon focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose">
                <X className="h-5 w-5" strokeWidth={2.2} />
              </button>
            </div>
            <ul className="grid grid-cols-2 gap-2.5 px-4">
              {items.map((it) => {
                const Icon = ICON[it.id] || LayoutGrid;
                const on = activeId === it.id;
                return (
                  <li key={it.id} className="min-w-0">
                    <button type="button" onClick={() => onPick(it)}
                      aria-current={on ? 'page' : undefined}
                      aria-label={attention(it) ? `${it.label}, needs your attention` : it.label}
                      className={cn('group flex w-full min-w-0 items-center gap-3 rounded-[16px] bg-white p-3 text-left transition-colors hover:bg-pink-50 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose',
                        on && 'ring-2 ring-inset ring-maroon')}>
                      <span className={cn('relative grid h-10 w-10 shrink-0 place-items-center rounded-[12px] bg-pink-100 text-maroon', press)}>
                        <Icon className="h-5 w-5" strokeWidth={2} />
                        {attention(it) && <Dot className="-right-0.5 -top-0.5" />}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[14.5px] font-semibold text-ink">{it.label}</span>
                        {/* isNew: the badge sits on the second line so a half-width tile keeps the whole name. */}
                        <span className="flex min-w-0 items-center gap-1.5">
                          {it.isNew && <span className="shrink-0 rounded-[8px] bg-maroon px-1.5 text-[12px] font-semibold leading-[18px] text-white">New</span>}
                          <span className="truncate text-[12px] text-muted">{SUB[it.id]}</span>
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
};

export default function KeptTabBar() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { flags } = useFeatureFlags();
  const plan = normalizePlan(user?.plan);
  // Same model as the Kept rail: NAV_V2 always (see DashboardLayoutV2).
  const sections = visibleSections({ user, plan, flags: { ...flags, console_v2: true } });
  const badges = { ...computeBadges(user), chatUnread: useSupportUnread() };
  const [open, setOpen] = useState(false);
  const moreRef = useRef(null);

  useEffect(() => { setOpen(false); }, [pathname]);

  const byId = (id) => sections.find((s) => s.id === id);
  const attention = (s) => (s?.id === 'help'
    ? (badges.chatUnread || 0) > 0
    : !!s?.items?.some((i) => (i.badgeKey ? badges[i.badgeKey] || 0 : 0) > 0));
  const activeId = pathname.startsWith(HELP.to) ? 'help' : resolveActive(pathname, sections).sectionId;

  // Grow sits in the raised centre. If a host's nav has no Grow section, Bookings
  // takes the centre and Clients the second slot, so the bar never shows a gap.
  const grow = byId('grow');
  const order = grow ? ['home', 'bookings', 'grow', 'money'] : ['home', 'clients', 'bookings', 'money'];
  const centreId = grow ? 'grow' : 'bookings';
  const tabs = order.map(byId).filter(Boolean);
  const sheetItems = [
    ...SHEET_ORDER.filter((id) => !order.includes(id)).map(byId).filter(Boolean),
    ...(order.includes('bookings') ? [] : [byId('bookings')].filter(Boolean)),
    HELP,
  ];
  const moreActive = !!activeId && !order.includes(activeId);
  const moreAttention = sheetItems.some(attention);

  const goTo = (s) => {
    const to = s.to || firstItemTo(s, plan);
    if (!to) return;
    if (activeId === s.id && pathname === to) { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    navigate(to);
  };
  const onTab = (s) => {
    if (activeId === s.id) { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    goTo(s);
  };
  const close = () => { setOpen(false); moreRef.current?.focus(); };

  return (
    <>
      <nav aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 items-end border-t border-neutral-200 bg-white pb-[env(safe-area-inset-bottom,0px)] lg:hidden">
        {tabs.map((s) => {
          const props = { label: s.label, Icon: ICON[s.id] || LayoutGrid, SolidIcon: SOLID[s.id], active: activeId === s.id, dot: attention(s), onClick: () => onTab(s) };
          return s.id === centreId ? <CentreTab key={s.id} {...props} /> : <Tab key={s.id} {...props} />;
        })}
        <Tab label="More" Icon={LayoutGrid} SolidIcon={SOLID.more} active={moreActive || open} dot={moreAttention} buttonRef={moreRef}
          aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((v) => !v)} />
      </nav>
      <MoreSheet open={open} onClose={close} items={sheetItems} activeId={activeId} attention={attention}
        onPick={(it) => { setOpen(false); goTo(it); }} />
    </>
  );
}

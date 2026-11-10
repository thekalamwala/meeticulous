import { useLocation, useNavigate } from 'react-router-dom';
import { CalendarDays, Menu } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import useSupportUnread from '../../hooks/useSupportUnread';
import { normalizePlan } from '../../utils/themeUtils';
import { cn } from '../dashboard/ui/cn';
import {
  ICON_DIR, ACCENT, visibleSections, resolveActive, firstItemTo, computeBadges,
} from './ConsoleSidebar';

/* Native-app bottom tab bar for the host dashboard on mobile (< lg). Reuses the
 * sidebar's NAV model, active-route resolution and attention badges verbatim —
 * one source of truth, so the tab bar and the drawer can never disagree. Hidden
 * on desktop (lg:hidden); the desktop rail + panel is unchanged.
 *
 * Layout (founder spec): four section tabs with Bookings raised in the centre
 * (most-visited), plus a right-hand "More" burger that opens the full nav drawer
 * (Chat, Settings, Availability, Customers, …). Section tabs land their first
 * openable page (same as a rail click). */

// Slots left -> right: [LEFT] [CENTER raised] [RIGHT] [More burger].
// Bookings sits dead-centre (most-visited); Settings/Chat live under "More".
const LEFT_IDS = ['catalog', 'overview'];
const CENTER_ID = 'bookings';
const RIGHT_IDS = ['earnings'];

const AttentionDot = () => (
  <span aria-hidden="true" className="absolute -right-1 -top-0.5 h-2 w-2 rounded-full bg-rose ring-2 ring-white" />
);

const NavTab = ({ section, active, hasAttention, onClick }) => {
  const accent = ACCENT[section.id];
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      aria-label={hasAttention ? `${section.label}, has attention` : section.label}
      className={cn(
        'relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary',
        active ? '' : 'text-neutral-500 active:bg-neutral-100',
      )}
      style={active ? { color: accent } : undefined}
    >
      {active && (
        <span aria-hidden="true" className="absolute inset-x-[22%] top-0 h-[3px] rounded-full" style={{ backgroundColor: accent }} />
      )}
      <span className="relative">
        <img
          src={`${ICON_DIR}/${section.icon}-${active ? 'active' : 'inactive'}@2x.png`}
          srcSet={`${ICON_DIR}/${section.icon}-${active ? 'active' : 'inactive'}@2x.png 2x, ${ICON_DIR}/${section.icon}-${active ? 'active' : 'inactive'}@3x.png 3x`}
          width={22}
          height={22}
          alt=""
          aria-hidden="true"
          draggable={false}
          className="shrink-0 select-none"
        />
        {hasAttention && <AttentionDot />}
      </span>
      <span className="max-w-full truncate text-[10px] font-semibold leading-none">{section.label}</span>
    </button>
  );
};

const MobileTabBar = ({ onOpenMore, moreTriggerRef }) => {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const plan = normalizePlan(user?.plan);
  const sections = visibleSections({ user, plan });
  const chatUnread = useSupportUnread();
  const badges = { ...computeBadges(user), chatUnread };
  const active = resolveActive(pathname, sections);

  const byId = (id) => sections.find((s) => s.id === id);
  const sectionAttention = (s) => !!s && s.items.some((i) => (i.badgeKey ? badges[i.badgeKey] || 0 : 0) > 0);
  const go = (s) => { const to = firstItemTo(s, plan); if (to) navigate(to); };

  const center = byId(CENTER_ID);
  const centerActive = center && active.sectionId === center.id;
  // "More" collects everything not on a tab (Chat, Settings, …) — its dot lights
  // when any of those hidden sections wants attention.
  const shownIds = [...LEFT_IDS, CENTER_ID, ...RIGHT_IDS];
  const moreAttention = sections.filter((s) => !shownIds.includes(s.id)).some(sectionAttention);

  const left = LEFT_IDS.map(byId).filter(Boolean);
  const mid = RIGHT_IDS.map(byId).filter(Boolean);

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 flex items-stretch border-t border-neutral-200/80 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      {left.map((s) => (
        <NavTab key={s.id} section={s} active={active.sectionId === s.id} hasAttention={sectionAttention(s)} onClick={() => go(s)} />
      ))}

      {/* Centre — Bookings, raised + emphasised (most-visited). The circle lifts
          above the bar via -mt; the label stays on the same baseline as siblings. */}
      {center && (
        <button
          type="button"
          onClick={() => go(center)}
          aria-current={centerActive ? 'page' : undefined}
          aria-label={center.label}
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
          <span className={cn('text-[10px] font-semibold leading-none', centerActive ? 'text-maroon' : 'text-neutral-500')}>
            {center.label}
          </span>
        </button>
      )}

      {mid.map((s) => (
        <NavTab key={s.id} section={s} active={active.sectionId === s.id} hasAttention={sectionAttention(s)} onClick={() => go(s)} />
      ))}

      {/* More — opens the full nav drawer (Chat, Settings, Availability, …). */}
      <button
        ref={moreTriggerRef}
        type="button"
        onClick={onOpenMore}
        aria-haspopup="dialog"
        aria-label={moreAttention ? 'More, has attention' : 'More'}
        className="relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-neutral-500 transition-colors active:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
      >
        <span className="relative">
          <Menu className="h-[22px] w-[22px]" strokeWidth={1.9} />
          {moreAttention && <AttentionDot />}
        </span>
        <span className="text-[10px] font-semibold leading-none">More</span>
      </button>
    </nav>
  );
};

export default MobileTabBar;

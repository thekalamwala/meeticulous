import { useLocation, useNavigate } from 'react-router-dom';
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
 * A tap lands the section's first openable page (same as a rail click). Deep
 * sub-pages (e.g. Transactions under Bookings) stay reachable from the drawer
 * and in-page nav; the tab bar is the primary section switcher. */
const MobileTabBar = () => {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const plan = normalizePlan(user?.plan);
  const sections = visibleSections({ user, plan });
  const chatUnread = useSupportUnread();
  const badges = { ...computeBadges(user), chatUnread };
  const active = resolveActive(pathname, sections);

  const sectionAttention = (s) =>
    s.items.some((i) => (i.badgeKey ? badges[i.badgeKey] || 0 : 0) > 0);

  return (
    <nav
      aria-label="Sections"
      className="fixed inset-x-0 bottom-0 z-40 flex items-stretch border-t border-neutral-200/80 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      {sections.map((s) => {
        const isActive = s.id === active.sectionId;
        const accent = ACCENT[s.id];
        const to = firstItemTo(s, plan);
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => to && navigate(to)}
            aria-current={isActive ? 'page' : undefined}
            aria-label={sectionAttention(s) ? `${s.label}, has attention` : s.label}
            className={cn(
              'relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary',
              isActive ? '' : 'text-neutral-500 active:bg-neutral-100',
            )}
            style={isActive ? { color: accent } : undefined}
          >
            {/* active-section accent bar, top edge of the tab */}
            {isActive && (
              <span
                aria-hidden="true"
                className="absolute inset-x-[22%] top-0 h-[3px] rounded-full"
                style={{ backgroundColor: accent }}
              />
            )}
            <span className="relative">
              <img
                src={`${ICON_DIR}/${s.icon}-${isActive ? 'active' : 'inactive'}@2x.png`}
                srcSet={`${ICON_DIR}/${s.icon}-${isActive ? 'active' : 'inactive'}@2x.png 2x, ${ICON_DIR}/${s.icon}-${isActive ? 'active' : 'inactive'}@3x.png 3x`}
                width={22}
                height={22}
                alt=""
                aria-hidden="true"
                draggable={false}
                className="shrink-0 select-none"
              />
              {sectionAttention(s) && (
                <span
                  aria-hidden="true"
                  className="absolute -right-1 -top-0.5 h-2 w-2 rounded-full bg-rose ring-2 ring-white"
                />
              )}
            </span>
            <span className="max-w-full truncate text-[10px] font-semibold leading-none">
              {s.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};

export default MobileTabBar;

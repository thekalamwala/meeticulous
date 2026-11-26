// Kept Settings shell — "nothing clever, calm and findable" (iOS Settings + Stripe).
//
//  • Phone: the root (/dashboard/profile) is a large title and grouped rows. Every
//    row pushes a sub-screen with a back chevron to that list.
//  • Desktop (lg+): two panes. The grouped list sits on the left, the open group
//    on the right. /dashboard/profile opens on Account.
//
// No mascot: Settings is the calm page (founder call, 2026-11-26).
import { motion, useReducedMotion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import useIsMobile from '../../hooks/useIsMobile';
import { cn } from '../../components/dashboard/ui/cn';
import { SETTINGS_GROUPS, SETTINGS_ROOT, rowById } from './settingsModel';

export const EASE = [0.22, 0.61, 0.36, 1];
export const useIsDesktop = () => !useIsMobile('(max-width: 1023px)');

const TONE = { ok: 'text-success-fg', wait: 'text-warning-fg', act: 'text-maroon' };
const focus = 'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-rose';

/* One settings row: icon chip · label over value · chevron. The whole row is the
 * tap target (min 56px). Each text line truncates on its own. */
const Row = ({ row, user, compact, last, current }) => {
  const isActive = compact && current;
  const Icon = row.icon;
  const value = row.value?.(user);
  const tone = row.tone?.(user);
  return (
    <Link to={row.to} aria-current={isActive ? 'page' : undefined}
      className={cn(
        'group relative flex w-full items-center gap-3 px-4 text-left transition-colors',
        compact ? 'min-h-[56px] py-2.5' : 'min-h-[60px] py-3',
        isActive ? 'bg-blush' : 'hover:bg-pink-50 active:bg-blush',
        focus,
      )}>
      <span className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-[10px]',
        isActive ? 'bg-white text-maroon' : 'bg-blush text-maroon')}>
        <Icon className="h-[18px] w-[18px]" strokeWidth={1.9} />
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn('block truncate font-semibold text-ink', compact ? 'text-[14px]' : 'text-[15px]',
          isActive && 'text-maroon')}>{row.label}</span>
        {value && <span className={cn('block truncate text-[12.5px] sm:text-[13px]', tone ? cn('font-medium', TONE[tone]) : 'text-muted')}>{value}</span>}
      </span>
      <ChevronRight className={cn('h-[18px] w-[18px] shrink-0 text-faint', compact && 'lg:hidden')} strokeWidth={2} aria-hidden="true" />
      {/* Inset divider: starts after the icon chip, like iOS. */}
      {!last && <span aria-hidden="true" className="absolute bottom-0 left-[64px] right-0 h-px bg-neutral-200/70" />}
    </Link>
  );
};

export const SettingsList = ({ compact = false, active }) => {
  const { user } = useAuth();
  return (
    <nav aria-label="Settings" className="flex flex-col gap-4">
      {SETTINGS_GROUPS.map((g) => (
        <ul key={g.id} className="mb-0 list-none overflow-hidden rounded-[24px] bg-white p-0">
          {g.rows.map((r, i) => <li key={r.id}><Row row={r} user={user} compact={compact} last={i === g.rows.length - 1} current={r.id === active} /></li>)}
        </ul>
      ))}
    </nav>
  );
};

/* Phone: the back chevron + a large title. Desktop: the pane's own heading. */
const PaneHeading = ({ title, sub, action }) => (
  <header className="flex flex-wrap items-end justify-between gap-3">
    <div className="min-w-0">
      <h1 className="mb-0 font-display text-[26px] font-extrabold leading-[1.05] tracking-[-0.035em] text-maroon lg:text-[30px]">{title}</h1>
      {sub && <p className="mb-0 mt-1.5 text-[13.5px] text-muted lg:text-[15px]">{sub}</p>}
    </div>
    {action}
  </header>
);

export const BackToSettings = () => (
  <Link to={SETTINGS_ROOT}
    className={cn('-ml-2 inline-flex min-h-[44px] items-center gap-0.5 rounded-[12px] pl-1 pr-3 text-[15px] font-semibold text-maroon active:bg-blush lg:hidden', focus)}>
    <ChevronLeft className="h-5 w-5" strokeWidth={2.2} aria-hidden="true" /> Settings
  </Link>
);

/**
 * pane: a row id from settingsModel ('account', 'notifications', …).
 * root: render the phone root list instead of the pane (desktop ignores it and
 * shows the pane, so /dashboard/profile opens on Account there).
 */
export default function SettingsShell({ pane, root = false, title, sub, action, children }) {
  const desktop = useIsDesktop();
  const reduce = useReducedMotion();
  const row = rowById(pane);

  if (!desktop && root) {
    return (
      <div className="flex flex-col gap-5">
        <PaneHeading title="Settings" />
        <SettingsList />
      </div>
    );
  }

  const body = (
    <div className="flex min-w-0 flex-col gap-4 lg:gap-5">
      <div className="flex flex-col gap-1">
        <BackToSettings />
        <PaneHeading title={title || row?.label} sub={sub} action={action} />
      </div>
      {children}
    </div>
  );

  if (desktop) {
    return (
      <div className="grid grid-cols-[minmax(260px,300px)_minmax(0,1fr)] items-start gap-6">
        <div className="sticky top-[72px] flex flex-col gap-3">
          <p className="mb-0 px-1 font-display text-[20px] font-extrabold tracking-[-0.03em] text-maroon">Settings</p>
          <SettingsList compact active={pane} />
        </div>
        <div className="min-w-0 max-w-[760px]">{body}</div>
      </div>
    );
  }

  // Phone sub-screen: pushed in from the right (a short, brand-eased slide). Under
  // reduced motion it simply appears.
  return (
    <motion.div initial={reduce ? false : { x: 28, opacity: 0.6 }} animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.22, ease: EASE }}>
      {body}
    </motion.div>
  );
}

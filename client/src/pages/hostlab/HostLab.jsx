// ─────────────────────────────────────────────────────────────────────────────
// Host Lab — the redesigned host dashboard, as a clickable prototype.
//
// Isolated on purpose: its own route tree (/host-lab/*), its own layout, zero
// API calls, zero auth, no imports from the live /dashboard pages. It reuses the
// real design tokens (tailwind.config.js → design-system) and the real UI kit
// (components/dashboard/ui) so what you click here is buildable as-is.
//
// IA change being proposed, in one line: the live console has 6 sections behind
// a push/pop rail, so every page costs two clicks and you cannot see the whole
// product at once. Here the rail is FLAT and grouped — Main / Business /
// Account — and a section with sub-pages expands IN PLACE under a chevron
// rather than replacing the list. Every live page is preserved; see
// `pageMap.js`, which is the preservation checklist and renders in the app at
// Settings › Where things moved.
//
// Density is console scale, not marketing scale: 32px nav rows, a 48px topbar,
// 12.5px row text and 9.5px uppercase labels. The scale lives here and in
// labUi.jsx; nothing sets a one-off size.
// ─────────────────────────────────────────────────────────────────────────────
import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell, CheckCircle2 as CircleCheck, ChevronRight, CreditCard, ExternalLink, HelpCircle,
  LogOut, Menu, MessageSquare, PanelLeft, Repeat, Search, ShieldCheck, Sparkles, X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '../../components/dashboard/ui';
import { Avatar, CommandPalette, LabBanner, fmtTime, relDay } from './labUi';
import { FLAT, NAV, SUBPAGES, TAB_BAR, href, landingFor } from './nav';
import mock from './mockData';

const Today = lazy(() => import('./sections/Today'));
const Bookings = lazy(() => import('./sections/Bookings'));
const Clients = lazy(() => import('./sections/Clients'));
const Catalog = lazy(() => import('./sections/Catalog'));
const CatalogEditor = lazy(() => import('./sections/CatalogEditor'));
const Schedule = lazy(() => import('./sections/Schedule'));
const Community = lazy(() => import('./sections/Community'));
const Insights = lazy(() => import('./sections/Insights'));
const Intelligence = lazy(() => import('./sections/Intelligence'));
const Money = lazy(() => import('./sections/Money'));
const Grow = lazy(() => import('./sections/Grow'));
const SettingsSection = lazy(() => import('./sections/SettingsSection'));

const RAIL = 200;      // expanded
const RAIL_MIN = 56;   // icon only
const RAIL_KEY = 'hostlab:rail';

/** Collapse state, remembered per viewer. Storage can throw in a private
 *  window or be cleared, so it is never trusted and never required. */
const useRailState = () => {
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(RAIL_KEY) === '1'; } catch { return false; }
  });
  const toggle = () => setCollapsed((v) => {
    try { localStorage.setItem(RAIL_KEY, v ? '0' : '1'); } catch { /* not worth caring about */ }
    return !v;
  });
  return [collapsed, toggle];
};
const ring = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose';

/* ── Nav rows ──────────────────────────────────────────────────────────── */

const Badge = ({ n, on }) => (
  <span className={cn('ml-auto grid min-h-[16px] min-w-[16px] place-items-center rounded-full px-1 text-[9.5px] font-bold leading-none', on ? 'bg-white text-maroon' : 'bg-rose text-white')}>
    {n}
  </span>
);

/** One destination. A row with sub-pages carries a chevron that expands it in
 *  place — the row itself still navigates, so the chevron is never the only
 *  way in. */
const NavRow = ({ item, activePage, expanded, onToggle, onNavigate, collapsed }) => {
  const pages = item.pages ? SUBPAGES[item.pages] : null;

  // Collapsed: the icon is the whole row, and the label — plus any sub-pages —
  // arrive in a flyout on hover. Without this the sub-pages would simply be
  // unreachable while the rail is narrow, which is how most collapsed rails
  // quietly lose half the product.
  if (collapsed) {
    return (
      <li className="group/row relative">
        <NavLink
          to={href(landingFor(item))}
          end={item.end}
          onClick={onNavigate}
          title={item.label}
          className={({ isActive }) =>
            cn('relative mx-auto grid h-8 w-8 place-items-center rounded-sm transition', ring,
              isActive ? 'bg-maroon text-white' : 'text-ink/55 hover:bg-blush hover:text-ink')
          }
        >
          <item.icon className="h-[15px] w-[15px]" strokeWidth={2.2} />
          {item.badge > 0 && <span className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-rose" />}
        </NavLink>

        <div className="pointer-events-none absolute left-full top-0 z-50 hidden pl-1.5 group-hover/row:block group-focus-within/row:block">
          <div className="pointer-events-auto min-w-[150px] overflow-hidden rounded-sm border-2 border-neutral-200 bg-white py-1 dash-elev-3">
            <p className="px-2.5 py-1 text-[11.5px] font-bold text-ink">{item.label}</p>
            {pages && (
              <ul className="border-t-2 border-neutral-200 pt-1">
                {pages.map((pg) => (
                  <li key={pg.slug}>
                    <NavLink
                      to={href(`${item.to}/${pg.slug}`)}
                      onClick={onNavigate}
                      className={cn('block px-2.5 py-1 text-[11.5px] transition', ring,
                        activePage === pg.slug ? 'bg-blush font-semibold text-maroon' : 'font-medium text-ink/55 hover:bg-cream hover:text-ink')}
                    >
                      {pg.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </li>
    );
  }

  return (
    <li>
      <div className="relative">
        <NavLink
          to={href(landingFor(item))}
          end={item.end}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'flex h-7 items-center gap-2 rounded-sm px-2 text-[12px] font-semibold transition',
              ring,
              pages && 'pr-7',
              isActive ? 'bg-maroon text-white' : 'text-ink/60 hover:bg-blush hover:text-ink',
            )
          }
        >
          {({ isActive }) => (
            <>
              <item.icon className="h-[15px] w-[15px] shrink-0" strokeWidth={2.2} />
              <span className="flex-1 truncate">{item.label}</span>
              {item.badge > 0 && <Badge n={item.badge} on={isActive} />}
            </>
          )}
        </NavLink>
        {pages && (
          <button
            type="button"
            onClick={() => onToggle(item.to)}
            aria-expanded={expanded}
            aria-label={`${expanded ? 'Collapse' : 'Expand'} ${item.label}`}
            className={cn('absolute right-1 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-xs text-ink/40 transition hover:text-ink', ring)}
          >
            <ChevronRight className={cn('h-3.5 w-3.5 transition-transform', expanded && 'rotate-90')} strokeWidth={2.6} />
          </button>
        )}
      </div>

      {pages && expanded && (
        <ul className="ml-[15px] mt-0.5 flex flex-col gap-px border-l-2 border-neutral-200 pl-2.5">
          {pages.map((pg) => (
            <li key={pg.slug}>
              <NavLink
                to={href(`${item.to}/${pg.slug}`)}
                onClick={onNavigate}
                className={cn(
                  'flex h-6 items-center rounded-xs px-2 text-[11.5px] transition',
                  ring,
                  activePage === pg.slug ? 'bg-blush font-semibold text-maroon' : 'font-medium text-ink/50 hover:bg-cream hover:text-ink',
                )}
              >
                <span className="truncate">{pg.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
};

const SidebarBody = ({ onNavigate, collapsed = false }) => {
  const { pathname } = useLocation();
  const [section, sub] = pathname.replace(/^\/host-lab\/?/, '').split('/');
  // Accordion: one section open at a time, so the rail never grows past a
  // screenful. Opening one closes the last; the active section opens itself.
  const [open, setOpen] = useState(() => section || null);
  useEffect(() => { if (section) setOpen(section); }, [section]);

  return (
    <>
      <nav aria-label="Dashboard sections" className="dash-noscrollbar flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-2 py-2">
        {NAV.map((group, i) => (
          <div key={group.label}>
            {/* Collapsed, a group label would not fit — a hairline carries the
                same grouping without the words. */}
            {collapsed
              ? i > 0 && <div className="mx-auto mb-1.5 h-px w-6 bg-neutral-200" />
              : <p className="px-2 pb-1 text-[9.5px] font-bold uppercase tracking-[0.1em] text-ink/35">{group.label}</p>}
            <ul className="flex flex-col gap-px">
              {group.items.map((item) => (
                <NavRow
                  key={item.label}
                  item={item}
                  collapsed={collapsed}
                  activePage={section === item.to ? sub || SUBPAGES[item.pages]?.[0]?.slug : null}
                  expanded={open === item.to}
                  onToggle={(to) => setOpen((o) => (o === to ? null : to))}
                  onNavigate={onNavigate}
                />
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer. Quiet by design: the rail's job is to get you somewhere, and
          the last thing in it should not shout. A changelog link earns its
          place because a host noticing the product moves is cheap trust. */}
      <div className="shrink-0 border-t-2 border-neutral-200 px-2 py-1.5">
        {collapsed ? (
          <a
            href="/changelog"
            target="_blank"
            rel="noreferrer"
            onClick={(e) => { e.preventDefault(); onNavigate?.(); }}
            title="View changelog"
            className={cn('mx-auto grid h-7 w-7 place-items-center rounded-sm text-ink/35 transition hover:bg-blush hover:text-maroon', ring)}
          >
            <Sparkles className="h-3.5 w-3.5" strokeWidth={2.2} />
          </a>
        ) : (
          <>
            <a
              href="/changelog"
              target="_blank"
              rel="noreferrer"
              onClick={(e) => { e.preventDefault(); onNavigate?.(); }}
              className={cn('flex items-center gap-1.5 rounded-xs px-1.5 py-1 text-[11px] font-semibold text-ink/50 transition hover:bg-blush hover:text-maroon', ring)}
            >
              <Sparkles className="h-3 w-3 shrink-0" strokeWidth={2.4} />
              View changelog
            </a>
            <p className="px-1.5 pt-0.5 text-[9.5px] font-medium text-ink/30">© 2026 Meeticulous</p>
          </>
        )}
      </div>
    </>
  );
};

/* ── Topbar ────────────────────────────────────────────────────────────── */
const Popover = ({ open, onClose, label, width, children }) => {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} aria-hidden="true" />
      <div role="dialog" aria-label={label} className={cn('absolute right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-neutral-200/70 bg-white shadow-[0_4px_12px_-4px_rgba(43,10,20,0.1),0_16px_40px_-16px_rgba(43,10,20,0.25)]', width)}>
        {children}
      </div>
    </>
  );
};

/* ── Profile menu ─────────────────────────────────────────────────────────
 * Identity, which space you are in, the half-finished setup, and the five
 * account pages — one menu instead of five places. "Switch to guesting" is a
 * real product mechanic here, not a role switcher: one identity, two doors
 * (mode 'hosting' / 'traveling'), and crossing logs the other side out, which
 * is why it confirms rather than just toggling.
 * ---------------------------------------------------------------------- */
const ProfileMenu = ({ onGo, onClose }) => {
  const [confirmSwitch, setConfirmSwitch] = useState(false);
  const done = mock.setupChecklist.filter((c) => c.done).length;
  const total = mock.setupChecklist.length;
  const setupLeft = total - done;

  // Hover is an inset rounded slot, never an edge-to-edge band: the menu reads
  // as a stack of objects rather than a ruled list.
  const row = cn(
    'group mx-1.5 flex w-[calc(100%-12px)] items-center gap-2.5 rounded-xl px-2 py-2',
    'text-left text-[12px] font-medium text-ink/70 transition hover:bg-blush hover:text-ink',
    ring,
  );

  const LINKS = [
    { label: 'Profile verification', to: 'settings/verification', icon: ShieldCheck, note: <StatusDot ok>Verified</StatusDot> },
    { label: 'Plan & billing', to: 'settings/plan', icon: CreditCard, note: <span className="text-[9.5px] font-bold uppercase tracking-wide text-maroon">Pro</span> },
    { label: 'Support', to: 'settings/help', icon: MessageSquare },
    { label: 'Help centre', to: 'settings/help', icon: HelpCircle, external: true },
  ];

  return (
    <div className="text-ink">
      {/* Identity — blush ground gives the menu a head instead of a first row.
          The ee-thread arc behind the avatar is the brand motif, one per
          surface, tone-on-tone and never over text. */}
      <div className="relative overflow-hidden bg-blush px-3 pb-3 pt-3.5 text-center">
        <span aria-hidden="true" className="absolute -left-6 -top-8 h-20 w-20 rounded-full border-[3px] border-maroon/10" />
        <span aria-hidden="true" className="absolute -right-7 top-6 h-16 w-16 rounded-full border-[3px] border-maroon/10" />
        <span className="relative mx-auto grid h-11 w-11 place-items-center rounded-full bg-maroon font-display text-[14px] font-extrabold text-white ring-[3px] ring-white">
          {mock.host.name.split(/\s+/).slice(0, 2).map((w) => w[0]).join('')}
        </span>
        <p className="relative mt-2 flex items-center justify-center gap-1.5 font-display text-[13px] font-bold leading-tight tracking-[-0.02em]">
          {mock.host.name}
          <span className="rounded-full bg-maroon px-1.5 py-px text-[8.5px] font-bold uppercase tracking-[0.06em] text-white">Pro</span>
        </p>
        <p className="relative mt-0.5 truncate text-[10.5px] font-medium text-maroon/60">{mock.host.email}</p>
      </div>

      {/* Which space you are in */}
      <div className="border-t border-neutral-200/50 py-1.5">
        {/* State first, action second: the line tells you where you are, the
            row below it is the way out. Reading them the other way round meant
            the control arrived before the fact it depends on. */}
        <p className="px-3 pb-1 pt-0.5 text-[10px] font-medium text-ink/40">
          Viewing as: <span className="font-bold text-ink/70">Host</span>
        </p>

        {confirmSwitch ? (
          <div className="mx-1.5 rounded-sm bg-cream p-2.5">
            <p className="text-[10.5px] font-medium leading-snug text-ink/70">
              One identity, two doors. Switching signs you out of hosting on this device.
            </p>
            <div className="mt-2 flex gap-1.5">
              <button
                type="button"
                onClick={() => { toast.success('Switched to your guest space'); onClose(); }}
                className={cn('rounded-full bg-maroon px-2.5 py-1 text-[10.5px] font-bold text-white transition hover:bg-maroon-dark', ring)}
              >
                Switch
              </button>
              <button type="button" onClick={() => setConfirmSwitch(false)} className={cn('rounded-full px-2.5 py-1 text-[10.5px] font-bold text-ink/55 transition hover:bg-neutral-100', ring)}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirmSwitch(true)} className={cn(row, 'font-semibold text-ink')}>
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-neutral-100 text-ink/55 transition group-hover:bg-white group-hover:text-maroon">
              <Repeat className="h-3.5 w-3.5" strokeWidth={2.4} />
            </span>
            <span className="flex-1">Switch to Guest</span>
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-ink/25" strokeWidth={2.6} />
          </button>
        )}
      </div>

      {/* Setup — the same row shape as everything below it. The card, the
          seven segment bars and the "2 left · next:" line all said what the
          counter already says. */}
      <div className="border-t border-neutral-200/50 py-1.5">
        <button type="button" onClick={() => onGo('grow/page')} className={row}>
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-neutral-100 text-ink/50 transition group-hover:bg-white group-hover:text-maroon">
            <CircleCheck className="h-3.5 w-3.5" strokeWidth={2.2} />
          </span>
          <span className="flex-1 truncate">Setup checklist</span>
          <span className={cn('shrink-0 text-[10px] font-bold tabular-nums', setupLeft ? 'text-marigold-800' : 'text-success-fg')}>
            {done}/{total}
          </span>
        </button>
      </div>

      <div className="border-t border-neutral-200/50 py-1.5">
        {LINKS.map((l) => (
          <button key={l.label} type="button" onClick={() => onGo(l.to)} className={row}>
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-neutral-100 text-ink/50 transition group-hover:bg-white group-hover:text-maroon">
              <l.icon className="h-3.5 w-3.5" strokeWidth={2.2} />
            </span>
            <span className="flex-1 truncate">{l.label}</span>
            <span className="flex shrink-0 items-center gap-1">
              {l.note}
              {l.external && <ExternalLink className="h-3 w-3 text-ink/25" strokeWidth={2.4} />}
            </span>
          </button>
        ))}
      </div>

      <div className="border-t border-neutral-200/50 py-1.5">
        <button
          type="button"
          onClick={() => { toast.success('Signed out'); onClose(); }}
          className={cn(row, 'text-ink/55 hover:bg-error-bg hover:text-error-fg')}
        >
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-neutral-100 text-ink/50 transition group-hover:bg-white group-hover:text-error-fg">
            <LogOut className="h-3.5 w-3.5" strokeWidth={2.2} />
          </span>
          Sign out
        </button>
      </div>
    </div>
  );
};

const StatusDot = ({ ok, children }) => (
  <span className={cn('inline-flex items-center gap-1 text-[9.5px] font-bold uppercase tracking-wide', ok ? 'text-success-fg' : 'text-warning-fg')}>
    <span className={cn('h-1.5 w-1.5 rounded-full', ok ? 'bg-success-fg' : 'bg-warning-fg')} />
    {children}
  </span>
);

/* ── Account side-drawer (mobile) — the profile menu slides in from the right
 * like a native app sheet; desktop keeps the dropdown. CSS-only slide, no dep. */
const AccountDrawer = ({ open, onClose, children }) => createPortal(
  <div className={cn('fixed inset-0 z-[90] lg:hidden', open ? '' : 'pointer-events-none')} aria-hidden={!open}>
    <div
      onClick={onClose}
      className={cn('absolute inset-0 bg-ink/40 transition-opacity duration-300', open ? 'opacity-100' : 'opacity-0')}
    />
    <div
      role="dialog"
      aria-label="Account"
      className={cn(
        'absolute inset-y-0 right-0 flex w-[86%] max-w-[340px] flex-col overflow-y-auto bg-white shadow-[0_0_48px_-8px_rgba(43,10,20,0.45)] transition-transform duration-300 ease-out',
        open ? 'translate-x-0' : 'translate-x-full',
      )}
    >
      {children}
    </div>
  </div>,
  document.body,
);

const Topbar = ({ onOpenNav, onOpenSearch, onGo }) => {
  const [notif, setNotif] = useState(false);
  const [acct, setAcct] = useState(false);
  const iconBtn = cn('grid h-9 w-9 place-items-center rounded-full text-ink/55 transition hover:bg-blush lg:h-7 lg:w-7', ring);

  return (
    // Mobile gets a taller bar (56px), wider gaps and 36px tap targets so the
    // chrome breathes under the prototype banner; lg: resets to the 44px console
    // density that keeps the topbar aligned with the desktop rail header.
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 bg-cream/80 px-3 backdrop-blur-md shadow-[0_1px_16px_-10px_rgba(43,10,20,0.25)] sm:px-4 lg:h-11">
      <button type="button" onClick={onOpenNav} aria-label="Open navigation" className={cn(iconBtn, 'lg:hidden')}>
        <Menu className="h-[18px] w-[18px]" strokeWidth={2.2} />
      </button>

      <button
        type="button"
        onClick={onOpenSearch}
        className={cn('flex h-9 min-w-0 flex-1 items-center gap-1.5 rounded-full border border-neutral-200/70 bg-white px-3 text-left text-[11.5px] font-medium text-ink/40 shadow-[0_1px_2px_rgba(43,10,20,0.03)] transition hover:border-maroon/30 sm:max-w-[250px] lg:h-7 lg:px-2.5', ring)}
      >
        <Search className="h-3.5 w-3.5 shrink-0" strokeWidth={2.2} />
        <span className="truncate">Search or jump to anything…</span>
        <kbd className="ml-auto hidden shrink-0 rounded border border-neutral-200 px-1 text-[9.5px] font-bold sm:block">/</kbd>
      </button>

      {/* No global "Add booking" here: every page already carries its own
          primary action in its header (Add booking, New service, Add client),
          where it belongs to what you are looking at. A second copy in the
          chrome was the same button twice on the one page that needs it, and
          an out-of-context one on the seven that don't. */}
      <div className="ml-auto flex shrink-0 items-center gap-1.5 lg:gap-1">
        <button type="button" onClick={() => onGo('settings/help')} aria-label="Help and support" className={iconBtn}>
          <HelpCircle className="h-4 w-4" strokeWidth={2.2} />
        </button>

        <div className="relative">
          <button type="button" onClick={() => { setNotif((v) => !v); setAcct(false); }} aria-label="Notifications, 3 recent" className={cn(iconBtn, 'relative')}>
            <Bell className="h-4 w-4" strokeWidth={2.2} />
            <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-rose" />
          </button>
          <Popover open={notif} onClose={() => setNotif(false)} label="Notifications" width="w-[268px]">
            <p className="border-b border-neutral-200/60 px-3 py-2 font-display text-[11.5px] font-bold text-ink">Recent activity</p>
            <ul className="max-h-[280px] divide-y divide-neutral-200/70 overflow-y-auto">
              {mock.activity.map((a) => (
                <li key={a.id} className="px-2.5 py-1.5">
                  <p className="text-[11px] font-medium leading-snug text-ink/80">{a.text}</p>
                  <p className="mt-0.5 text-[10px] font-semibold text-ink/40">{relDay(a.at)} · {fmtTime(a.at)}</p>
                </li>
              ))}
            </ul>
          </Popover>
        </div>

        <div className="relative">
          <button type="button" onClick={() => { setAcct((v) => !v); setNotif(false); }} aria-label="Account menu" className={cn('rounded-full transition hover:opacity-85', ring)}>
            <Avatar name={mock.host.name} size="h-8 w-8 text-[11px] lg:h-7 lg:w-7 lg:text-[10px]" />
          </button>
          {/* Desktop: a dropdown. Mobile: a native-feel side drawer. */}
          <div className="hidden lg:block">
            <Popover open={acct} onClose={() => setAcct(false)} label="Account" width="w-[264px]">
              <ProfileMenu onGo={(to) => { onGo(to); setAcct(false); }} onClose={() => setAcct(false)} />
            </Popover>
          </div>
          <AccountDrawer open={acct} onClose={() => setAcct(false)}>
            <ProfileMenu onGo={(to) => { onGo(to); setAcct(false); }} onClose={() => setAcct(false)} />
          </AccountDrawer>
        </div>
      </div>
    </header>
  );
};

/* ── Phone tab bar ─────────────────────────────────────────────────────────
 * Five destinations, Grow raised in the centre as the hero. No "More": the
 * full nav drawer is one tap away on the top-bar burger, so repeating it here
 * was a sixth cramped slot for nothing. The whole rest of the product
 * (Catalog, Schedule, Intelligence, Community, Settings…) lives in that drawer.
 * ---------------------------------------------------------------------- */
const TAB_ORDER = ['', 'bookings', 'grow', 'money', 'clients']; // Grow = index 2, centre
const TabBar = () => (
  <nav aria-label="Sections" className="fixed inset-x-0 bottom-0 z-30 flex items-end border-t-2 border-neutral-200 bg-cream/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
    {TAB_ORDER.map((to, i) => {
      const item = FLAT.find((n) => n.to === to);
      if (!item) return null;
      if (i === 2) {
        // Hero: a raised circle that punches up through the bar.
        return (
          <div key={item.label} className="flex flex-1 justify-center">
            <NavLink
              to={href(landingFor(item))}
              end={item.end}
              aria-label={item.label}
              className={({ isActive }) => cn(
                '-mt-6 flex h-16 w-16 flex-col items-center justify-center gap-0.5 rounded-full border-4 border-cream text-white shadow-lg transition active:translate-y-px',
                isActive ? 'bg-maroon-dark' : 'bg-maroon',
              )}
            >
              <span className="relative">
                <item.icon className="h-5 w-5" strokeWidth={2.4} />
                {item.badge > 0 && <span className="absolute -right-1 -top-0.5 h-2 w-2 rounded-full border-2 border-maroon bg-pink" />}
              </span>
              <span className="text-[8.5px] font-bold">{item.label}</span>
            </NavLink>
          </div>
        );
      }
      return (
        <NavLink
          key={item.label}
          to={href(landingFor(item))}
          end={item.end}
          className={({ isActive }) => cn('flex flex-1 flex-col items-center gap-0.5 py-1.5 text-[9.5px] font-bold transition', isActive ? 'text-maroon' : 'text-ink/45')}
        >
          <span className="relative">
            <item.icon className="h-[17px] w-[17px]" strokeWidth={2.2} />
            {item.badge > 0 && <span className="absolute -right-1 -top-0.5 h-1.5 w-1.5 rounded-full bg-rose" />}
          </span>
          {item.label}
        </NavLink>
      );
    })}
  </nav>
);

/* ── Page ──────────────────────────────────────────────────────────────── */
const HostLab = () => {
  const [navOpen, setNavOpen] = useState(false);
  const [railCollapsed, toggleRail] = useRailState();
  const [searchOpen, setSearchOpen] = useState(false);
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const go = useCallback((to) => navigate(href(to)), [navigate]);

  useEffect(() => { setNavOpen(false); window.scrollTo({ top: 0 }); }, [pathname]);

  // "/" focuses search the way Linear and GitHub do; ⌘K / Ctrl-K too.
  useEffect(() => {
    const onKey = (e) => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName) || e.target?.isContentEditable;
      if (typing) return;
      if (e.key === '/' || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k')) {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // One index over everything searchable, sub-pages included. Real build: one
  // /host/search endpoint behind the same shape.
  const searchItems = useMemo(() => [
    ...mock.bookings.map((b) => ({
      id: `b-${b.id}`, group: 'Booking', title: `${b.guest_name} · ${b.services.title}`,
      subtitle: `${relDay(b.scheduled_at)} ${fmtTime(b.scheduled_at)} · ${b.ref}`, to: `bookings?booking=${b.id}`,
    })),
    ...mock.clients.map((c) => ({
      id: `c-${c.id}`, group: 'Client', title: c.name,
      subtitle: `${c.bookings_count} bookings · ${c.phone}`, to: `clients?client=${c.id}`,
    })),
    ...mock.services.map((s) => ({
      id: `s-${s.id}`, group: 'Service', title: s.title, subtitle: `${s.duration} min`, to: `catalog/${s.id}`,
    })),
    ...FLAT.flatMap((n) => [
      { id: `n-${n.to || 'today'}`, group: 'Go to', title: n.label, to: landingFor(n) },
      ...(n.pages ? SUBPAGES[n.pages].map((pg) => ({
        id: `n-${n.to}-${pg.slug}`, group: 'Go to', title: `${n.label} · ${pg.label}`, subtitle: pg.blurb, to: `${n.to}/${pg.slug}`,
      })) : []),
    ]),
  ], []);

  return (
    <div className="hostlab min-h-screen bg-cream">
      {/* index.css carries unlayered element rules — `button { min-height: 40px }`
          and `input { min-height: 44px }` — that beat any `h-*` class, because a
          min-height always wins over a smaller height. Every compact control in
          this prototype was therefore rendering 40px no matter what it asked
          for, which is why table rows would not go below ~58px however much the
          content was tightened.

          Lifted here only, scoped to .hostlab, so production is untouched. Safe
          because nothing in the lab relies on the floor: the shared kit Button
          sets its own height (sm 32 / md 40 / lg 44) and the lab's own controls
          are h-7 (28px) or h-6 (24px) — at or above the 24px WCAG 2.2 AA target
          minimum. Keep it that way: no control here goes under 24px.

          The vertical padding has to go with it. index.css also sets
          `input, select { padding: 0.78rem 0.95rem }`, which the 44px floor
          used to hide: with the floor gone, 25px of padding in a 32px select
          pushes the chosen option clean out of the box and `overflow: clip`
          eats it. Tailwind's `px-*` only writes left and right, so the element
          rule kept winning on top and bottom. A single-line control centres its
          own text, so zero is right; textarea is deliberately left alone,
          because its 112px floor is doing real work.

          The same bite on inputs is already documented in index.css for
          .mt-input; this is the dense-table version of it. */}
      <style>{`
        .hostlab button { min-height: 0; }
        .hostlab input, .hostlab select { min-height: 0; padding-top: 0; padding-bottom: 0; }
      `}</style>
      <LabBanner />

      {/* Desktop rail */}
      <aside
        className="group/rail fixed bottom-0 left-0 z-40 hidden flex-col border-r-2 border-neutral-200 bg-cream transition-[width] duration-200 lg:flex"
        style={{ width: railCollapsed ? RAIL_MIN : RAIL, top: 33 }}
      >
        <div className={cn('flex h-11 shrink-0 items-center border-b-2 border-neutral-200', railCollapsed ? 'justify-center px-0' : 'gap-1.5 px-2.5')}>
          <Link to="/host-lab" aria-label="Meeticulous — Today" className={cn('grid shrink-0 place-items-center rounded-xs', ring)}>
            <img src="/brand/meeticulous-icon.svg" alt="" aria-hidden="true" className="h-6 w-6 object-contain" />
          </Link>
          {!railCollapsed && (
            <span className="flex-1 truncate font-display text-[12.5px] font-bold tracking-[-0.02em] text-ink">Meeticulous</span>
          )}
          {/* The toggle only appears on hover when expanded, so the resting
              rail is brand and nav and nothing else. Collapsed it is always
              visible, because there is no other way back. */}
          <button
            type="button"
            onClick={toggleRail}
            aria-label={railCollapsed ? 'Expand navigation' : 'Collapse navigation'}
            title={railCollapsed ? 'Expand' : 'Collapse'}
            className={cn(
              'grid h-6 w-6 shrink-0 place-items-center rounded-xs text-ink/35 transition hover:bg-blush hover:text-maroon',
              ring,
              railCollapsed
                ? 'absolute -right-3 top-3 border-2 border-neutral-200 bg-cream'
                : 'opacity-0 group-hover/rail:opacity-100 focus-visible:opacity-100',
            )}
          >
            <PanelLeft className="h-3.5 w-3.5" strokeWidth={2.2} />
          </button>
        </div>
        <SidebarBody collapsed={railCollapsed} />
      </aside>

      {/* Mobile drawer */}
      {navOpen && (
        <div className="lg:hidden">
          <div className="fixed inset-0 z-[60] bg-ink/40" onClick={() => setNavOpen(false)} aria-hidden="true" />
          <div role="dialog" aria-modal="true" aria-label="Navigation" className="fixed inset-y-0 left-0 z-[60] flex w-[248px] max-w-[84vw] flex-col bg-cream">
            <div className="flex h-11 shrink-0 items-center gap-1.5 border-b-2 border-neutral-200 px-2.5">
              <img src="/brand/meeticulous-icon.svg" alt="" aria-hidden="true" className="h-6 w-6 object-contain" />
              <span className="flex-1 font-display text-[12.5px] font-bold text-ink">Meeticulous</span>
              <button type="button" onClick={() => setNavOpen(false)} aria-label="Close navigation" className="grid h-8 w-8 place-items-center rounded-full text-ink/50 hover:bg-blush">
                <X className="h-4 w-4" />
              </button>
            </div>
            <SidebarBody onNavigate={() => setNavOpen(false)} />
          </div>
        </div>
      )}

      {/* Two static classes, not an arbitrary custom property: Tailwind only
          emits what it can see as a literal string in the source. */}
      <div className={cn('transition-[padding] duration-200', railCollapsed ? 'lg:pl-[56px]' : 'lg:pl-[200px]')}>
        <Topbar onOpenNav={() => setNavOpen(true)} onOpenSearch={() => setSearchOpen(true)} onGo={go} />
        <main className="mx-auto w-full max-w-[1180px] px-2.5 pb-20 pt-3.5 sm:px-4 lg:pb-7">
          <Suspense fallback={<div className="py-20 text-center text-[11.5px] font-semibold text-ink/40">Loading…</div>}>
            <Routes>
              <Route index element={<Today go={go} />} />
              <Route path="bookings">
                <Route index element={<Navigate to="list" replace />} />
                <Route path=":page" element={<Bookings go={go} />} />
              </Route>
              <Route path="clients" element={<Clients go={go} />} />
              <Route path="catalog" element={<Catalog go={go} />} />
              {/* The editor is a page, not a modal: creating a thing you sell
                  is real work and deserves a URL you can come back to. */}
              <Route path="catalog/:id" element={<CatalogEditor />} />
              {/* Sub-pages are real routes. A bare destination redirects to
                  its first page, so the rail row always lands somewhere. */}
              {[['schedule', Schedule], ['intelligence', Intelligence], ['insights', Insights], ['money', Money], ['grow', Grow], ['community', Community], ['settings', SettingsSection]].map(([key, El]) => (
                <Route key={key} path={key}>
                  <Route index element={<Navigate to={SUBPAGES[key][0].slug} replace />} />
                  <Route path=":page" element={<El go={go} />} />
                </Route>
              ))}
              <Route path="*" element={<Navigate to="/host-lab" replace />} />
            </Routes>
          </Suspense>
        </main>
      </div>

      <TabBar />
      <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} items={searchItems} onPick={(it) => go(it.to)} />
    </div>
  );
};

export default HostLab;

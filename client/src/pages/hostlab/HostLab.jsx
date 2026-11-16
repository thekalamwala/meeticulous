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
import { Navigate, NavLink, Route, Routes, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Bell, CheckCircle2 as CircleCheck, ChevronRight, CreditCard, ExternalLink, HelpCircle,
  LogOut, Menu, MessageSquare, Plus, Repeat, Search, ShieldCheck, X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '../../components/dashboard/ui';
import { Avatar, CommandPalette, LabBanner, fmtTime, relDay } from './labUi';
import { FLAT, NAV, TAB_BAR, TABS, href } from './nav';
import mock from './mockData';

const Today = lazy(() => import('./sections/Today'));
const Bookings = lazy(() => import('./sections/Bookings'));
const Clients = lazy(() => import('./sections/Clients'));
const Catalog = lazy(() => import('./sections/Catalog'));
const Schedule = lazy(() => import('./sections/Schedule'));
const Money = lazy(() => import('./sections/Money'));
const Grow = lazy(() => import('./sections/Grow'));
const SettingsSection = lazy(() => import('./sections/SettingsSection'));

const RAIL = 200;
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
const NavRow = ({ item, activeTab, expanded, onToggle, onNavigate }) => {
  const tabs = item.tabs ? TABS[item.tabs] : null;
  return (
    <li>
      <div className="relative">
        <NavLink
          to={href(item.to)}
          end={item.end}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'flex h-7 items-center gap-2 rounded-sm px-2 text-[12px] font-semibold transition',
              ring,
              tabs && 'pr-7',
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
        {tabs && (
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

      {tabs && expanded && (
        <ul className="ml-[15px] mt-0.5 flex flex-col gap-px border-l-2 border-neutral-200 pl-2.5">
          {tabs.map((t) => (
            <li key={t.value}>
              <NavLink
                to={`${href(item.to)}?tab=${t.value}`}
                onClick={onNavigate}
                className={cn(
                  'flex h-6 items-center rounded-xs px-2 text-[11.5px] transition',
                  ring,
                  activeTab === t.value ? 'bg-blush font-semibold text-maroon' : 'font-medium text-ink/50 hover:bg-cream hover:text-ink',
                )}
              >
                <span className="truncate">{t.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
};

const SidebarBody = ({ onNavigate }) => {
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  const section = pathname.replace(/^\/host-lab\/?/, '').split('/')[0];
  const tabParam = params.get('tab');
  // Accordion: one section open at a time, so the rail never grows past a
  // screenful. Opening one closes the last; the active section opens itself.
  const [open, setOpen] = useState(() => section || null);
  useEffect(() => { if (section) setOpen(section); }, [section]);

  return (
    <>
      <nav aria-label="Dashboard sections" className="dash-noscrollbar flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-2 py-2">
        {NAV.map((group) => (
          <div key={group.label}>
            <p className="px-2 pb-1 text-[9.5px] font-bold uppercase tracking-[0.1em] text-ink/35">{group.label}</p>
            <ul className="flex flex-col gap-px">
              {group.items.map((item) => (
                <NavRow
                  key={item.label}
                  item={item}
                  activeTab={section === item.to ? tabParam || TABS[item.tabs]?.[0]?.value : null}
                  expanded={open === item.to}
                  onToggle={(to) => setOpen((o) => (o === to ? null : to))}
                  onNavigate={onNavigate}
                />
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t-2 border-neutral-200 p-2">
        <a
          href={`/${mock.host.username}`}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => { e.preventDefault(); onNavigate?.(); }}
          className={cn('flex items-center gap-1.5 rounded-sm border-2 border-maroon-100 bg-maroon-50 p-2 transition hover:border-maroon/40', ring)}
        >
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded bg-white text-maroon">
            <ExternalLink className="h-3.5 w-3.5" strokeWidth={2.4} />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[11px] font-bold text-maroon">Your booking page</span>
            <span className="block truncate text-[10px] font-medium text-ink/50">meeticulous.com/{mock.host.username}</span>
          </span>
        </a>
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
      <div role="dialog" aria-label={label} className={cn('absolute right-0 top-full z-50 mt-1.5 overflow-hidden rounded-md border-2 border-neutral-200 bg-white dash-elev-3', width)}>
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
    'group mx-1.5 flex w-[calc(100%-12px)] items-center gap-2 rounded-sm px-2 py-[7px]',
    'text-left text-[11.5px] font-medium text-ink/70 transition hover:bg-blush hover:text-ink',
    ring,
  );

  const LINKS = [
    { label: 'Profile verification', to: 'settings?tab=verification', icon: ShieldCheck, note: <StatusDot ok>Verified</StatusDot> },
    { label: 'Plan & billing', to: 'settings?tab=plan', icon: CreditCard, note: <span className="text-[9.5px] font-bold uppercase tracking-wide text-maroon">Pro</span> },
    { label: 'Support', to: 'settings?tab=help', icon: MessageSquare },
    { label: 'Help centre', to: 'settings?tab=help', icon: HelpCircle, external: true },
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
      <div className="border-t-2 border-neutral-200 py-1.5">
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
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded bg-neutral-100 text-ink/55 transition group-hover:bg-white group-hover:text-maroon">
              <Repeat className="h-3.5 w-3.5" strokeWidth={2.4} />
            </span>
            <span className="flex-1">
              <span className="block leading-tight">Switch to guesting</span>
              <span className="block text-[9.5px] font-medium leading-tight text-ink/40">Viewing as host</span>
            </span>
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-ink/25" strokeWidth={2.6} />
          </button>
        )}
      </div>

      {/* Setup — a slot, not a row with a rule under it. */}
      <div className="border-t-2 border-neutral-200 p-1.5">
        <button
          type="button"
          onClick={() => onGo('grow?tab=page')}
          className={cn('block w-full rounded-sm border-2 p-2 text-left transition', ring,
            setupLeft ? 'border-marigold-300 bg-marigold-100 hover:border-marigold' : 'border-success-fg/25 bg-success-bg')}
        >
          <span className="flex items-center gap-1.5">
            <CircleCheck className={cn('h-3.5 w-3.5 shrink-0', setupLeft ? 'text-marigold-800' : 'text-success-fg')} strokeWidth={2.6} />
            <span className={cn('text-[11.5px] font-bold', setupLeft ? 'text-marigold-800' : 'text-success-fg')}>Setup checklist</span>
            <span className={cn('ml-auto font-display text-[12px] font-extrabold tabular-nums', setupLeft ? 'text-marigold-800' : 'text-success-fg')}>
              {done}<span className="opacity-50">/{total}</span>
            </span>
          </span>
          <span className="mt-1.5 flex gap-[3px]" aria-hidden="true">
            {mock.setupChecklist.map((c, i) => (
              <span key={c.label} className={cn('h-1.5 flex-1 rounded-full', c.done ? 'bg-maroon' : i === done ? 'bg-maroon/25' : 'bg-maroon/10')} />
            ))}
          </span>
          {setupLeft > 0 && (
            <span className="mt-1.5 block text-[9.5px] font-semibold text-marigold-800/75">
              {setupLeft} left · next: {mock.setupChecklist.find((c) => !c.done).label.toLowerCase()}
            </span>
          )}
        </button>
      </div>

      <div className="border-t-2 border-neutral-200 py-1.5">
        {LINKS.map((l) => (
          <button key={l.label} type="button" onClick={() => onGo(l.to)} className={row}>
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded bg-neutral-100 text-ink/50 transition group-hover:bg-white group-hover:text-maroon">
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

      <div className="border-t-2 border-neutral-200 py-1.5">
        <button
          type="button"
          onClick={() => { toast.success('Signed out'); onClose(); }}
          className={cn(row, 'text-ink/55 hover:bg-error-bg hover:text-error-fg')}
        >
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded bg-neutral-100 text-ink/50 transition group-hover:bg-white group-hover:text-error-fg">
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

const Topbar = ({ onOpenNav, onOpenSearch, onGo }) => {
  const [notif, setNotif] = useState(false);
  const [acct, setAcct] = useState(false);
  const iconBtn = cn('grid h-7 w-7 place-items-center rounded-full text-ink/55 transition hover:bg-blush', ring);

  return (
    <header className="sticky top-0 z-30 flex h-11 shrink-0 items-center gap-1.5 border-b-2 border-neutral-200 bg-cream/95 px-2.5 backdrop-blur sm:px-4">
      <button type="button" onClick={onOpenNav} aria-label="Open navigation" className={cn(iconBtn, 'lg:hidden')}>
        <Menu className="h-[18px] w-[18px]" strokeWidth={2.2} />
      </button>

      <button
        type="button"
        onClick={onOpenSearch}
        className={cn('flex h-7 min-w-0 flex-1 items-center gap-1.5 rounded-full border-2 border-neutral-200 bg-white px-2.5 text-left text-[11.5px] font-medium text-ink/40 transition hover:border-maroon/30 sm:max-w-[250px]', ring)}
      >
        <Search className="h-3.5 w-3.5 shrink-0" strokeWidth={2.2} />
        <span className="truncate">Search bookings, clients…</span>
        <kbd className="ml-auto hidden shrink-0 rounded border border-neutral-200 px-1 text-[9.5px] font-bold sm:block">/</kbd>
      </button>

      <div className="ml-auto flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={() => onGo('bookings?new=1')}
          className={cn('hidden h-7 items-center gap-1 rounded-full bg-maroon px-2.5 text-[11.5px] font-bold text-white transition hover:bg-maroon-dark sm:inline-flex', ring)}
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2.8} /> Add booking
        </button>
        <button type="button" onClick={() => onGo('settings?tab=help')} aria-label="Help and support" className={iconBtn}>
          <HelpCircle className="h-4 w-4" strokeWidth={2.2} />
        </button>

        <div className="relative">
          <button type="button" onClick={() => { setNotif((v) => !v); setAcct(false); }} aria-label="Notifications, 3 recent" className={cn(iconBtn, 'relative')}>
            <Bell className="h-4 w-4" strokeWidth={2.2} />
            <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-rose" />
          </button>
          <Popover open={notif} onClose={() => setNotif(false)} label="Notifications" width="w-[268px]">
            <p className="border-b-2 border-neutral-200 px-2.5 py-1.5 font-display text-[11.5px] font-bold text-ink">Recent activity</p>
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
            <Avatar name={mock.host.name} size="h-7 w-7 text-[10px]" />
          </button>
          <Popover open={acct} onClose={() => setAcct(false)} label="Account" width="w-[244px]">
            <ProfileMenu onGo={(to) => { onGo(to); setAcct(false); }} onClose={() => setAcct(false)} />
          </Popover>
        </div>
      </div>
    </header>
  );
};

/* ── Phone tab bar ─────────────────────────────────────────────────────── */
const TabBar = ({ onMore }) => (
  <nav aria-label="Sections" className="fixed inset-x-0 bottom-0 z-30 flex border-t-2 border-neutral-200 bg-cream/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
    {TAB_BAR.map((to) => {
      const item = FLAT.find((n) => n.to === to);
      return (
        <NavLink
          key={item.label}
          to={href(item.to)}
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
    <button type="button" onClick={onMore} className="flex flex-1 flex-col items-center gap-0.5 py-1.5 text-[9.5px] font-bold text-ink/45">
      <Menu className="h-[17px] w-[17px]" strokeWidth={2.2} />
      More
    </button>
  </nav>
);

/* ── Page ──────────────────────────────────────────────────────────────── */
const HostLab = () => {
  const [navOpen, setNavOpen] = useState(false);
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
      id: `s-${s.id}`, group: 'Service', title: s.title, subtitle: `${s.duration} min`, to: `catalog?service=${s.id}`,
    })),
    ...FLAT.flatMap((n) => [
      { id: `n-${n.to || 'today'}`, group: 'Go to', title: n.label, to: n.to },
      ...(n.tabs ? TABS[n.tabs].map((t) => ({
        id: `n-${n.to}-${t.value}`, group: 'Go to', title: `${n.label} · ${t.label}`, to: `${n.to}?tab=${t.value}`,
      })) : []),
    ]),
  ], []);

  return (
    <div className="min-h-screen bg-cream">
      <LabBanner />

      {/* Desktop rail */}
      <aside
        className="fixed bottom-0 left-0 z-40 hidden flex-col border-r-2 border-neutral-200 bg-cream lg:flex"
        style={{ width: RAIL, top: 33 }}
      >
        <div className="flex h-11 shrink-0 items-center gap-1.5 border-b-2 border-neutral-200 px-2.5">
          <img src="/brand/meeticulous-icon.svg" alt="" aria-hidden="true" className="h-6 w-6 object-contain" />
          <span className="font-display text-[12.5px] font-bold tracking-[-0.02em] text-ink">Meeticulous</span>
        </div>
        <SidebarBody />
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

      <div className="lg:pl-[200px]">
        <Topbar onOpenNav={() => setNavOpen(true)} onOpenSearch={() => setSearchOpen(true)} onGo={go} />
        <main className="mx-auto w-full max-w-[1180px] px-2.5 pb-20 pt-3.5 sm:px-4 lg:pb-7">
          <Suspense fallback={<div className="py-20 text-center text-[11.5px] font-semibold text-ink/40">Loading…</div>}>
            <Routes>
              <Route index element={<Today go={go} />} />
              <Route path="bookings" element={<Bookings go={go} />} />
              <Route path="clients" element={<Clients go={go} />} />
              <Route path="catalog" element={<Catalog go={go} />} />
              <Route path="schedule" element={<Schedule go={go} />} />
              <Route path="money" element={<Money go={go} />} />
              <Route path="grow" element={<Grow go={go} />} />
              <Route path="settings" element={<SettingsSection go={go} />} />
              <Route path="*" element={<Navigate to="/host-lab" replace />} />
            </Routes>
          </Suspense>
        </main>
      </div>

      <TabBar onMore={() => setNavOpen(true)} />
      <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} items={searchItems} onPick={(it) => go(it.to)} />
    </div>
  );
};

export default HostLab;

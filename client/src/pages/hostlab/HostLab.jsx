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
// product at once. Here the rail is FLAT — 8 destinations, always visible — and
// depth moves into tabs inside each destination. Every live page is preserved;
// see `pageMap.js` for where each one lands (it is the preservation checklist).
// ─────────────────────────────────────────────────────────────────────────────
import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell, CalendarDays, CreditCard, Home, Menu, Package, Search, Settings,
  TrendingUp, Users, X, Plus, ExternalLink, HelpCircle,
} from 'lucide-react';
import { cn } from '../../components/dashboard/ui';
import { Avatar, CommandPalette, LabBanner, fmtTime, relDay } from './labUi';
import mock from './mockData';

const Today = lazy(() => import('./sections/Today'));
const Bookings = lazy(() => import('./sections/Bookings'));
const Clients = lazy(() => import('./sections/Clients'));
const Catalog = lazy(() => import('./sections/Catalog'));
const Schedule = lazy(() => import('./sections/Schedule'));
const Money = lazy(() => import('./sections/Money'));
const Grow = lazy(() => import('./sections/Grow'));
const SettingsSection = lazy(() => import('./sections/SettingsSection'));

/* ── Nav: flat, 8 destinations, each with its own tab set ──────────────── */
export const NAV = [
  { to: '', label: 'Today', icon: Home, end: true },
  { to: 'bookings', label: 'Bookings', icon: CalendarDays, badge: 2 },
  { to: 'clients', label: 'Clients', icon: Users },
  { to: 'catalog', label: 'Catalog', icon: Package },
  { to: 'schedule', label: 'Schedule', icon: CalendarDays },
  { to: 'money', label: 'Money', icon: CreditCard },
  { to: 'grow', label: 'Grow', icon: TrendingUp, badge: 2 },
  { to: 'settings', label: 'Settings', icon: Settings },
];

// Phone tab bar: the five a host touches daily. The rest live behind "More".
const TAB_BAR = ['', 'bookings', 'clients', 'money', 'grow'];

const BASE = '/host-lab';
const href = (to) => (to ? `${BASE}/${to}` : BASE);

/* ── Sidebar ───────────────────────────────────────────────────────────── */
const NavRow = ({ item, onNavigate, compact = false }) => (
  <NavLink
    to={href(item.to)}
    end={item.end}
    onClick={onNavigate}
    className={({ isActive }) =>
      cn(
        'group flex items-center gap-3 rounded-md px-2.5 py-2 text-[13.5px] font-semibold transition focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose',
        isActive ? 'bg-maroon text-white' : 'text-ink/60 hover:bg-blush hover:text-ink',
        compact && 'py-1.5',
      )
    }
  >
    {({ isActive }) => (
      <>
        <span className={cn('grid h-[26px] w-[26px] shrink-0 place-items-center rounded-lg transition', isActive ? 'bg-white/20' : 'bg-neutral-100 group-hover:bg-white')}>
          <item.icon className="h-[15px] w-[15px]" strokeWidth={2.2} />
        </span>
        <span className="flex-1 truncate">{item.label}</span>
        {item.badge > 0 && (
          <span className={cn('grid min-h-[18px] min-w-[18px] place-items-center rounded-full px-1.5 text-[10px] font-bold', isActive ? 'bg-white text-maroon' : 'bg-rose text-white')}>
            {item.badge}
          </span>
        )}
      </>
    )}
  </NavLink>
);

const SidebarBody = ({ onNavigate }) => (
  <>
    <nav aria-label="Dashboard sections" className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-2.5 py-3 dash-noscrollbar">
      {NAV.map((item) => <NavRow key={item.label} item={item} onNavigate={onNavigate} />)}
    </nav>
    <div className="shrink-0 border-t-2 border-neutral-200 p-2.5">
      <a
        href={`/${mock.host.username}`}
        target="_blank"
        rel="noreferrer"
        onClick={(e) => { e.preventDefault(); onNavigate?.(); }}
        className="flex items-center gap-2.5 rounded-xl border-2 border-maroon-100 bg-maroon-50 p-3 transition hover:border-maroon/40 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose"
      >
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white text-maroon">
          <ExternalLink className="h-4 w-4" strokeWidth={2.2} />
        </span>
        <span className="min-w-0">
          <span className="block truncate font-display text-[12.5px] font-bold text-maroon">Your booking page</span>
          <span className="block truncate text-[11px] font-medium text-ink/55">meeticulous.com/{mock.host.username}</span>
        </span>
      </a>
    </div>
  </>
);

/* ── Topbar ────────────────────────────────────────────────────────────── */
const NotifPanel = ({ open, onClose }) => {
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
      <div role="dialog" aria-label="Notifications" className="absolute right-0 top-full z-50 mt-2 w-[300px] overflow-hidden rounded-xl border-2 border-neutral-200 bg-white dash-elev-3">
        <p className="border-b-2 border-neutral-200 px-3.5 py-2.5 font-display text-[13px] font-bold text-ink">Recent activity</p>
        <ul className="max-h-[320px] divide-y divide-neutral-200/70 overflow-y-auto">
          {mock.activity.map((a) => (
            <li key={a.id} className="px-3.5 py-2.5">
              <p className="text-[12.5px] font-medium leading-snug text-ink/80">{a.text}</p>
              <p className="mt-0.5 text-[11px] font-semibold text-ink/40">{relDay(a.at)} · {fmtTime(a.at)}</p>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
};

const AccountMenu = ({ open, onClose, onGo }) => {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  const rows = [
    ['Account & booking page', 'settings'],
    ['Plan & billing', 'settings?tab=plan'],
    ['Verification', 'settings?tab=verification'],
    ['Where things moved', 'settings?tab=moved'],
  ];
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} aria-hidden="true" />
      <div role="menu" className="absolute right-0 top-full z-50 mt-2 w-60 overflow-hidden rounded-xl border-2 border-neutral-200 bg-white py-1 dash-elev-3">
        <div className="flex items-center gap-2.5 border-b-2 border-neutral-200 px-3.5 py-3">
          <Avatar name={mock.host.name} />
          <span className="min-w-0">
            <span className="block truncate text-[13px] font-bold text-ink">{mock.host.name}</span>
            <span className="block truncate text-[11.5px] font-medium text-ink/50">Pro · {mock.host.profession}</span>
          </span>
        </div>
        {rows.map(([label, to]) => (
          <button
            key={label}
            type="button"
            role="menuitem"
            onClick={() => { onGo(to); onClose(); }}
            className="block w-full px-3.5 py-2 text-left text-[13px] font-medium text-ink/75 transition hover:bg-blush"
          >
            {label}
          </button>
        ))}
      </div>
    </>
  );
};

const Topbar = ({ onOpenNav, onOpenSearch, onGo }) => {
  const [notif, setNotif] = useState(false);
  const [acct, setAcct] = useState(false);
  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b-2 border-neutral-200 bg-cream/95 px-3 backdrop-blur sm:px-5">
      <button
        type="button"
        onClick={onOpenNav}
        aria-label="Open navigation"
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink/60 transition hover:bg-blush lg:hidden"
      >
        <Menu className="h-5 w-5" strokeWidth={2.2} />
      </button>

      <button
        type="button"
        onClick={onOpenSearch}
        className="flex min-w-0 flex-1 items-center gap-2 rounded-full border-2 border-neutral-200 bg-white px-3 py-1.5 text-left text-[13px] font-medium text-ink/40 transition hover:border-maroon/30 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose sm:max-w-sm"
      >
        <Search className="h-4 w-4 shrink-0" strokeWidth={2.2} />
        <span className="truncate">Search bookings, clients, services…</span>
        <kbd className="ml-auto hidden shrink-0 rounded border border-neutral-200 px-1.5 py-0.5 text-[10px] font-bold sm:block">/</kbd>
      </button>

      <div className="ml-auto flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={() => onGo('bookings?new=1')}
          className="hidden items-center gap-1.5 rounded-full bg-maroon px-3.5 py-2 text-[12.5px] font-bold text-white transition hover:bg-maroon-dark focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose sm:inline-flex"
        >
          <Plus className="h-4 w-4" strokeWidth={2.6} /> Add booking
        </button>
        <button
          type="button"
          onClick={() => onGo('settings?tab=help')}
          aria-label="Help and support"
          className="grid h-9 w-9 place-items-center rounded-full text-ink/55 transition hover:bg-blush"
        >
          <HelpCircle className="h-[18px] w-[18px]" strokeWidth={2.2} />
        </button>
        <div className="relative">
          <button
            type="button"
            onClick={() => { setNotif((v) => !v); setAcct(false); }}
            aria-label="Notifications, 3 recent"
            className="relative grid h-9 w-9 place-items-center rounded-full text-ink/55 transition hover:bg-blush"
          >
            <Bell className="h-[18px] w-[18px]" strokeWidth={2.2} />
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-rose" />
          </button>
          <NotifPanel open={notif} onClose={() => setNotif(false)} />
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={() => { setAcct((v) => !v); setNotif(false); }}
            aria-label="Account menu"
            className="rounded-full transition hover:opacity-85 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose"
          >
            <Avatar name={mock.host.name} />
          </button>
          <AccountMenu open={acct} onClose={() => setAcct(false)} onGo={onGo} />
        </div>
      </div>
    </header>
  );
};

/* ── Phone tab bar ─────────────────────────────────────────────────────── */
const TabBar = ({ onMore }) => (
  <nav
    aria-label="Sections"
    className="fixed inset-x-0 bottom-0 z-30 flex border-t-2 border-neutral-200 bg-cream/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
  >
    {TAB_BAR.map((to) => {
      const item = NAV.find((n) => n.to === to);
      return (
        <NavLink
          key={item.label}
          to={href(item.to)}
          end={item.end}
          className={({ isActive }) =>
            cn('flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-bold transition', isActive ? 'text-maroon' : 'text-ink/45')
          }
        >
          <span className="relative">
            <item.icon className="h-[19px] w-[19px]" strokeWidth={2.2} />
            {item.badge > 0 && <span className="absolute -right-1 -top-0.5 h-1.5 w-1.5 rounded-full bg-rose" />}
          </span>
          {item.label}
        </NavLink>
      );
    })}
    <button type="button" onClick={onMore} className="flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-bold text-ink/45">
      <Menu className="h-[19px] w-[19px]" strokeWidth={2.2} />
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

  // Collapse the drawer on every navigation, and scroll the new page to the top.
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

  // One index over everything searchable. Real build: one /host/search endpoint.
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
    ...NAV.map((n) => ({ id: `n-${n.to || 'today'}`, group: 'Go to', title: n.label, to: n.to })),
  ], []);

  return (
    <div className="min-h-screen bg-cream">
      <LabBanner />

      {/* Desktop rail */}
      <aside
        className="fixed bottom-0 left-0 top-0 z-40 hidden w-[248px] flex-col border-r-2 border-neutral-200 bg-cream lg:flex"
        style={{ top: 37 }}
      >
        <div className="flex h-14 shrink-0 items-center gap-2.5 border-b-2 border-neutral-200 px-4">
          <img src="/brand/meeticulous-icon.svg" alt="" aria-hidden="true" className="h-8 w-8 object-contain" />
          <span className="font-display text-[15px] font-bold tracking-[-0.02em] text-ink">Meeticulous</span>
        </div>
        <SidebarBody />
      </aside>

      {/* Mobile drawer */}
      {navOpen && (
        <div className="lg:hidden">
          <div className="fixed inset-0 z-[60] bg-ink/40" onClick={() => setNavOpen(false)} aria-hidden="true" />
          <div role="dialog" aria-modal="true" aria-label="Navigation" className="fixed inset-y-0 left-0 z-[60] flex w-[276px] max-w-[85vw] flex-col bg-cream">
            <div className="flex h-14 shrink-0 items-center gap-2.5 border-b-2 border-neutral-200 px-4">
              <img src="/brand/meeticulous-icon.svg" alt="" aria-hidden="true" className="h-8 w-8 object-contain" />
              <span className="flex-1 font-display text-[15px] font-bold text-ink">Meeticulous</span>
              <button type="button" onClick={() => setNavOpen(false)} aria-label="Close navigation" className="grid h-9 w-9 place-items-center rounded-full text-ink/50 hover:bg-blush">
                <X className="h-5 w-5" />
              </button>
            </div>
            <SidebarBody onNavigate={() => setNavOpen(false)} />
          </div>
        </div>
      )}

      <div className="lg:pl-[248px]">
        <Topbar onOpenNav={() => setNavOpen(true)} onOpenSearch={() => setSearchOpen(true)} onGo={go} />
        <main className="mx-auto w-full max-w-[1180px] px-3 pb-24 pt-5 sm:px-5 lg:pb-10">
          <Suspense fallback={<div className="py-24 text-center text-[13px] font-semibold text-ink/40">Loading…</div>}>
            <Routes>
              <Route index element={<Today go={go} />} />
              <Route path="bookings" element={<Bookings go={go} />} />
              <Route path="clients" element={<Clients go={go} />} />
              <Route path="catalog" element={<Catalog go={go} />} />
              <Route path="schedule" element={<Schedule go={go} />} />
              <Route path="money" element={<Money go={go} />} />
              <Route path="grow" element={<Grow go={go} />} />
              <Route path="settings" element={<SettingsSection go={go} />} />
              <Route path="*" element={<Navigate to={BASE} replace />} />
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

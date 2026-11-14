import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Gift, Sparkles, X, Headset, ArrowRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import useIsMobile from '../../hooks/useIsMobile';
import useSupportUnread from '../../hooks/useSupportUnread';
import useFeatureFlags from '../../hooks/useFeatureFlags';
import { normalizePlan } from '../../utils/themeUtils';
import { cn } from '../dashboard/ui/cn';

/* ------------------------------------------------------------------ *
 *  Design tokens — single source of truth. No magic numbers inline.
 * ------------------------------------------------------------------ */
const SB = {
  rail: 56,        // icon rail width (px)
  panel: 220,      // item panel width (px)
  radius: 3,       // row corner radius (px)
  railIcon: 20,    // rail glyph size
  itemIcon: 17,    // panel item icon size
};
// Nav glyphs are pre-coloured PNGs (one file per state) exported from
// design-system/icons/dashboard/*.svg by its export-png.js. A PNG can't recolour,
// so hover only tints the row background. Recolour = edit the SVG + re-export.
export const ICON_DIR = '/icons/dashboard';

// Accent per section — all deliberately non-rose so the rose badge never clashes.
// Must match the active-state colours baked into the PNGs.
export const ACCENT = {
  overview: '#4f46e5', // indigo
  bookings: '#059669', // emerald
  catalog:  '#7c3aed', // violet
  earnings: '#d97706', // amber
  chat:     '#0284c7', // sky
  settings: '#475569', // slate
};
const ROSE = '#e11d48';

/* ------------------------------------------------------------------ *
 *  Nav config — sections → items. Adding a page = one entry here.
 *  Routes are the real host dashboard routes (unchanged).
 *
 *  icon         → PNG basename in ICON_DIR; files are <icon>-<state>@2x/@3x.png.
 *  item.locked  → plan slug(s) that unlock it; others see a lock (upsell kept).
 *                 A lockable item needs a <icon>-locked PNG too.
 *  item.visible → hard permission gate; false = hidden entirely.
 *  item.badgeKey→ key into the runtime `badges` map (attention count).
 * ------------------------------------------------------------------ */
export const NAV = [
  {
    id: 'overview', label: 'Overview', icon: 'rail-overview',
    items: [
      { to: '/dashboard', label: 'Overview', icon: 'nav-overview', exact: true },
    ],
  },
  {
    id: 'bookings', label: 'Bookings', icon: 'rail-bookings',
    items: [
      { to: '/dashboard/bookings', label: 'Bookings', icon: 'nav-bookings' },
      { to: '/dashboard/clients', label: 'Customers', icon: 'nav-customers', matchPrefix: '/dashboard/clients' },
      { to: '/dashboard/payments/transactions', label: 'Transactions', icon: 'nav-transactions', matchPrefix: '/dashboard/payments/transactions' },
      { to: '/dashboard/availability', label: 'Availability', icon: 'nav-availability' },
    ],
  },
  {
    id: 'catalog', label: 'Catalog', icon: 'rail-catalog',
    items: [
      { to: '/dashboard/services', label: 'Services', icon: 'nav-services', matchPrefix: '/dashboard/service' },
      { to: '/dashboard/products', label: 'Products', icon: 'nav-products' },
      // Reuse nav-profile glyph — no testimonial icon is exported yet (closest fit).
      { to: '/dashboard/testimonials', label: 'Testimonials', icon: 'nav-profile' },
      // Coupons (v3.204) — hidden until the `coupons` flag is on. Reuses the
      // refer glyph (promo/reward) as no discount icon is exported yet.
      { to: '/dashboard/coupons', label: 'Coupons', icon: 'nav-refer', visible: (c) => !!c.flags?.coupons },
    ],
  },
  {
    id: 'earnings', label: 'Earnings', icon: 'rail-earnings',
    items: [
      { to: '/dashboard/earnings', label: 'Earnings', icon: 'nav-earnings' },
      // KYC gates payouts, so a pending verification surfaces its attention here.
      { to: '/dashboard/payments/payouts', label: 'Payouts', icon: 'nav-payouts', matchPrefix: '/dashboard/payments/payouts', badgeKey: 'verification', badgeNoun: 'verify to get paid' },
      { to: '/dashboard/invoices', label: 'Invoices', icon: 'nav-invoices', matchPrefix: '/dashboard/invoices' },
      { to: '/dashboard/referrals', label: 'Refer & Earn', icon: 'nav-refer' },
    ],
  },
  {
    id: 'chat', label: 'Chat', icon: 'rail-chat',
    items: [
      { to: '/dashboard/chat', label: 'Chat', icon: 'nav-chat', badgeKey: 'chatUnread', badgeNoun: 'new reply' },
    ],
  },
  {
    id: 'settings', label: 'Settings', icon: 'rail-settings',
    items: [
      { to: '/dashboard/profile', label: 'Profile', icon: 'nav-profile', matchPrefix: '/dashboard/profile' },
      { to: '/dashboard/upgrade', label: 'Plan', icon: 'nav-plan' },
    ],
  },
];

/* ------------------------------------------------------------------ *
 *  Pure helpers
 * ------------------------------------------------------------------ */
const prefixesOf = (item) =>
  item.matchPrefix ? (Array.isArray(item.matchPrefix) ? item.matchPrefix : [item.matchPrefix]) : [item.to];

export const isLocked = (item, plan) => {
  if (!item.locked) return false;
  const allowed = Array.isArray(item.locked) ? item.locked : [item.locked];
  return !allowed.includes(plan);
};

// item shows unless a hard `visible` predicate says otherwise. Plan-locked items
// still show (with a lock) — that's the host upsell, not a hide.
const isVisible = (item, ctx) => (typeof item.visible === 'function' ? item.visible(ctx) : true);

export const visibleSections = (ctx) =>
  NAV
    .map((s) => ({ ...s, items: s.items.filter((i) => isVisible(i, ctx)) }))
    .filter((s) => s.items.length > 0);

// Where a rail click lands: the section's first page the host can actually open
// (skip locked items), falling back to the first item.
export const firstItemTo = (section, plan) =>
  (section.items.find((i) => !isLocked(i, plan)) || section.items[0])?.to;

// Active item by route: exact match for the dashboard root, else longest-prefix
// so deep pages (e.g. /dashboard/services/42/edit) still light their parent item.
export const resolveActive = (pathname, sections) => {
  const flat = sections.flatMap((s) => s.items.map((i) => ({ ...i, sectionId: s.id })));
  const root = flat.find((i) => i.exact);
  if (root && pathname === root.to) return { sectionId: root.sectionId, to: root.to };

  let best = null;
  let bestLen = -1;
  for (const item of flat) {
    if (item.exact) continue; // root only matches exactly, handled above
    for (const p of prefixesOf(item)) {
      if ((pathname === p || pathname.startsWith(p)) && p.length > bestLen) {
        best = item;
        bestLen = p.length;
      }
    }
  }
  return best
    ? { sectionId: best.sectionId, to: best.to }
    : { sectionId: sections[0]?.id, to: null };
};

const capCount = (n) => (n > 99 ? '99+' : String(n));

/* ------------------------------------------------------------------ *
 *  Focus trap for the mobile drawer. Minimal: cycle Tab within `ref`,
 *  focus first control on open, restore focus to `trigger` on unmount.
 * ------------------------------------------------------------------ */
const useFocusTrap = (ref, active, trigger) => {
  useEffect(() => {
    if (!active) return undefined;
    const root = ref.current;
    if (!root) return undefined;
    const sel = 'a[href],button:not([disabled]),[tabindex]:not([tabindex="-1"])';
    const first = root.querySelector(sel);
    first?.focus();

    const onKey = (e) => {
      if (e.key !== 'Tab') return;
      const nodes = Array.from(root.querySelectorAll(sel)).filter((n) => n.offsetParent !== null);
      if (nodes.length === 0) return;
      const firstN = nodes[0];
      const lastN = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === firstN) { e.preventDefault(); lastN.focus(); }
      else if (!e.shiftKey && document.activeElement === lastN) { e.preventDefault(); firstN.focus(); }
    };
    root.addEventListener('keydown', onKey);
    return () => {
      root.removeEventListener('keydown', onKey);
      trigger?.current?.focus?.();
    };
  }, [ref, active, trigger]);
};

/* ------------------------------------------------------------------ *
 *  Sub-components
 * ------------------------------------------------------------------ */
const focusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-primary';

// Decorative nav glyph — the row/button carries the accessible name. @2x is the
// src so 1x screens downsample (sharper than a 1x file).
const NavIcon = ({ name, state, size }) => (
  <img
    src={`${ICON_DIR}/${name}-${state}@2x.png`}
    srcSet={`${ICON_DIR}/${name}-${state}@2x.png 2x, ${ICON_DIR}/${name}-${state}@3x.png 3x`}
    width={size}
    height={size}
    alt=""
    aria-hidden="true"
    draggable={false}
    className="shrink-0 select-none"
  />
);

// Rose attention pill on an item row. Count exposed to SR via the row's aria-label,
// so the pill itself is decorative.
const BadgePill = ({ count }) => (
  <span
    aria-hidden="true"
    className="ml-auto grid min-h-[16px] min-w-[16px] place-items-center rounded-full px-1 text-[10px] font-bold leading-none text-white"
    style={{ backgroundColor: ROSE }}
  >
    {capCount(count)}
  </span>
);

/** Far-left rail: one glyph per section. Click navigates to that section. */
const RailButton = ({ section, active, hasAttention, onSelect }) => {
  const accent = ACCENT[section.id];
  return (
    <div className="group relative flex justify-center">
      <button
        type="button"
        onClick={() => onSelect(section.id)}
        aria-current={active ? 'true' : undefined}
        aria-label={hasAttention ? `${section.label}, has attention` : section.label}
        style={{
          borderRadius: SB.radius,
          color: active ? accent : undefined,
          background: active ? `color-mix(in srgb, ${accent} 14%, transparent)` : undefined,
        }}
        className={cn(
          'relative grid h-10 w-10 place-items-center transition-colors',
          focusRing,
          active ? '' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800',
        )}
      >
        {/* active-section accent bar — full-height on the rail's left edge */}
        {active && (
          <span
            aria-hidden="true"
            className="absolute left-[-8px] top-1/2 h-7 w-[3px] -translate-y-1/2 rounded-full"
            style={{ backgroundColor: accent }}
          />
        )}
        <NavIcon name={section.icon} state={active ? 'active' : 'inactive'} size={SB.railIcon} />
        {/* attention dot */}
        {hasAttention && (
          <span
            aria-hidden="true"
            className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full ring-2 ring-gray-50"
            style={{ backgroundColor: ROSE }}
          />
        )}
      </button>
      {/* Tooltip — hover AND keyboard focus (group-focus-within). */}
      <span
        role="tooltip"
        className="pointer-events-none absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 whitespace-nowrap rounded-md bg-gray-900 px-2 py-1 text-xs font-medium text-white opacity-0 shadow-md transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
      >
        {section.label}
      </span>
    </div>
  );
};

/** Panel row: a real navigable item. Selection reads louder than the section. */
const PanelItem = ({ item, sectionId, active, locked, count, onNavigate }) => {
  const accent = ACCENT[sectionId];
  const noun = item.badgeNoun || 'pending';
  const srLabel = count
    ? `${item.label}, ${count} ${noun}`
    : locked
    ? `${item.label} (locked)`
    : undefined;

  return (
    <Link
      to={locked ? '#' : item.to}
      onClick={locked ? (e) => e.preventDefault() : onNavigate}
      aria-current={active ? 'page' : undefined}
      aria-disabled={locked || undefined}
      tabIndex={locked ? -1 : undefined}
      aria-label={srLabel}
      title={locked ? `${item.label} (locked)` : undefined}
      style={{ borderRadius: SB.radius }}
      className={cn(
        'relative mx-1.5 flex items-center gap-2.5 px-2.5 py-2 text-[13px] font-medium transition-colors',
        focusRing,
        active
          ? 'bg-gray-100 text-gray-900'
          : locked
          ? 'cursor-default text-gray-300'
          : 'text-gray-600 hover:bg-gray-100/70 hover:text-gray-900',
      )}
    >
      {active && (
        <span aria-hidden="true" className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full" style={{ backgroundColor: accent }} />
      )}
      <NavIcon name={item.icon} state={locked ? 'locked' : active ? 'active' : 'inactive'} size={SB.itemIcon} />
      <span className="flex-1 truncate">{item.label}</span>
      {locked && <span aria-hidden="true" className="text-[10px] font-semibold uppercase tracking-wide text-gray-300">Locked</span>}
      {count > 0 && <BadgePill count={count} />}
    </Link>
  );
};

/**
 * The reusable rail + panel unit. Rendered statically on desktop AND inside the
 * mobile drawer, so behavior is identical across both paths.
 */
const RailAndPanel = ({ sections, plan, badges, activeSectionId, activeTo, onSelectSection, onNavigate }) => {
  // Panel always shows the active (route) section — no separate "selected" state,
  // so the rail highlight and the panel contents can never disagree.
  const selected = sections.find((s) => s.id === activeSectionId) || sections[0];
  const sectionAttention = (s) => s.items.some((i) => (i.badgeKey ? badges[i.badgeKey] || 0 : 0) > 0);

  return (
    <div className="flex h-full min-h-0">
      {/* Rail */}
      <nav
        aria-label="Sections"
        className="dash-noscrollbar flex flex-col items-center gap-1 overflow-y-auto border-r border-gray-200 bg-gray-50 py-3"
        style={{ width: SB.rail }}
      >
        {sections.map((s) => (
          <RailButton
            key={s.id}
            section={s}
            active={s.id === activeSectionId}
            hasAttention={sectionAttention(s)}
            onSelect={onSelectSection}
          />
        ))}
      </nav>

      {/* Item panel — scrollable items, plus a docked tier-aware slot at the base. */}
      <nav
        aria-label={selected ? `${selected.label} pages` : 'Pages'}
        className="flex min-h-0 flex-col overflow-hidden bg-white"
        style={{ width: SB.panel }}
      >
        <div className="dash-noscrollbar flex-1 overflow-y-auto py-3">
          <div className="space-y-0.5">
            {selected?.items.map((item) => (
              <PanelItem
                key={item.to}
                item={item}
                sectionId={selected.id}
                active={item.to === activeTo}
                locked={isLocked(item, plan)}
                count={item.badgeKey ? badges[item.badgeKey] || 0 : 0}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        </div>
        <div className="shrink-0 border-t border-gray-100 p-2.5">
          <PanelSlot plan={plan} onNavigate={onNavigate} />
        </div>
      </nav>
    </div>
  );
};

/* ------------------------------------------------------------------ *
 *  Runtime attention counts. Wired to the one real host signal today:
 *  a pending/unverified KYC. Add more keys here as queue counts appear.
 * ------------------------------------------------------------------ */
export const computeBadges = (user) => {
  const kyc = (user?.kyc_status || '').toLowerCase();
  const needsVerification = kyc && !['approved', 'verified'].includes(kyc);
  return { verification: needsVerification ? 1 : 0 };
};

/* ------------------------------------------------------------------ *
 *  Bottom slot — one docked card, tier-aware. The upgrade pitch shows
 *  only to hosts who can actually upgrade (Starter -> Pro); anyone
 *  already on a paid row gets Refer & Earn (no dead-end upsell) and Supreme
 *  gets a concierge line. Keyed by canonical plan slug. Never advertise Supreme.
 * ------------------------------------------------------------------ */
const SLOTS = {
  free:         { variant: 'upgrade',   to: '/dashboard/upgrade',   icon: Sparkles, cta: 'Go Premium',           title: 'Go Pro',              sub: '0% commission, the Clients CRM and follow-ups — under ₹4 a day.' },
  premium:      { variant: 'refer',     to: '/dashboard/referrals', icon: Gift,     cta: 'Invite a host',        title: 'Refer & Earn',        sub: 'Invite a host — you both get paid when they go live.' },
  // Archived paid rows already hold Pro entitlements — no upsell.
  creator:      { variant: 'refer',     to: '/dashboard/referrals', icon: Gift,     cta: 'Invite a host',        title: 'Refer & Earn',        sub: 'Invite a host — you both get paid when they go live.' },
  professional: { variant: 'refer',     to: '/dashboard/referrals', icon: Gift,     cta: 'Invite a host',        title: 'Refer & Earn',        sub: 'Invite a host — you both get paid when they go live.' },
  supreme:      { variant: 'concierge', href: '/bolt958',           icon: Headset,  cta: 'Talk to your manager', title: 'Priority concierge',  sub: 'Your account manager is one message away.' },
};

// Reuses the app's plan-badge hues (amber = Pro, primary = brand, violet = Supreme).
const SLOT_STYLE = {
  upgrade:   { card: 'border-amber-200 bg-amber-50',    title: 'text-amber-700',  cta: 'bg-amber-600 hover:bg-amber-700' },
  refer:     { card: 'border-primary/30 bg-primary/10', title: 'text-primary',    cta: 'bg-primary hover:bg-primary-dark' },
  concierge: { card: 'border-violet-200 bg-violet-50',  title: 'text-violet-700', cta: 'bg-violet-600 hover:bg-violet-700' },
};

const PanelSlot = ({ plan, onNavigate }) => {
  const s = SLOTS[plan] || SLOTS.free;
  const st = SLOT_STYLE[s.variant];
  const Icon = s.icon;
  const inner = (
    <>
      <span className={cn('flex items-center gap-1.5 font-heading text-[13px] font-bold', st.title)}>
        <Icon className="h-[15px] w-[15px] shrink-0" strokeWidth={2} />
        <span className="truncate">{s.title}</span>
      </span>
      <span className="mt-1 block text-[11.5px] leading-snug text-gray-500">{s.sub}</span>
      <span className={cn('mt-2.5 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold text-white transition-colors', st.cta)}>
        {s.cta}
        <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.4} />
      </span>
    </>
  );
  const cardCls = cn('block rounded-xl border p-3', focusRing, st.card);
  const label = `${s.title}. ${s.cta}`;
  return s.href ? (
    <a href={s.href} target="_blank" rel="noreferrer" onClick={onNavigate} className={cardCls} aria-label={label}>{inner}</a>
  ) : (
    <Link to={s.to} onClick={onNavigate} className={cardCls} aria-label={label}>{inner}</Link>
  );
};

// Brand + active-section title, spanning rail + panel under one bottom border.
// The logo cell shares the rail's ground (bg-gray-50) so there's no two-tone seam.
const SidebarTopBar = ({ label, withLogoLink, trailing }) => {
  const logo = <img src="/brand/meeticulous-icon.svg" alt="Meeticulous" className="h-8 w-8 object-contain" />;
  return (
    <div className="flex h-14 shrink-0 items-stretch border-b border-gray-200">
      {withLogoLink ? (
        <Link to="/dashboard" title="Meeticulous" aria-label="Meeticulous" className={cn('grid shrink-0 place-items-center border-r border-gray-200 bg-gray-50', focusRing)} style={{ width: SB.rail }}>
          {logo}
        </Link>
      ) : (
        <div className="grid shrink-0 place-items-center border-r border-gray-200 bg-gray-50" style={{ width: SB.rail }}>
          {logo}
        </div>
      )}
      <div className="flex flex-1 items-center truncate px-4 font-heading text-sm font-bold text-gray-900">{label}</div>
      {trailing}
    </div>
  );
};

/* ------------------------------------------------------------------ *
 *  Public component
 * ------------------------------------------------------------------ */
const ConsoleSidebar = ({ open = false, onClose, triggerRef }) => {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile('(max-width: 1023px)'); // below Tailwind `lg`
  const drawerRef = useRef(null);

  const plan = normalizePlan(user?.plan);
  const { flags } = useFeatureFlags();
  const ctx = { user, plan, flags };
  const sections = visibleSections(ctx);
  const chatUnread = useSupportUnread();
  const badges = { ...computeBadges(user), chatUnread };
  const active = resolveActive(pathname, sections);

  // Esc closes the drawer; focus trap + restore handled by the hook.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  useFocusTrap(drawerRef, open && isMobile, triggerRef);

  const activeSection = sections.find((s) => s.id === active.sectionId) || sections[0];
  const activeSectionLabel = activeSection?.label || '';

  // A rail click navigates to that section's first page (so the highlighted rail
  // and the panel always agree). `afterNav` closes the drawer on the mobile path.
  const selectSection = (afterNav) => (sid) => {
    const to = firstItemTo(sections.find((s) => s.id === sid) || {}, plan);
    if (to) navigate(to);
    afterNav?.();
  };

  const shared = {
    sections, plan, badges,
    activeSectionId: active.sectionId,
    activeTo: active.to,
  };

  return (
    <>
      {/* Desktop: fixed rail + panel, full-height. */}
      <aside className="hidden bg-white lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 lg:flex lg:flex-col">
        <SidebarTopBar label={activeSectionLabel} withLogoLink />
        <div className="min-h-0 flex-1">
          <RailAndPanel {...shared} onSelectSection={selectSection()} onNavigate={undefined} />
        </div>
      </aside>

      {/* Mobile: slide-in drawer holding the same rail + panel. */}
      {isMobile && createPortal(
        open ? (
          <div className="lg:hidden">
            <div className="fixed inset-0 z-[60] bg-black/40" onClick={onClose} aria-hidden="true" />
            <div
              ref={drawerRef}
              role="dialog"
              aria-modal="true"
              aria-label="Navigation"
              className="fixed inset-y-0 left-0 z-[60] flex w-[calc(56px+220px)] max-w-[85vw] flex-col bg-white shadow-[0_12px_32px_-8px_rgba(16,24,40,0.35)]"
            >
              <SidebarTopBar
                label={activeSectionLabel}
                trailing={(
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close navigation"
                    className={cn('grid w-12 shrink-0 place-items-center text-gray-400 hover:bg-gray-100 hover:text-gray-600', focusRing)}
                  >
                    <X className="h-5 w-5" />
                  </button>
                )}
              />
              <div className="min-h-0 flex-1">
                <RailAndPanel {...shared} onSelectSection={selectSection(onClose)} onNavigate={onClose} />
              </div>
            </div>
          </div>
        ) : null,
        document.body,
      )}
    </>
  );
};

export default ConsoleSidebar;

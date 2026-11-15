import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Gift, Sparkles, X, Headset, ArrowRight, ChevronRight, ChevronLeft, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import useIsMobile from '../../hooks/useIsMobile';
import useSupportUnread from '../../hooks/useSupportUnread';
import useFeatureFlags from '../../hooks/useFeatureFlags';
import { normalizePlan } from '../../utils/themeUtils';
import { cn } from '../dashboard/ui/cn';

/* ------------------------------------------------------------------ *
 *  Host console nav — ONE column, push/pop (mirrors the admin
 *  StackSidebar). The root lists sections; a multi-page section pushes
 *  its item list in place with a `‹ back`; a single-page section (Home)
 *  navigates straight. Open depth follows the URL so deep links, refresh
 *  and Back all land right. Loop & Slot brand: single maroon accent,
 *  rounded rows, cream/blush grounds. (Replaces the old 56+220 two-column
 *  rail+panel.)
 * ------------------------------------------------------------------ */
const SB = {
  width: 272,     // single-column width (px)
  icon: 17,       // glyph size in the row chip
};

// Nav glyphs are the existing pre-coloured PNGs. The `-active` files bake the OLD
// per-section accent hues, which clash with the maroon active row, so we NEVER use
// them: always load `-inactive` (neutral) and force it white via a filter when the
// row is active. Recolour/replace = edit the SVG + re-export the `-inactive` PNG.
export const ICON_DIR = '/icons/dashboard';

/* ------------------------------------------------------------------ *
 *  Nav config — sections → items. Adding a page = one entry here.
 *  Routes are the real host dashboard routes (unchanged URLs).
 *
 *  icon         → PNG basename in ICON_DIR; the file is <icon>-inactive@2x/@3x.png.
 *  item.locked  → plan slug(s) that unlock it; others see a lock (upsell).
 *  item.visible → hard gate; false = hidden entirely.
 *  item.badgeKey→ key into the runtime `badges` map (attention count).
 * ------------------------------------------------------------------ */
export const NAV = [
  {
    id: 'home', label: 'Home', icon: 'rail-overview',
    items: [
      { to: '/dashboard', label: 'Overview', icon: 'nav-overview', exact: true },
    ],
  },
  {
    id: 'bookings', label: 'Bookings', icon: 'rail-bookings',
    items: [
      { to: '/dashboard/bookings', label: 'Bookings', icon: 'nav-bookings' },
      { to: '/dashboard/availability', label: 'Availability', icon: 'nav-availability' },
      { to: '/dashboard/clients', label: 'Customers', icon: 'nav-customers', matchPrefix: '/dashboard/clients' },
    ],
  },
  {
    // Guest↔Host messaging (coming soon). Reserved slot — hidden until the
    // `guest_messaging` flag + route land, then it lights up on rail + tab bar.
    id: 'messages', label: 'Messages', icon: 'rail-chat',
    items: [
      { to: '/dashboard/messages', label: 'Guest chats', icon: 'nav-chat', badgeKey: 'guestUnread', badgeNoun: 'new message' },
    ],
    visible: (c) => !!c.flags?.guest_messaging,
  },
  {
    id: 'catalog', label: 'Catalog', icon: 'rail-catalog',
    items: [
      { to: '/dashboard/services', label: 'Services', icon: 'nav-services', matchPrefix: '/dashboard/service' },
      { to: '/dashboard/products', label: 'Products', icon: 'nav-products' },
      // Reuse nav-products glyph — no course icon exported (closest fit).
      { to: '/dashboard/courses', label: 'Courses', icon: 'nav-products', visible: (c) => !!c.flags?.course_purchase },
      // Reuse nav-profile glyph — no testimonial icon exported.
      { to: '/dashboard/testimonials', label: 'Testimonials', icon: 'nav-profile' },
      // Reuse nav-refer glyph (promo/reward) — no discount icon exported.
      { to: '/dashboard/coupons', label: 'Coupons', icon: 'nav-refer', visible: (c) => !!c.flags?.coupons },
    ],
  },
  {
    // All money in ONE place (Transactions moved here from Bookings).
    id: 'money', label: 'Money', icon: 'rail-earnings',
    items: [
      { to: '/dashboard/earnings', label: 'Earnings', icon: 'nav-earnings' },
      // KYC gates payouts, so a pending verification surfaces its attention here.
      { to: '/dashboard/payments/payouts', label: 'Payouts', icon: 'nav-payouts', matchPrefix: '/dashboard/payments/payouts', badgeKey: 'verification', badgeNoun: 'verify to get paid' },
      { to: '/dashboard/invoices', label: 'Invoices', icon: 'nav-invoices', matchPrefix: '/dashboard/invoices' },
      { to: '/dashboard/payments/transactions', label: 'Transactions', icon: 'nav-transactions', matchPrefix: '/dashboard/payments/transactions' },
    ],
  },
  {
    // Account home in the rail (founder spec: all options visible, not hidden
    // in the avatar menu). Help lives here too so the support-reply unread has
    // a home (the old "Chat" section, now AI support).
    id: 'settings', label: 'Settings', icon: 'rail-settings',
    items: [
      { to: '/dashboard/profile', label: 'Account', icon: 'nav-profile', matchPrefix: '/dashboard/profile' },
      { to: '/dashboard/upgrade', label: 'Plan & billing', icon: 'nav-plan' },
      { to: '/dashboard/kyc', label: 'Verification', icon: 'nav-payouts', matchPrefix: '/dashboard/kyc', badgeKey: 'verification', badgeNoun: 'pending' },
      { to: '/dashboard/referrals', label: 'Refer & Earn', icon: 'nav-refer' },
      { to: '/dashboard/chat', label: 'Help & support', icon: 'nav-chat', matchPrefix: '/dashboard/chat', badgeKey: 'chatUnread', badgeNoun: 'new reply' },
    ],
  },
];

const ROSE = '#E0506F';

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

const isVisible = (item, ctx) => (typeof item.visible === 'function' ? item.visible(ctx) : true);

export const visibleSections = (ctx) =>
  NAV
    .map((s) => ({ ...s, items: s.items.filter((i) => isVisible(i, ctx)) }))
    .filter((s) => s.items.length > 0 && isVisible(s, ctx));

// A single-item section navigates straight (no push). Multi-item sections push.
export const isLeafSection = (section) => (section?.items?.length || 0) <= 1;

// Where a rail/tab click lands: the section's first openable page (skip locked).
export const firstItemTo = (section, plan) =>
  (section?.items?.find((i) => !isLocked(i, plan)) || section?.items?.[0])?.to;

// Active item by route: exact match for the dashboard root, else longest-prefix
// so deep pages (e.g. /dashboard/services/42/edit) still light their parent item.
export const resolveActive = (pathname, sections) => {
  const flat = sections.flatMap((s) => s.items.map((i) => ({ ...i, sectionId: s.id })));
  const root = flat.find((i) => i.exact);
  if (root && pathname === root.to) return { sectionId: root.sectionId, to: root.to };

  let best = null;
  let bestLen = -1;
  for (const item of flat) {
    if (item.exact) continue;
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
 *  Focus trap for the mobile drawer.
 * ------------------------------------------------------------------ */
const useFocusTrap = (ref, active, trigger) => {
  useEffect(() => {
    if (!active) return undefined;
    const root = ref.current;
    if (!root) return undefined;
    const sel = 'a[href],button:not([disabled]),[tabindex]:not([tabindex="-1"])';
    root.querySelector(sel)?.focus();

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
const focusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-rose';

// Slide animation for the panel swap (push = in, pop = back). One-shot, keyed.
const STACK_CSS = `
@keyframes sbIn { from { opacity:0; transform:translateX(12px) } to { opacity:1; transform:none } }
@keyframes sbBack { from { opacity:0; transform:translateX(-12px) } to { opacity:1; transform:none } }
.sb-in { animation: sbIn .2s cubic-bezier(.4,0,.2,1) }
.sb-back { animation: sbBack .2s cubic-bezier(.4,0,.2,1) }
@media (prefers-reduced-motion: reduce){ .sb-in,.sb-back{ animation:none } }
`;

// Decorative PNG glyph. Always the neutral `-inactive` file; forced white when the
// row is active (maroon ground). @2x src so 1x screens downsample sharply.
const NavIcon = ({ name, active, size }) => (
  <img
    src={`${ICON_DIR}/${name}-inactive@2x.png`}
    srcSet={`${ICON_DIR}/${name}-inactive@2x.png 2x, ${ICON_DIR}/${name}-inactive@3x.png 3x`}
    width={size}
    height={size}
    alt=""
    aria-hidden="true"
    draggable={false}
    className="shrink-0 select-none"
    style={active ? { filter: 'brightness(0) invert(1)' } : undefined}
  />
);

// Icon chip — rounded tile behind the glyph (blush on hover, white-tint on active).
const IconChip = ({ name, active }) => (
  <span
    className={cn(
      'grid h-[30px] w-[30px] shrink-0 place-items-center rounded-lg transition-colors',
      active ? 'bg-white/20' : 'bg-neutral-100 group-hover:bg-blush',
    )}
  >
    <NavIcon name={name} active={active} size={SB.icon} />
  </span>
);

const BadgePill = ({ count }) => (
  <span
    aria-hidden="true"
    className="ml-auto grid min-h-[18px] min-w-[18px] place-items-center rounded-full px-1.5 text-[10px] font-bold leading-none text-white"
    style={{ backgroundColor: ROSE }}
  >
    {capCount(count)}
  </span>
);

const rowCls = (active) =>
  cn(
    'group relative flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left text-[13.5px] font-medium transition-colors',
    focusRing,
    active ? 'bg-maroon text-white font-semibold' : 'text-neutral-600 hover:bg-maroon-100 hover:text-ink',
  );

/** Root row: a section. Multi-page → button that opens; single-page → Link. */
const SectionRow = ({ section, badges, plan, onOpen, onNavigate }) => {
  const attention = section.items.some((i) => (i.badgeKey ? badges[i.badgeKey] || 0 : 0) > 0);
  const inner = (
    <>
      <IconChip name={section.icon} active={false} />
      <span className="flex-1 truncate">{section.label}</span>
      {attention && <span aria-hidden="true" className="ml-auto h-2 w-2 rounded-full" style={{ backgroundColor: ROSE }} />}
      <ChevronRight className={cn('h-4 w-4 shrink-0 text-neutral-300', attention ? 'ml-1.5' : 'ml-auto')} strokeWidth={2.2} />
    </>
  );
  if (isLeafSection(section)) {
    const to = firstItemTo(section, plan);
    return (
      <Link to={to || '#'} onClick={onNavigate} aria-label={section.label} className={rowCls(false)}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" onClick={() => onOpen(section.id)} aria-label={section.label} className={rowCls(false)}>
      {inner}
    </button>
  );
};

/** Pushed panel row: a navigable leaf. */
const PanelItem = ({ item, active, locked, count, onNavigate }) => {
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
      className={cn(rowCls(active), locked && 'cursor-default text-neutral-300 hover:bg-transparent hover:text-neutral-300')}
    >
      <IconChip name={item.icon} active={active} />
      <span className="flex-1 truncate">{item.label}</span>
      {locked && <span aria-hidden="true" className="ml-auto text-[10px] font-semibold uppercase tracking-wide text-neutral-300">Locked</span>}
      {count > 0 && <BadgePill count={count} />}
    </Link>
  );
};

/** Loud KYC banner — shown atop the Settings panel while unverified. */
const KycBanner = ({ onNavigate }) => (
  <Link
    to="/dashboard/kyc"
    onClick={onNavigate}
    className={cn('mx-2 mb-2 block rounded-lg bg-maroon p-3 text-white', focusRing)}
    aria-label="Verify to get paid"
  >
    <span className="flex items-center gap-2 font-heading text-[13px] font-bold">
      <ShieldCheck className="h-[15px] w-[15px] shrink-0" strokeWidth={2.2} />
      Verify to get paid
    </span>
    <span className="mt-1 block text-[11.5px] leading-snug text-white/80">
      Finish verification to unlock payouts. Takes 2 minutes.
    </span>
    <span className="mt-2.5 flex items-center justify-center gap-1.5 rounded-full bg-marigold py-2 text-xs font-semibold text-ink">
      Start verification <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.4} />
    </span>
  </Link>
);

/**
 * The reusable single-column stack. Rendered statically on desktop AND inside the
 * mobile drawer, so behaviour is identical on both paths. `open depth` follows the
 * active route; Back pops to the root list.
 */
const StackNav = ({ sections, plan, badges, active, needsKyc, onNavigate }) => {
  const [openId, setOpenId] = useState(active.sectionId);
  const [dir, setDir] = useState('sb-in');
  // Snap the open depth to the active route on every navigation.
  useEffect(() => { setOpenId(active.sectionId); }, [active.sectionId, active.to]);

  const openSection = sections.find((s) => s.id === openId);
  const atRoot = !openSection || isLeafSection(openSection);

  const open = (id) => { setDir('sb-in'); setOpenId(id); };
  const back = () => { setDir('sb-back'); setOpenId(null); };

  return (
    <nav
      aria-label={atRoot ? 'Sections' : `${openSection.label} pages`}
      className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-cream dash-noscrollbar"
    >
      <style>{STACK_CSS}</style>
      {atRoot ? (
        <div key="root" className={cn('flex flex-col gap-1 px-2.5 py-3', dir)}>
          {sections.map((s) => (
            <SectionRow key={s.id} section={s} badges={badges} plan={plan} onOpen={open} onNavigate={onNavigate} />
          ))}
        </div>
      ) : (
        <div key={openSection.id} className={cn('flex flex-col py-2', dir)}>
          <div className="sticky top-0 z-[1] flex h-11 items-center gap-1 bg-cream px-1.5">
            <button
              type="button"
              onClick={back}
              aria-label="Back"
              className={cn('grid h-[30px] w-[30px] place-items-center rounded-lg text-neutral-600 transition-colors hover:bg-maroon-100', focusRing)}
            >
              <ChevronLeft className="h-[18px] w-[18px]" strokeWidth={2.2} />
            </button>
            <span className="truncate font-display text-[15px] font-bold tracking-[-0.02em] text-ink">{openSection.label}</span>
          </div>
          {openSection.id === 'settings' && needsKyc && <KycBanner onNavigate={onNavigate} />}
          <div className="flex flex-col gap-0.5 px-2.5 pb-3">
            {openSection.items.map((item) => (
              <PanelItem
                key={item.to}
                item={item}
                active={item.to === active.to}
                locked={isLocked(item, plan)}
                count={item.badgeKey ? badges[item.badgeKey] || 0 : 0}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        </div>
      )}
    </nav>
  );
};

/* ------------------------------------------------------------------ *
 *  Runtime attention counts.
 * ------------------------------------------------------------------ */
export const computeBadges = (user) => {
  const kyc = (user?.kyc_status || '').toLowerCase();
  const needsVerification = kyc && !['approved', 'verified'].includes(kyc);
  return { verification: needsVerification ? 1 : 0 };
};

export const needsKyc = (user) => computeBadges(user).verification > 0;

/* ------------------------------------------------------------------ *
 *  Bottom slot — one docked card, tier-aware.
 * ------------------------------------------------------------------ */
const SLOTS = {
  free:         { variant: 'upgrade',   to: '/dashboard/upgrade',   icon: Sparkles, cta: 'Go Premium',           title: 'Go Pro',              sub: '0% commission, the Clients CRM and follow-ups — under ₹4 a day.' },
  premium:      { variant: 'refer',     to: '/dashboard/referrals', icon: Gift,     cta: 'Invite a host',        title: 'Refer & Earn',        sub: 'Invite a host — you both get paid when they go live.' },
  creator:      { variant: 'refer',     to: '/dashboard/referrals', icon: Gift,     cta: 'Invite a host',        title: 'Refer & Earn',        sub: 'Invite a host — you both get paid when they go live.' },
  professional: { variant: 'refer',     to: '/dashboard/referrals', icon: Gift,     cta: 'Invite a host',        title: 'Refer & Earn',        sub: 'Invite a host — you both get paid when they go live.' },
  supreme:      { variant: 'concierge', href: '/bolt958',           icon: Headset,  cta: 'Talk to your manager', title: 'Priority concierge',  sub: 'Your account manager is one message away.' },
};

// Brand grounds only (no amber/violet): upgrade = marigold CTA on blush, refer =
// blush ground, concierge = maroon ground.
const SLOT_STYLE = {
  upgrade:   { card: 'border-maroon-100 bg-maroon-50',  title: 'text-maroon', cta: 'bg-marigold text-ink hover:brightness-95' },
  refer:     { card: 'border-maroon-100 bg-blush',      title: 'text-maroon', cta: 'bg-maroon text-white hover:bg-maroon-dark' },
  concierge: { card: 'border-maroon-dark bg-maroon',    title: 'text-white',  cta: 'bg-marigold text-ink hover:brightness-95' },
};

const PanelSlot = ({ plan, onNavigate }) => {
  const s = SLOTS[plan] || SLOTS.free;
  const st = SLOT_STYLE[s.variant];
  const Icon = s.icon;
  const onMaroon = s.variant === 'concierge';
  const inner = (
    <>
      <span className={cn('flex items-center gap-1.5 font-display text-[13px] font-bold', st.title)}>
        <Icon className="h-[15px] w-[15px] shrink-0" strokeWidth={2} />
        <span className="truncate">{s.title}</span>
      </span>
      <span className={cn('mt-1 block text-[11.5px] leading-snug', onMaroon ? 'text-white/80' : 'text-neutral-600')}>{s.sub}</span>
      <span className={cn('mt-2.5 flex items-center justify-center gap-1.5 rounded-full py-2 text-xs font-semibold transition', st.cta)}>
        {s.cta}
        <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.4} />
      </span>
    </>
  );
  const cardCls = cn('block rounded-xl border-2 p-3', focusRing, st.card);
  const label = `${s.title}. ${s.cta}`;
  return s.href ? (
    <a href={s.href} target="_blank" rel="noreferrer" onClick={onNavigate} className={cardCls} aria-label={label}>{inner}</a>
  ) : (
    <Link to={s.to} onClick={onNavigate} className={cardCls} aria-label={label}>{inner}</Link>
  );
};

// Brand top bar — logo links Home, active section as the title.
const SidebarTopBar = ({ label, withLogoLink, trailing }) => {
  const logo = <img src="/brand/meeticulous-icon.svg" alt="Meeticulous" className="h-8 w-8 object-contain" />;
  return (
    <div className="flex h-14 shrink-0 items-center gap-2.5 border-b-2 border-neutral-200 bg-cream px-4">
      {withLogoLink ? (
        <Link to="/dashboard" title="Meeticulous — Home" aria-label="Meeticulous — Home" className={cn('grid shrink-0 place-items-center rounded-xl', focusRing)}>
          {logo}
        </Link>
      ) : (
        <div className="grid shrink-0 place-items-center">{logo}</div>
      )}
      <span className="flex-1 truncate font-display text-[15px] font-bold tracking-[-0.02em] text-ink">{label}</span>
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
  const isMobile = useIsMobile('(max-width: 1023px)');
  const drawerRef = useRef(null);

  const plan = normalizePlan(user?.plan);
  const { flags } = useFeatureFlags();
  const ctx = { user, plan, flags };
  const sections = visibleSections(ctx);
  const chatUnread = useSupportUnread();
  const badges = { ...computeBadges(user), chatUnread };
  const active = resolveActive(pathname, sections);
  const kycPending = needsKyc(user);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  useFocusTrap(drawerRef, open && isMobile, triggerRef);

  const activeSection = sections.find((s) => s.id === active.sectionId) || sections[0];
  const activeSectionLabel = activeSection?.label || '';

  const stackProps = { sections, plan, badges, active, needsKyc: kycPending };
  const closeNav = onClose ? () => onClose() : undefined;

  const Body = ({ onNavigate }) => (
    <>
      <div className="min-h-0 flex-1">
        <StackNav {...stackProps} onNavigate={onNavigate} />
      </div>
      <div className="shrink-0 border-t-2 border-neutral-200 bg-cream p-2.5">
        <PanelSlot plan={plan} onNavigate={onNavigate} />
      </div>
    </>
  );

  return (
    <>
      {/* Desktop: fixed single column, full height. */}
      <aside
        className="hidden border-r-2 border-neutral-200 bg-cream lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 lg:flex lg:flex-col"
        style={{ width: SB.width }}
      >
        <SidebarTopBar label={activeSectionLabel} withLogoLink />
        <Body onNavigate={undefined} />
      </aside>

      {/* Mobile: slide-in drawer holding the same stack. */}
      {isMobile && createPortal(
        open ? (
          <div className="lg:hidden">
            <div className="fixed inset-0 z-[60] bg-ink/40" onClick={onClose} aria-hidden="true" />
            <div
              ref={drawerRef}
              role="dialog"
              aria-modal="true"
              aria-label="Navigation"
              className="fixed inset-y-0 left-0 z-[60] flex w-[280px] max-w-[85vw] flex-col bg-cream shadow-[0_12px_32px_-8px_rgba(43,10,20,0.35)]"
            >
              <SidebarTopBar
                label={activeSectionLabel}
                trailing={(
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close navigation"
                    className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-full text-neutral-500 hover:bg-maroon-100 hover:text-ink', focusRing)}
                  >
                    <X className="h-5 w-5" />
                  </button>
                )}
              />
              <Body onNavigate={closeNav} />
            </div>
          </div>
        ) : null,
        document.body,
      )}
    </>
  );
};

export default ConsoleSidebar;

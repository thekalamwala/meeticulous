import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import useAppearance from '../../hooks/useAppearance';
import useLiveNotifications from '../../hooks/useLiveNotifications';
// UseCasesMegaMenu (Explore) intentionally not rendered in the nav for now; the
// /explore route + page stay live. Re-import + render in PublicCenterNav to restore.
import { isHost, routeRole } from '../../utils/roleRoutes';
import { getNotifications, markAllNotificationsRead, markNotificationRead, getGuestBookings } from '../../services/api';
import { getPlanBorderLabel, normalizePlan } from '../../utils/themeUtils';
import {
  Tag,
  CalendarCheck, MessageCircle, Bookmark, BarChart2,
  Briefcase, Bell, X, Menu, ChevronDown, ChevronRight,
  Search, Settings, LogOut, TrendingUp,
  Clock, Wallet, LayoutDashboard, ExternalLink,
  Gift, Star, Info, Cpu, HeartPulse,
  Sparkles, Mail, Award, Layers, Headset,
  BookOpen,
  Users, Scale, Scissors, Heart, HelpCircle,
  // "Who it's for" profession-menu icons
  Calculator, Compass, Smile, Sun, Baby, Ear, Eye,
  Stethoscope, Activity, Apple, Flower2, Target, PawPrint,
} from 'lucide-react';

// ── Nav item configs (config-driven, no hardcoded HTML) ──────────────────────

// ── Mega-menu configs (Calendly/Cal.com-style: grouped columns, icon + subtext) ─
// Hardcoded (not derived from featureData) to keep the marketing data out of the
// site-wide nav bundle. Every href points at a route that renders — dead nav
// links are soft-404s, and the mega-nav is now the site-wide crawl anchor (the
// footer went minimal), so these lists ARE the internal-linking surface.

// `tone` pins each tile's colour to that feature page's own accent (featureData
// accent → nearest TILE_MAP tone) so the mega-menu matches the page it opens.
const PRODUCT_MENU = [
  { header: 'Products', items: [
    { label: 'Online scheduling', href: '/features/online-scheduling', desc: 'Clients pick a time — no back-and-forth',   icon: CalendarCheck,    tone: 'blue' },
    { label: 'Booking pages',     href: '/features/booking-pages',     desc: 'A clean public page for every service',     icon: LayoutDashboard,  tone: 'orange' },
    { label: 'Payments',          href: '/features/payments',          desc: 'Get paid up front and kill no-shows',       icon: Wallet,           tone: 'emerald' },
    { label: 'Client management', href: '/features/client-management', desc: 'Clients, bookings and notes in one place',  icon: Users,            tone: 'orange' },
    { label: 'Digital products',  href: '/features/digital-products',  desc: 'Sell guides & templates, no live call',     icon: Layers,           tone: 'blue' },
  ] },
  { header: 'Platform', items: [
    { label: 'Google Calendar',   href: '/features/google-calendar',   desc: 'Busy times blocked, bookings added',         icon: CalendarCheck,    tone: 'pink' },
    { label: 'Notifications',     href: '/features/notifications',     desc: 'Automatic WhatsApp + email reminders',      icon: Bell,             tone: 'amber' },
    { label: 'Availability',      href: '/features/availability',      desc: 'Buffers, limits and hours that fit you',    icon: Clock,            tone: 'violet' },
    { label: 'Reviews & ratings', href: '/features/reviews',           desc: 'Collect reviews that win more bookings',    icon: Star,             tone: 'pink' },
    { label: 'Explore',           href: '/explore',                    desc: 'Get discovered in the marketplace',         icon: Search,           tone: 'teal' },
  ] },
];

// "Who it's for" — profession mega-menu, 3 columns. A link points at a real
// /for/<slug> ONLY when that page exists on this branch (professionLandingData
// or a bespoke route) — an unknown /for/<slug> hard-404s (ProfessionLanding).
// Every profession without its own page yet points at a filtered /explore?q=
// (a real, no-404 page; noindex, so interim only). When a /for/ page ships,
// swap that one href to /for/<slug> — see the `// →` note on each interim link.
// tone omitted on purpose: MegaMenu auto-rotates the tile colour by index.
const WHOFOR_MENU = [
  { header: 'Professional Services', items: [
    { label: 'Chartered Accountants & CA Firms', href: '/for/chartered-accountants', desc: 'Book paid consults instantly', icon: Calculator, tone: 'blue' },
    { label: 'Architects & Interior Designers',  href: '/for/architects',          desc: 'Win design clients faster',    icon: Compass, tone: 'amber' },
    { label: 'Astrologers & Vedic Consultants',  href: '/for/astrologers',         desc: 'Fill your reading calendar',   icon: Sparkles, tone: 'violet' },
    { label: 'Business & Management Consultants',href: '/for/business-consultant', desc: 'Book advisory calls that pay', icon: Briefcase, tone: 'amber' },
    { label: 'Lawyers & Legal Advisors',         href: '/for/lawyers',             desc: 'Book paid legal consults',     icon: Scale, tone: 'red' },
    { label: 'Beauticians & Salons',             href: '/for/salon',               desc: 'Fill your chair all week',     icon: Scissors, tone: 'fuchsia' },
  ] },
  { header: 'Medical Specialists', items: [
    { label: 'Dentists & Dental Clinics',       href: '/for/dentists',             desc: 'Cut no-shows, fill chairs',   icon: Smile, tone: 'sky' },
    { label: 'Dermatologists & Skin Clinics',   href: '/for/dermatologists',       desc: 'Book skin consults 24/7',     icon: Sun, tone: 'cyan' },
    { label: 'Gynecologists & OB-GYNs',         href: '/for/gynecologists',        desc: 'Book visits around the clock',icon: HeartPulse, tone: 'emerald' },
    { label: 'Pediatricians & Child Care',      href: '/for/pediatricians',        desc: 'Fill your clinic, skip calls',icon: Baby, tone: 'blue' },
    { label: 'ENT Specialists & Surgeons',      href: '/for/ent-specialists',      desc: 'Book consults, end phone tag',icon: Ear, tone: 'indigo' },
    { label: 'Ophthalmologists & Eye Clinics',  href: '/for/ophthalmologists',     desc: 'Book eye exams online',       icon: Eye, tone: 'sky' },
  ] },
  { header: 'Health & Wellness', items: [
    { label: 'General Physicians & Clinics',     href: '/for/doctors',              desc: 'Fill your clinic, cut no-shows', icon: Stethoscope, tone: 'blue' },
    { label: 'Physiotherapists & Rehab Centres', href: '/for/physiotherapists',     desc: 'Get paid before sessions',       icon: Activity, tone: 'teal' },
    { label: 'Nutritionists & Dietitians',       href: '/for/nutritionists',        desc: 'Book diet consults that pay',    icon: Apple, tone: 'emerald' },
    { label: 'Spas & Wellness Centres',          href: '/for/spa',                  desc: 'Fill slots, kill no-shows',      icon: Flower2, tone: 'teal' },
    { label: 'Life & Wellness Coaches',          href: '/for/life-coaches',         desc: 'Book paid coaching sessions',    icon: Target, tone: 'emerald' },
    { label: 'Veterinarians & Pet Clinics',      href: '/for/veterinarians',        desc: 'Book pet visits online',         icon: PawPrint, tone: 'teal' },
  ] },
];

const RESOURCES_MENU = [
  { header: 'Get started', items: [
    { label: 'How it works',        href: '/how-it-works',        desc: 'The 3-minute setup',  icon: Sparkles },
    { label: 'Earnings calculator', href: '/earnings-calculator', desc: 'See what you keep',    icon: TrendingUp },
    { label: 'Documentation',       href: '/help/docs',           desc: 'Guides & how-tos',    icon: BookOpen },
  ] },
  { header: 'Discover', items: [
    { label: 'Blog',         href: '/blog',         desc: 'Tips & playbooks',   icon: BookOpen },
    { label: 'Wall of Love', href: '/wall-of-love', desc: 'What hosts say',     icon: Heart },
    { label: 'About',        href: '/about',        desc: 'Our mission',        icon: Info },
    { label: 'Careers',      href: '/careers',      desc: 'Join the team',      icon: Award },
  ] },
  { header: 'Support', items: [
    { label: 'Help center', href: '/help',    desc: 'Articles & FAQs',   icon: HelpCircle },
    { label: 'FAQ',         href: '/#faq',    desc: 'Quick answers',     icon: MessageCircle },
    { label: 'Contact',     href: '/contact', desc: 'Talk to a human',   icon: Mail },
  ] },
];

// Compare — a mega-menu of "Sloth vs <competitor>" cards. Each carries the
// competitor's domain (favicon) and primary brand colour (hover tint). Only LPs
// that exist. `label` (mobile) kept alongside name/domain/color (desktop cards).
const COMPARE_MENU = [
  { label: 'vs Calendly',      name: 'Calendly',      href: '/compare/calendly-alternative',      domain: 'calendly.com',         color: '#006BFF' },
  { label: 'vs Acuity',        name: 'Acuity',        href: '/compare/acuity-alternative',        domain: 'acuityscheduling.com', color: '#1B7FA8' },
  { label: 'vs Setmore',       name: 'Setmore',       href: '/compare/setmore-alternative',       domain: 'setmore.com',          color: '#009DE0' },
  { label: 'vs SimplyBook',    name: 'SimplyBook',    href: '/compare/simplybook-alternative',    domain: 'simplybook.me',        color: '#2FA8C9' },
  { label: 'vs Zoho Bookings', name: 'Zoho Bookings', href: '/compare/zoho-bookings-alternative', domain: 'zoho.com',             color: '#E42527' },
  { label: 'vs Topmate',       name: 'Topmate',       href: '/compare/topmate-alternative',     domain: 'topmate.io',           color: '#FF3E5F' },
];

// Flat lists derived from the mega configs — reused by the mobile accordions.
const flat = (cols) => cols.flatMap((c) => c.items);

// Mobile drawer: the same menus as collapsible accordions (flat, no columns).
const MOBILE_SECTIONS = [
  { label: 'Product',      icon: Sparkles, items: flat(PRODUCT_MENU) },
  { label: "Who it's for", icon: Award,    items: flat(WHOFOR_MENU) },
  { label: 'Resources',    icon: Layers,   items: flat(RESOURCES_MENU) },
  { label: 'Compare',      icon: BarChart2, items: COMPARE_MENU },
];

// Slim guest profile menu (logged-in guests). The navbar carries nothing but the
// profile dropdown — these are the only two destinations a guest needs.
const GUEST_MENU = [
  { label: 'All Bookings', href: '/user/my-bookings', icon: CalendarCheck },
  { label: 'Review',       href: '/user/reviews',     icon: Star },
];

// Slim host profile menu (logged-in hosts). A single flat list — the dashboard
// sidebar/bottom-bar owns full navigation, so the navbar only carries the few
// high-frequency host shortcuts. `__profile__` resolves to the public username
// route; `external: true` opens in a new tab. Account Manager → Bolt's BAS page.
const VENDOR_MENU = [
  { label: 'Upcoming Bookings',     href: '/dashboard/bookings',     icon: CalendarCheck },
  { label: 'Availability',          href: '/dashboard/availability', icon: Clock },
  { label: 'View Public Profile',   href: '__profile__',             icon: ExternalLink, external: true },
  { label: 'Talk to Account Manager', href: '/bolt958',              icon: Headset,      external: true },
  { label: 'Settings',              href: '/dashboard/profile',      icon: Settings },
];

// ── Brand logo (admin-managed: icon_text | image | festive) ───────────────────
// Falls back to the text wordmark whenever the active mode's image is missing,
// so the header never renders empty even if the appearance API is unreachable.

const wordmarkText = (always = false) => (
  <span className={`${always ? '' : 'hidden sm:block '}text-[15px] font-bold text-ink tracking-tight`}>
    Meeticulous
  </span>
);

const NavbarLogo = ({ appearance }) => {
  const mode = appearance?.navbar_logo_mode || 'icon_text';
  const img = (src) => (
    <img src={src} alt="Meeticulous" className="h-7 w-auto block" />
  );

  if (mode === 'image'   && appearance?.logo_image_url)   return img(appearance.logo_image_url);
  if (mode === 'festive' && appearance?.festive_logo_url) return img(appearance.festive_logo_url);
  if (mode === 'icon_text' && appearance?.icon_url) {
    return (
      <>
        <img src={appearance.icon_url} alt="Meeticulous" width={26} height={26} decoding="async"
             className="h-[26px] w-[26px] rounded block" />
        {wordmarkText()}
      </>
    );
  }
  return wordmarkText(true); // fallback: text only, always visible
};

// ── Photo avatar (host) — real profile photo with initials fallback ──────────
// Literal size classes (never interpolated) so Tailwind's JIT emits them.
const PhotoAvatar = ({ user, className = 'h-11 w-11' }) =>
  user?.profile_image ? (
    <img
      src={user.profile_image}
      alt={user?.name || 'Profile'}
      className={`${className} rounded-full object-cover flex-shrink-0`}
    />
  ) : (
    <span
      className={`${className} inline-flex items-center justify-center rounded-full bg-primary text-white font-bold flex-shrink-0 select-none`}
      aria-hidden="true"
    >
      {user?.name ? user.name[0].toUpperCase() : 'U'}
    </span>
  );

// ── Sloth avatar (guest) — always the brand mark, never initials/photo ───────
// Guests have no profile image; the spec calls for the Sloth mark every time.
// Uses the admin-managed icon, falling back to the bundled favicon (also Sloth).
// The fallback is favicon-96x96.png, not favicon.svg — the SVG is a 126 KiB
// traced export, far heavier than the raster for a 44px avatar.
const SlothAvatar = ({ appearance, className = 'h-11 w-11' }) => (
  <img
    src={appearance?.icon_url || '/favicon-96x96.png'}
    alt="Meeticulous"
    className={`${className} rounded-full object-contain bg-primary/10 p-1 flex-shrink-0`}
  />
);

// ── Profile dropdown pieces (shared desktop + mobile) ────────────────────────
const VendorProfileHeader = ({ user }) => (
  <div className="flex items-center gap-3">
    <PhotoAvatar user={user} />
    <div className="min-w-0 flex-1">
      <p className="text-[14px] font-semibold text-ink truncate">{user?.name || 'Host'}</p>
      {user?.username && <p className="text-[12px] text-gray-400 truncate">@{user.username}</p>}
    </div>
  </div>
);

// Guest header: Sloth mark + "Hello," + the name from their most recent booking.
const GuestProfileHeader = ({ appearance, name }) => (
  <div className="flex items-center gap-3">
    <SlothAvatar appearance={appearance} />
    <div className="min-w-0 flex-1">
      <p className="text-[12px] text-gray-400 leading-tight">Hello,</p>
      <p className="text-[14px] font-semibold text-ink truncate">{name || 'there'}</p>
    </div>
  </div>
);

const MembershipButton = ({ user, onClick }) => (
  <Link
    to="/dashboard/upgrade"
    onClick={onClick}
    className="mt-3 flex items-center justify-center gap-1.5 rounded-lg bg-primary/10 px-3 py-2 text-[12.5px] font-semibold text-primary transition-colors hover:bg-primary/15 hover:no-underline"
  >
    <Sparkles size={14} className="flex-shrink-0" />
    You are a {getPlanBorderLabel(normalizePlan(user?.plan))} Member
  </Link>
);

// Flat profile-menu renderer (host VENDOR_MENU or guest GUEST_MENU). Handles the
// `__profile__` username token and `external` (new-tab) links.
const MenuLinks = ({ items, user, onNavigate }) =>
  items.map((item) => {
    const Icon = item.icon;
    const href = item.href === '__profile__'
      ? (user?.username ? `/${user.username}` : '/dashboard/profile')
      : item.href;
    const cls =
      'flex items-center gap-3 px-4 py-2.5 text-[13px] text-gray-600 hover:bg-primary/5 hover:text-primary transition-colors duration-150 hover:no-underline outline-none focus-visible:bg-primary/5 focus-visible:text-primary';
    return item.external ? (
      <a key={item.label} href={href} target="_blank" rel="noreferrer" role="menuitem" onClick={onNavigate} className={cls}>
        <Icon size={15} className="flex-shrink-0 text-gray-400" /> {item.label}
      </a>
    ) : (
      <Link key={item.label} to={href} role="menuitem" onClick={onNavigate} className={cls}>
        <Icon size={15} className="flex-shrink-0 text-gray-400" /> {item.label}
      </Link>
    );
  });

// ── Badge pill ────────────────────────────────────────────────────────────────

const BadgePill = ({ count }) =>
  count > 0 ? (
    <span className="absolute -top-1.5 -right-2 min-w-[15px] h-[15px] px-0.5 rounded-full bg-primary text-white text-[9px] font-bold flex items-center justify-center leading-none pointer-events-none">
      {count > 99 ? '99+' : count}
    </span>
  ) : null;

// ── Static label tag (e.g. "Soon") — distinct from numeric BadgePill ──────────
const TagPill = ({ text }) =>
  text ? (
    <span className="absolute -top-2 -right-5 px-1 py-px rounded-full bg-amber-400 text-ink text-[8px] font-bold uppercase tracking-wide leading-none pointer-events-none">
      {text}
    </span>
  ) : null;

// ── Header dropdown (controlled) ─────────────────────────────────────────────
// Open state is owned by the parent menu bar so only ONE menu is open at a time
// — switching between adjacent triggers is an instant handoff (no two panels
// overlapping mid-switch). The panel is always mounted and animated via classes
// so it fades/slides on BOTH enter and exit.
const NavDropdown = ({ id, label, icon: Icon, align = 'left', wide = false, activeKey, onOpen, onClose, children }) => {
  const open = activeKey === id;
  const centered = align === 'center';
  // Panel contents render ALWAYS (not lazy-mounted on first open) so every nav link
  // is in the server-rendered / prerendered HTML — crawlers and Google's first pass
  // follow them even though the panel is visually hidden (opacity-0) until opened.
  // (This was the fix for landing/compare pages that were only reachable via the
  // menu and so read as orphaned in the SEO audit.) The one thing that used to make
  // lazy-mount worthwhile — Compare's competitor favicons — stays deferred to `open`
  // inside CompareItem, so we still don't fetch those images on every page load.
  return (
    <div
      data-navmenu
      className="relative flex items-stretch"
      onMouseEnter={() => onOpen(id)}
      onMouseLeave={() => onClose(false)}
    >
      <button
        type="button"
        onClick={() => (open ? onClose(true) : onOpen(id))}
        aria-expanded={open}
        aria-haspopup="menu"
        className={[
          'group relative flex items-center gap-1 px-3.5 text-[12.5px] font-medium transition-colors outline-none',
          'focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary',
          open ? 'text-primary' : 'text-gray-500 hover:text-primary',
        ].join(' ')}
      >
        {Icon && <Icon size={16} className={open ? 'text-primary' : 'text-gray-400 group-hover:text-primary/80'} />}
        {label}
        <ChevronDown size={13} strokeWidth={2.5} className={`text-gray-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      <div
        role="menu"
        aria-hidden={!open}
        onClick={() => onClose(true)}
        className={[
          'origin-top rounded-xl border border-gray-200 bg-white shadow-[0_8px_32px_rgba(0,0,0,0.12)] z-50 overflow-hidden',
          // `wide` breaks out to span the whole bar (logo → CTA): fixed + centered
          // in the viewport at the container's own width (app-container = 72rem,
          // margin-auto), so its edges line up with the container. Otherwise the
          // panel auto-sizes and anchors under its trigger.
          wide
            ? 'fixed left-1/2 top-[3.75rem] -translate-x-1/2 w-[min(72rem,calc(100vw-2rem))]'
            : `absolute top-full mt-1.5 w-max max-w-[calc(100vw-2rem)] ${centered ? 'left-1/2 -translate-x-1/2' : 'left-0'}`,
          'transition duration-200 ease-out motion-reduce:transition-none',
          open ? 'translate-y-0 scale-100 opacity-100' : '-translate-y-1 scale-[0.98] opacity-0 pointer-events-none',
        ].join(' ')}
      >
        {children}
      </div>
    </div>
  );
};

// ── Mega-menu pieces (grouped columns, colored icon tile + label + subtext) ──
// Per-item colored tiles + a two-layer "curtain" that wipes in left→right on
// hover (and reverses out). Classes are literal (Tailwind JIT can't see
// interpolated names), keyed by a tone that cycles per column:
//   tile  — idle icon square (pastel bg + colored glyph)
//   solid — group-hover: solid square + white glyph
//   c1/c2 — the two curtain layers (front lighter, back deeper)
// Wide palette so hues keep changing down and across the menu (the tone index
// runs continuously across columns — see MegaMenu — instead of resetting).
const TILE_TONES = ['pink', 'blue', 'emerald', 'orange', 'violet', 'amber', 'teal', 'rose', 'sky', 'indigo', 'fuchsia', 'lime', 'cyan', 'red'];
const TILE_MAP = {
  pink:    { tile: 'bg-pink-100 text-pink-500',       solid: 'group-hover/mi:bg-pink-500 group-hover/mi:text-white',       c1: 'bg-pink-50',    c2: 'bg-pink-100' },
  blue:    { tile: 'bg-blue-100 text-blue-500',       solid: 'group-hover/mi:bg-blue-500 group-hover/mi:text-white',       c1: 'bg-blue-50',    c2: 'bg-blue-100' },
  emerald: { tile: 'bg-emerald-100 text-emerald-500', solid: 'group-hover/mi:bg-emerald-500 group-hover/mi:text-white',    c1: 'bg-emerald-50', c2: 'bg-emerald-100' },
  orange:  { tile: 'bg-orange-100 text-orange-500',   solid: 'group-hover/mi:bg-orange-500 group-hover/mi:text-white',     c1: 'bg-orange-50',  c2: 'bg-orange-100' },
  violet:  { tile: 'bg-violet-100 text-violet-500',   solid: 'group-hover/mi:bg-violet-500 group-hover/mi:text-white',     c1: 'bg-violet-50',  c2: 'bg-violet-100' },
  amber:   { tile: 'bg-amber-100 text-amber-500',     solid: 'group-hover/mi:bg-amber-500 group-hover/mi:text-white',      c1: 'bg-amber-50',   c2: 'bg-amber-100' },
  teal:    { tile: 'bg-teal-100 text-teal-500',       solid: 'group-hover/mi:bg-teal-500 group-hover/mi:text-white',       c1: 'bg-teal-50',    c2: 'bg-teal-100' },
  rose:    { tile: 'bg-rose-100 text-rose-500',       solid: 'group-hover/mi:bg-rose-500 group-hover/mi:text-white',       c1: 'bg-rose-50',    c2: 'bg-rose-100' },
  sky:     { tile: 'bg-sky-100 text-sky-500',         solid: 'group-hover/mi:bg-sky-500 group-hover/mi:text-white',        c1: 'bg-sky-50',     c2: 'bg-sky-100' },
  indigo:  { tile: 'bg-indigo-100 text-indigo-500',   solid: 'group-hover/mi:bg-indigo-500 group-hover/mi:text-white',     c1: 'bg-indigo-50',  c2: 'bg-indigo-100' },
  fuchsia: { tile: 'bg-fuchsia-100 text-fuchsia-500', solid: 'group-hover/mi:bg-fuchsia-500 group-hover/mi:text-white',    c1: 'bg-fuchsia-50', c2: 'bg-fuchsia-100' },
  lime:    { tile: 'bg-lime-100 text-lime-600',       solid: 'group-hover/mi:bg-lime-500 group-hover/mi:text-white',       c1: 'bg-lime-50',    c2: 'bg-lime-100' },
  cyan:    { tile: 'bg-cyan-100 text-cyan-500',       solid: 'group-hover/mi:bg-cyan-500 group-hover/mi:text-white',       c1: 'bg-cyan-50',    c2: 'bg-cyan-100' },
  red:     { tile: 'bg-red-100 text-red-500',         solid: 'group-hover/mi:bg-red-500 group-hover/mi:text-white',        c1: 'bg-red-50',     c2: 'bg-red-100' },
};

const MegaItem = ({ item, tone }) => {
  const Icon = item.icon;
  const c = TILE_MAP[tone] || TILE_MAP.orange;
  return (
    <Link
      to={item.href}
      role="menuitem"
      className="group/mi relative flex items-start gap-3 overflow-hidden rounded-xl px-3 py-2.5 hover:no-underline"
    >
      {/* Two-layer curtain: back layer trails, front leads — both slide in from
          the left on hover and slide back out on leave (transition reverses). */}
      <span aria-hidden="true" className={`pointer-events-none absolute inset-0 -translate-x-full transition-transform duration-500 ease-out group-hover/mi:translate-x-0 motion-reduce:transition-none ${c.c2}`} />
      <span aria-hidden="true" className={`pointer-events-none absolute inset-0 -translate-x-full transition-transform duration-300 ease-out group-hover/mi:translate-x-0 motion-reduce:transition-none ${c.c1}`} />

      {/* Content sits above the curtain */}
      <span className={`relative z-10 mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl transition-colors duration-200 ${c.tile} ${c.solid}`}>
        <Icon size={19} strokeWidth={2} />
      </span>
      <span className="relative z-10 min-w-0">
        <span className="block text-[14px] font-bold text-ink">{item.label}</span>
        {item.desc && <span className="block text-[12px] leading-snug text-gray-400">{item.desc}</span>}
      </span>
    </Link>
  );
};

// One consistent grid system for every mega-menu: fixed equal-width columns,
// same gap + padding everywhere; the panel auto-sizes to fit. The promo tile and
// the Compare cards use the same MENU_COL width so nothing feels off-rhythm.
const MENU_COL = 'w-60'; // 15rem — every column, promo tile and compare cell

// Renders grouped columns + an optional promo tile on the right. `colClass` lets
// a menu widen its columns (Product uses fewer, wider columns).
const MegaMenu = ({ sections, promo, colClass = MENU_COL }) => (
  <div className="flex gap-5 p-5">
    {sections.map((col, ci) => {
      // Tone index continues across columns so hues keep rotating (never resets).
      const offset = sections.slice(0, ci).reduce((n, s) => n + s.items.length, 0);
      return (
        <div key={col.header} className={colClass}>
          <p className="mb-2 px-3 text-[11px] font-normal uppercase tracking-wider text-gray-400">{col.header}</p>
          <div className="space-y-0.5">
            {col.items.map((it, i) => <MegaItem key={it.href} item={it} tone={it.tone || TILE_TONES[(offset + i) % TILE_TONES.length]} />)}
          </div>
        </div>
      );
    })}
    {promo && (
      <Link
        to={promo.href}
        className={`flex ${MENU_COL} flex-col justify-end rounded-xl bg-gradient-to-br from-primary to-primary-cta p-5 text-white transition-transform hover:scale-[1.01] hover:no-underline`}
      >
        <p className="text-[15px] font-bold leading-tight">{promo.title}</p>
        <p className="mt-1.5 text-[12.5px] leading-snug text-white/85">{promo.desc}</p>
        <span className="mt-4 inline-flex items-center gap-1 text-[13px] font-semibold">
          {promo.cta} <ChevronRight size={15} />
        </span>
      </Link>
    )}
  </div>
);

// ── Compare mega-menu: "Sloth vs <competitor>" cards ─────────────────────────
// Favicons come from Google's favicon service (reliable, avoids pinging the
// competitor); if that is blocked the img hides and a brand-colour monogram
// shows instead. The competitor's primary brand colour (--bc) drives the
// two-layer curtain + the name on hover.
const CompareItem = ({ item, active }) => {
  const [imgOk, setImgOk] = useState(true);
  const favicon = `https://www.google.com/s2/favicons?domain=${item.domain}&sz=64`;
  return (
    <Link
      to={item.href}
      role="menuitem"
      style={{ '--bc': item.color }}
      className="group/mi relative flex items-center gap-3 overflow-hidden rounded-xl px-3 py-2.5 hover:no-underline"
    >
      {/* Two-layer brand-colour curtain (inline bg = the competitor colour) */}
      <span aria-hidden="true" style={{ backgroundColor: item.color, opacity: 0.1 }} className="pointer-events-none absolute inset-0 -translate-x-full transition-transform duration-500 ease-out group-hover/mi:translate-x-0 motion-reduce:transition-none" />
      <span aria-hidden="true" style={{ backgroundColor: item.color, opacity: 0.16 }} className="pointer-events-none absolute inset-0 -translate-x-full transition-transform duration-300 ease-out group-hover/mi:translate-x-0 motion-reduce:transition-none" />

      {/* Sloth favicon  vs  competitor favicon (sized to match the other menu tiles) */}
      <span className="relative z-10 flex flex-shrink-0 items-center gap-1.5">
        <img src="/sloth.png" alt="Meeticulous" width="36" height="36" loading="lazy" className="h-9 w-9 rounded-lg bg-gray-50 p-1" />
        <span className="text-[10px] font-bold uppercase tracking-wide text-gray-400">vs</span>
        {/* Only fetch the competitor favicon once the menu is actually open — the
            panel now always renders (for crawlable links), so gate the network here. */}
        {active && imgOk ? (
          <img src={favicon} alt="" width="36" height="36" loading="lazy" onError={() => setImgOk(false)} className="h-9 w-9 rounded-lg bg-gray-50 p-1" />
        ) : (
          <span className="flex h-9 w-9 items-center justify-center rounded-lg text-[14px] font-bold text-white" style={{ backgroundColor: item.color }}>
            {item.name[0]}
          </span>
        )}
      </span>
      <span className="relative z-10 text-[14px] font-bold text-ink transition-colors group-hover/mi:text-[var(--bc)]">{item.name}</span>
    </Link>
  );
};

const CompareMega = ({ active }) => {
  // Three columns (two cards each) so Compare matches the Resources width.
  const per = Math.ceil(COMPARE_MENU.length / 3);
  const cols = [0, 1, 2].map((n) => COMPARE_MENU.slice(n * per, n * per + per));
  return (
    <div className="p-5">
      <p className="mb-2 px-3 text-[11px] font-normal uppercase tracking-wider text-gray-400">Switching? See how we compare</p>
      <div className="flex gap-5">
        {cols.map((group, i) => (
          <div key={i} className={`${MENU_COL} space-y-0.5`}>
            {group.map((c) => <CompareItem key={c.href} item={c} active={active} />)}
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Public center nav (logged-out): mega-menus + Pricing ─────────────────────
// Owns the single "which menu is open" state so switching between triggers is an
// instant handoff (never two panels at once). One shared close timer bridges the
// gap from a trigger to its panel; Escape / outside-click / route change close.
export const PublicCenterNav = () => {
  const [activeKey, setActiveKey] = useState(null);
  const timer = useRef(null);
  const location = useLocation();

  const openMenu = (k) => { if (timer.current) clearTimeout(timer.current); setActiveKey(k); };
  const closeMenu = (immediate) => {
    if (timer.current) clearTimeout(timer.current);
    if (immediate) { setActiveKey(null); return; }
    timer.current = setTimeout(() => setActiveKey(null), 120);
  };

  useEffect(() => { setActiveKey(null); }, [location.pathname]);
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') setActiveKey(null); };
    const onPointer = (e) => { if (!e.target.closest?.('[data-navmenu]')) setActiveKey(null); };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('pointerdown', onPointer); };
  }, []);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const menuProps = { activeKey, onOpen: openMenu, onClose: closeMenu, align: 'center' };
  return (
    <>
      <NavDropdown id="product" label="Product" {...menuProps}>
        <MegaMenu sections={PRODUCT_MENU} colClass="w-[23rem]" />
      </NavDropdown>

      <NavDropdown id="whofor" label="Who it's for" wide {...menuProps}>
        <MegaMenu sections={WHOFOR_MENU} colClass="flex-1" />
      </NavDropdown>

      <NavDropdown id="resources" label="Resources" {...menuProps}>
        <MegaMenu sections={RESOURCES_MENU} />
      </NavDropdown>

      <NavDropdown id="compare" label="Compare" {...menuProps}>
        <CompareMega active={activeKey === 'compare'} />
      </NavDropdown>

      <Link to="/pricing" className="flex items-center px-3.5 text-[12.5px] font-medium text-gray-500 transition-colors hover:text-primary hover:no-underline">
        Pricing
      </Link>
    </>
  );
};

// ── Main component ────────────────────────────────────────────────────────────

const Navbar = () => {
  const { user, logout, mode, setMode } = useAuth();
  const appearance = useAppearance();
  const location = useLocation();

  const [menuOpen,    setMenuOpen]    = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [notifOpen,   setNotifOpen]   = useState(false);
  const [signInOpen,  setSignInOpen]  = useState(false);
  const [notifs,      setNotifs]      = useState([]);
  const [unread,      setUnread]      = useState(0);
  const [notifStatus, setNotifStatus] = useState('loading'); // 'loading' | 'ready' | 'error'
  const [guestName,   setGuestName]   = useState('');

  const dropdownRef = useRef(null);
  const notifRef    = useRef(null);
  const signInRef   = useRef(null);

  // Mode-aware view (unified identity): a host sees the host nav only in Hosting
  // mode; in Traveling mode — or as a pure guest — they see the guest nav.
  const canHost     = isHost(user);
  const hostingView = canHost && mode === 'hosting';
  // Logged-in users get a deliberately empty center nav — the profile dropdown is
  // the only navbar surface (hosts navigate via the dashboard; guests only need
  // bookings/reviews). Logged-out users render PublicCenterNav.
  const navItems     = [];

  // Notification feed — role-filtered (host vs guest), loaded on mount and on panel open
  const notifRole = hostingView ? 'host' : 'guest';
  const loadNotifs = useCallback(() => {
    if (!user) return;
    getNotifications(notifRole)
      .then(({ data }) => {
        setNotifs(data.notifications || []);
        setUnread(data.unreadCount || 0);
        setNotifStatus('ready');
      })
      .catch(() => setNotifStatus((s) => (s === 'loading' ? 'error' : s)));
  }, [user, notifRole]);
  useEffect(() => { loadNotifs(); }, [loadNotifs]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (notifOpen) loadNotifs(); }, [notifOpen]);
  // Live updates — refetch when the server broadcasts a new notification.
  useLiveNotifications(user?.id, loadNotifs);

  // Guest greeting name — sourced from the guest's most recent booking (guests
  // often have no profile name). Falls back to the account name. Hosts skip this.
  useEffect(() => {
    if (!user || hostingView) return;
    getGuestBookings()
      .then(({ data }) => {
        const list = Array.isArray(data) ? data : [];
        const latest = [...list].sort(
          (a, b) => new Date(b.created_at || b.scheduled_at) - new Date(a.created_at || a.scheduled_at),
        )[0];
        setGuestName(latest?.guest_name || user.name || '');
      })
      .catch(() => setGuestName(user.name || ''));
  }, [user, hostingView]);


  const badges = { messages: 0, notifications: unread };

  // Close popups on outside click + ESC
  useEffect(() => {
    const onPointer = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setDropdownOpen(false);
      if (notifRef.current   && !notifRef.current.contains(e.target))    setNotifOpen(false);
      if (signInRef.current  && !signInRef.current.contains(e.target))   setSignInOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setDropdownOpen(false);
        setNotifOpen(false);
        setSignInOpen(false);
        setMenuOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  // Close mobile menu + dropdowns on navigation
  useEffect(() => {
    setMenuOpen(false);
    setDropdownOpen(false);
    setNotifOpen(false);
    setSignInOpen(false);
  }, [location.pathname]);

  // Keep active role in sync with the route. Browser back/forward changes the
  // URL but not the persisted mode, which previously left the toggle + profile
  // menu showing Hosting on a Traveling page. Only snaps for dual-capability
  // accounts and only on role-specific paths (neutral paths leave mode as-is).
  useEffect(() => {
    if (!canHost) return;
    const role = routeRole(location.pathname);
    if (role && role !== mode) setMode(role);
  }, [location.pathname, canHost, mode, setMode]);

  // Lock body scroll while the mobile drawer is open so the page behind it
  // cannot be scrolled/seen. Mirrors Modal.jsx.
  useEffect(() => {
    if (!menuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [menuOpen]);

  const isActive = ({ href, exact }) =>
    exact ? location.pathname === href : location.pathname.startsWith(href);

  return (
    <nav
      className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-200/80 shadow-[0_1px_8px_rgba(0,0,0,0.05)]"
      aria-label="Main navigation"
    >
      <div className="app-container">
        {/* ── Desktop bar ───────────────────────────────────────────────────── */}
        <div className="flex items-stretch h-14">

          {/* Logo */}
          <Link
            to="/"
            className="flex items-center gap-2.5 shrink-0 pr-4 hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 rounded"
            aria-label="Meeticulous — home"
          >
            <NavbarLogo appearance={appearance} />
          </Link>

          {/* Center nav (desktop only) */}
          <div className="hidden md:flex items-stretch flex-1 justify-center">
            {!user ? <PublicCenterNav /> : navItems.map((item) => {
              const active = isActive(item);
              const Icon   = item.icon;
              return (
                <NavLink
                  key={item.href}
                  to={item.href}
                  aria-current={active ? 'page' : undefined}
                  aria-label={item.badge && badges[item.badge] > 0
                    ? `${item.label}, ${badges[item.badge]} unread`
                    : item.label}
                  className={[
                    'group relative flex flex-col items-center justify-center gap-0.5 px-3.5 text-[12.5px] font-medium',
                    'transition-colors duration-150 outline-none',
                    'focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary',
                    active ? 'text-primary' : 'text-gray-500 hover:text-primary',
                  ].join(' ')}
                >
                  {/* Hover background pill */}
                  <span className={[
                    'absolute inset-x-1 inset-y-1.5 rounded-lg transition-colors duration-150',
                    active ? 'bg-primary/6' : 'group-hover:bg-primary/5',
                  ].join(' ')} aria-hidden="true" />

                  {/* Icon + label */}
                  <span className="relative flex flex-col items-center gap-0.5 z-10">
                    <span className="relative">
                      <Icon
                        size={19}
                        strokeWidth={active ? 2.2 : 1.7}
                        className={`transition-colors duration-150 ${active ? 'text-primary' : 'text-gray-400 group-hover:text-primary/80'}`}
                      />
                      {item.badge && <BadgePill count={badges[item.badge]} />}
                      {item.tag && <TagPill text={item.tag} />}
                    </span>
                    <span className="leading-none">{item.label}</span>
                  </span>

                  {/* Active bottom indicator */}
                  <span
                    className={`absolute bottom-0 left-1 right-1 h-[2.5px] rounded-t-full bg-primary transition-all duration-150 ${active ? 'opacity-100' : 'opacity-0'}`}
                    aria-hidden="true"
                  />
                </NavLink>
              );
            })}
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-1 ml-auto">

            {/* Search — always-on creator discovery entry point → /search */}
            <Link
              to="/search"
              aria-label="Search creators"
              className="p-2.5 rounded-full text-gray-500 hover:text-primary hover:bg-primary/5 transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 hover:no-underline"
            >
              <Search size={19} strokeWidth={1.7} />
            </Link>

            {user ? (
              <>
                {/* Notifications bell */}
                <div ref={notifRef} className="relative">
                  <button
                    onClick={() => { setNotifOpen(o => !o); setDropdownOpen(false); setMenuOpen(false); }}
                    className="relative p-2.5 rounded-full text-gray-500 hover:text-primary hover:bg-primary/5 transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
                    aria-label={`Notifications${badges.notifications > 0 ? `, ${badges.notifications} unread` : ''}`}
                    aria-expanded={notifOpen}
                    aria-haspopup="dialog"
                  >
                    <Bell size={19} strokeWidth={1.7} />
                    <BadgePill count={badges.notifications} />
                  </button>

                  {/* Notifications panel */}
                  {notifOpen && (
                    <div
                      className="absolute right-0 top-full mt-1.5 w-[calc(100vw-1.5rem)] max-w-[20rem] sm:w-80 bg-white rounded-xl border border-gray-200 shadow-[0_8px_32px_rgba(0,0,0,0.12)] z-50 overflow-hidden"
                      role="dialog"
                      aria-label="Notifications"
                    >
                      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                        <span className="text-sm font-semibold text-ink">Notifications</span>
                        <button
                          className="text-[11px] text-primary font-medium hover:underline focus:outline-none"
                          onClick={() => markAllNotificationsRead(notifRole).then(loadNotifs).catch(() => {})}
                        >
                          Mark all read
                        </button>
                      </div>
                      {notifStatus === 'loading' && notifs.length === 0 ? (
                        <ul className="max-h-96 overflow-y-auto divide-y divide-gray-50" aria-busy="true">
                          {[0, 1, 2].map((i) => (
                            <li key={i} className="flex flex-col gap-2 px-4 py-3.5">
                              <span className="h-3 w-2/5 animate-pulse rounded bg-gray-100" />
                              <span className="h-2.5 w-3/4 animate-pulse rounded bg-gray-100" />
                            </li>
                          ))}
                        </ul>
                      ) : notifStatus === 'error' && notifs.length === 0 ? (
                        <div className="py-10 text-center">
                          <Bell size={28} className="mx-auto text-gray-200 mb-2" />
                          <p className="text-sm text-gray-400">Couldn't load notifications</p>
                          <button
                            type="button"
                            onClick={loadNotifs}
                            className="mt-2 text-[11px] font-medium text-primary hover:underline focus:outline-none"
                          >
                            Try again
                          </button>
                        </div>
                      ) : notifs.length === 0 ? (
                        <div className="py-10 text-center">
                          <Bell size={28} className="mx-auto text-gray-200 mb-2" />
                          <p className="text-sm text-gray-400">No new notifications</p>
                        </div>
                      ) : (
                        <ul className="max-h-96 overflow-y-auto divide-y divide-gray-50">
                          {notifs.map((n) => (
                            <li key={n.id}>
                              <Link
                                to={n.link || '#'}
                                onClick={() => {
                                  if (!n.read_at) setUnread((u) => Math.max(0, u - 1));
                                  setNotifs((list) => list.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)));
                                  markNotificationRead(n.id).catch(() => {});
                                  setNotifOpen(false);
                                }}
                                className={`block px-4 py-3 hover:bg-gray-50 hover:no-underline ${n.read_at ? '' : 'bg-primary/4'}`}
                              >
                                <p className="text-sm font-medium text-ink">{n.title}</p>
                                {n.body && <p className="text-xs text-gray-500 mt-0.5">{n.body}</p>}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>

                {/* Profile avatar + dropdown */}
                <div ref={dropdownRef} className="relative">
                  <button
                    onClick={() => { setDropdownOpen(o => !o); setNotifOpen(false); setMenuOpen(false); }}
                    className="flex items-center gap-1.5 pl-1 pr-2 py-1 rounded-full hover:bg-gray-100 transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
                    aria-label="Profile and account menu"
                    aria-expanded={dropdownOpen}
                    aria-haspopup="menu"
                  >
                    {hostingView
                      ? <PhotoAvatar user={user} className="h-8 w-8 text-sm" />
                      : <SlothAvatar appearance={appearance} className="h-8 w-8" />}
                    <ChevronDown
                      size={13}
                      strokeWidth={2.5}
                      className={`hidden sm:block text-gray-400 transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`}
                    />
                  </button>

                  {/* Dropdown menu */}
                  {dropdownOpen && (
                    <div
                      className={`absolute right-0 top-full mt-1.5 ${hostingView ? 'w-72' : 'w-64'} bg-white rounded-xl border border-gray-200 shadow-[0_8px_32px_rgba(0,0,0,0.12)] z-50 overflow-hidden`}
                      role="menu"
                      aria-label="Profile options"
                    >
                      {hostingView ? (
                        <>
                          {/* Host header: photo + name + @username + membership */}
                          <div className="px-4 py-3.5 border-b border-gray-100">
                            <VendorProfileHeader user={user} />
                            <MembershipButton user={user} onClick={() => setDropdownOpen(false)} />
                          </div>
                          <div className="py-1">
                            <MenuLinks items={VENDOR_MENU} user={user} onNavigate={() => setDropdownOpen(false)} />
                          </div>
                        </>
                      ) : (
                        <>
                          {/* Guest header: Sloth mark + "Hello," + last-booking name */}
                          <div className="px-4 py-3.5 border-b border-gray-100">
                            <GuestProfileHeader appearance={appearance} name={guestName} />
                          </div>
                          <div className="py-1">
                            <MenuLinks items={GUEST_MENU} user={user} onNavigate={() => setDropdownOpen(false)} />
                          </div>
                        </>
                      )}

                      {/* Logout */}
                      <div className="border-t border-gray-100 py-1">
                        <button
                          onClick={logout}
                          role="menuitem"
                          className="flex w-full items-center gap-3 px-4 py-2.5 text-[13px] text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors duration-150 outline-none focus-visible:bg-red-50 focus-visible:text-red-600"
                        >
                          <LogOut size={15} className="flex-shrink-0" />
                          Logout
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              /* Public CTAs */
              <>
                <Link
                  to="/become-a-host"
                  className="btn hidden md:inline-flex items-center px-4 py-2 text-[13px] font-semibold text-white bg-primary hover:bg-primary-dark transition-colors duration-150 shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 hover:no-underline"
                >
                  Let's Get Started
                </Link>
              </>
            )}

            {/* Mobile hamburger */}
            <button
              className="md:hidden p-2.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-primary ml-1"
              onClick={() => { setMenuOpen(o => !o); setDropdownOpen(false); setNotifOpen(false); setSignInOpen(false); }}
              aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
            >
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* ── Mobile drawer + backdrop ───────────────────────────────────────── */}
        {/* Portaled to <body>: the nav's backdrop-blur makes it a containing block
            for fixed descendants, which would otherwise clamp the drawer to the
            56px bar height. Portaling resolves `fixed` against the viewport. */}
        {menuOpen && createPortal(
          <>
            {/* Backdrop: dims + blocks the page behind the drawer (below the bar) */}
            <div
              className="fixed left-0 right-0 top-14 bottom-0 z-50 bg-black/40 md:hidden"
              onClick={() => setMenuOpen(false)}
              aria-hidden="true"
            />
            {/* Fixed full-height drawer */}
            <div
              id="mobile-menu"
              className="fixed top-14 right-0 bottom-0 z-50 flex w-[82%] max-w-xs flex-col overflow-y-auto overscroll-contain bg-white pb-6 shadow-2xl md:hidden"
              aria-label="Mobile navigation"
            >
            {/* Nav links */}
            <div className="pt-2 space-y-0.5 px-1">
              {navItems.map((item) => {
                const active = isActive(item);
                const Icon   = item.icon;
                return (
                  <NavLink
                    key={item.href}
                    to={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={[
                      'flex items-center gap-3 px-3 py-3 text-[13px] font-medium rounded-lg transition-colors duration-150',
                      active
                        ? 'text-primary bg-primary/6'
                        : 'text-gray-600 hover:text-primary hover:bg-primary/5',
                    ].join(' ')}
                  >
                    <Icon
                      size={18}
                      strokeWidth={active ? 2.2 : 1.7}
                      className={`flex-shrink-0 ${active ? 'text-primary' : 'text-gray-400'}`}
                    />
                    <span className="flex-1">{item.label}</span>
                    {item.tag && (
                      <span className="px-1.5 h-[16px] rounded-full bg-amber-400 text-ink text-[10px] font-bold uppercase tracking-wide flex items-center">
                        {item.tag}
                      </span>
                    )}
                    {item.badge && badges[item.badge] > 0 && (
                      <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center">
                        {badges[item.badge]}
                      </span>
                    )}
                    {active && (
                      <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" aria-hidden="true" />
                    )}
                  </NavLink>
                );
              })}
            </div>

            {/* Public (mobile): How It Works / Pricing / Explore / More, then the
                CTA. Industry + info collapsed so the drawer stays short. */}
            {!user && (
              <div className="px-2 pt-2 space-y-1.5">
                <Link to="/how-it-works" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium text-gray-600 hover:bg-primary/5 hover:text-primary hover:no-underline">
                  <Sparkles size={16} className="flex-shrink-0 text-gray-400" /> How It Works
                </Link>

                <Link to="/pricing" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium text-gray-600 hover:bg-primary/5 hover:text-primary hover:no-underline">
                  <Tag size={16} className="flex-shrink-0 text-gray-400" /> Pricing
                </Link>

                {/* Explore hidden from nav (see PublicCenterNav). /explore still live. */}

                {/* Product / Who it's for / Resources / Compare — collapsed accordions */}
                {MOBILE_SECTIONS.map((sec) => {
                  const SecIcon = sec.icon;
                  return (
                    <details key={sec.label} className="group rounded-lg">
                      <summary className="flex cursor-pointer list-none items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium text-gray-600 hover:bg-primary/5 [&::-webkit-details-marker]:hidden">
                        <SecIcon size={16} className="flex-shrink-0 text-gray-400" />
                        <span className="flex-1">{sec.label}</span>
                        <ChevronDown size={15} className="text-gray-400 transition-transform group-open:rotate-180" />
                      </summary>
                      <div className="space-y-0.5 pl-1 pt-0.5">
                        {sec.items.map((it) => {
                          const ItIcon = it.icon;
                          return (
                            <Link key={it.href} to={it.href} className="flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] text-gray-600 hover:bg-primary/5 hover:text-primary hover:no-underline">
                              {ItIcon && <ItIcon size={15} className="flex-shrink-0 text-gray-400" />}
                              {it.label}
                            </Link>
                          );
                        })}
                      </div>
                    </details>
                  );
                })}

                {/* Primary conversion CTA — last in the sequence */}
                <Link
                  to="/become-a-host"
                  className="btn mt-1 block w-full rounded-lg bg-primary py-2.5 text-center text-[13px] font-semibold text-white shadow-sm transition-colors hover:bg-primary-dark hover:no-underline"
                >
                  Let's Get Started
                </Link>
              </div>
            )}

            {/* Logged in: user info + dropdown items + logout */}
            {user && (
              <div className="pt-3 mt-1 border-t border-gray-100 px-1">
                {hostingView ? (
                  <>
                    {/* Host: photo + name + @username + membership */}
                    <div className="px-3 py-2 mb-1">
                      <VendorProfileHeader user={user} />
                      <MembershipButton user={user} onClick={() => setMenuOpen(false)} />
                    </div>
                    <div className="space-y-0.5">
                      <MenuLinks items={VENDOR_MENU} user={user} onNavigate={() => setMenuOpen(false)} />
                    </div>
                  </>
                ) : (
                  <>
                    {/* Guest: Sloth mark + "Hello," + last-booking name */}
                    <div className="px-3 py-2 mb-1">
                      <GuestProfileHeader appearance={appearance} name={guestName} />
                    </div>
                    <div className="space-y-0.5">
                      <MenuLinks items={GUEST_MENU} user={user} onNavigate={() => setMenuOpen(false)} />
                    </div>
                  </>
                )}

                {/* Logout */}
                <button
                  onClick={logout}
                  className="flex w-full items-center gap-3 px-3 py-2.5 mt-1 text-[13px] text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-150"
                >
                  <LogOut size={16} className="flex-shrink-0" />
                  Logout
                </button>
              </div>
            )}
            </div>
          </>,
          document.body
        )}
      </div>
    </nav>
  );
};

export default Navbar;

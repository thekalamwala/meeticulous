import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUp, ChevronDown, CreditCard, Gift, Zap } from 'lucide-react';
import OperatorCredit from './OperatorCredit';
import DoodleWordmark from './footer/DoodleWordmark';

const EMAIL = 'team@meeticulous.com';
const ROUTE_START = '/become-a-host';

// Faint honeycomb (white lines ~4%) — same hex tile as the homepage hero, so the
// page opens and closes on the bee motif. Inline SVG: no request, no layout cost.
const HIVE_TILE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='31.18' height='54' viewBox='0 0 31.18 54'%3E%3Cg fill='none' stroke='%23FFFFFF' stroke-opacity='0.045' stroke-width='1'%3E%3Cpath d='M15.59 0L31.18 9V27L15.59 36L0 27V9Z'/%3E%3Cpath d='M15.59 36V54'/%3E%3C/g%3E%3C/svg%3E";

// Column footer: brand + copyright on the left, then four link columns.
// Every link points at a real route. Solutions + Compare stay in Resources:
// they are hub pages (/solutions, /compare) that carry crawlable internal links
// to every profession (/for/*) and competitor (/compare/*) landing page, keeping
// those out of the SEO orphan list.
const COLUMNS = [
  {
    title: 'Product',
    links: [
      { t: 'Online scheduling', href: '/features/online-scheduling' },
      { t: 'Booking pages', href: '/features/booking-pages' },
      { t: 'Payments', href: '/features/payments' },
      { t: 'Reminders', href: '/features/notifications' },
      { t: 'Google Calendar', href: '/features/google-calendar' },
      { t: 'Pricing', href: '/pricing' },
    ],
  },
  {
    title: 'Company',
    links: [
      { t: 'About Us', href: '/about' },
      { t: 'Careers', href: '/careers' },
      { t: 'Blog', href: '/blog' },
      { t: 'Press', href: '/press' },
      { t: 'Contact', href: '/contact' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { t: 'Help Center', href: '/help' },
      { t: 'Documentation', href: '/help/docs' },
      { t: 'FAQ', href: '/#faq' },
      { t: 'Solutions', href: '/solutions' },
      { t: 'Compare', href: '/compare' },
      { t: 'Changelog', href: '/changelog' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { t: 'Terms', href: '/terms' },
      { t: 'Privacy', href: '/privacy' },
      { t: 'Refund', href: '/refund' },
      { t: 'Guest Booking Terms', href: '/guest-terms' },
      { t: 'Host Agreement', href: '/host-agreement' },
      { t: 'Host Fee Schedule', href: '/host-fees' },
    ],
  },
];

// Minimal variant (booking + host profile pages): just the legal links.
const LEGAL = COLUMNS.find((c) => c.title === 'Legal').links;

// Brand-icon paths (simple-icons, 24x24, fill=currentColor). Email uses a heroicons envelope glyph.
const SOCIALS = [
  { name: 'Instagram', color: '#F56285', href: 'https://www.instagram.com/meeticulous',
    d: 'M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z' },
  { name: 'X', color: '#FFFFFF', href: 'https://x.com/meeticulous',
    d: 'M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z' },
  { name: 'LinkedIn', color: '#4FA3F0', href: 'https://www.linkedin.com/company/meeticulous/',
    d: 'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z' },
  { name: 'Facebook', color: '#4A90F5', href: 'https://www.facebook.com/meeticulous',
    d: 'M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z' },
  { name: 'WhatsApp', color: '#25D366', href: 'https://wa.me/15559708785?text=Namaste%2C%20I%20want%20to%20talk%20about%20Meeticulous',
    d: 'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.149-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.885-9.885 9.885M20.52 3.449C18.24 1.245 15.24 0 12.045 0 5.463 0 .104 5.334.101 11.892c0 2.096.549 4.142 1.595 5.945L0 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.582 0 11.940-5.334 11.943-11.893a11.821 11.821 0 00-3.416-8.452z' },
  { name: 'Email', color: '#FF9FB0', href: `mailto:${EMAIL}`,
    d: 'M1.5 8.67v8.58a3 3 0 003 3h15a3 3 0 003-3V8.67l-8.928 5.493a3 3 0 01-3.144 0L1.5 8.67Zm21-1.94V6.75a3 3 0 00-3-3h-15a3 3 0 00-3 3v-.02l9.714 5.977a1.5 1.5 0 001.572 0L22.5 6.73Z' },
];

// Internal route -> <Link>; section anchor / mailto / http -> <a>.
function FLink({ href, className, children }) {
  const isInternal = href.startsWith('/') && !href.startsWith('/#');
  if (isInternal) return <Link to={href} className={className}>{children}</Link>;
  const ext = href.startsWith('http');
  return (
    <a href={href} className={className} {...(ext ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
      {children}
    </a>
  );
}

const scrollTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

// Links: coral hover + an underline that slides in from the left.
const LINK =
  'relative text-sm text-white/85 transition-colors hover:text-secondary hover:no-underline after:absolute after:-bottom-0.5 after:left-0 after:h-px after:w-full after:origin-left after:scale-x-0 after:bg-secondary after:transition-transform after:duration-300 hover:after:scale-x-100 motion-reduce:after:transition-none';

const Socials = () => (
  <div className="flex flex-nowrap gap-2">
    {SOCIALS.map((s) => {
      const ext = s.href.startsWith('http');
      return (
        <a key={s.name} href={s.href} aria-label={s.name} {...(ext ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
          style={{ '--brand': s.color }}
          className="flex h-8 w-8 items-center justify-center rounded-[5px] border border-white/15 text-white/55 transition-colors hover:border-[var(--brand)] hover:text-[var(--brand)] hover:no-underline">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
            <path d={s.d} />
          </svg>
        </a>
      );
    })}
  </div>
);

export default function Footer({ variant = 'full' }) {
  const year = new Date().getFullYear();
  const minimal = variant === 'minimal';
  const [open, setOpen] = useState({}); // mobile accordion state per column

  return (
    <footer className="relative overflow-hidden bg-ink px-5 pb-4 pt-7 text-white sm:px-8 sm:pt-9 lg:pt-10">
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ backgroundImage: `url("${HIVE_TILE}")`, backgroundSize: '31.18px 54px' }} />

      {/* Closing CTA — a full-width band across the top of the footer (bleeds
          past the footer's side + top padding); its content stays aligned with
          the max-w-6xl columns below. The last thing people see is the next step.
          Reassurances reuse claims the site already makes (Starter is "Free
          Forever · No card, no catch" on the pricing section; "live in minutes"
          is the site description) — keep them in sync. */}
      {!minimal && (
        <div className="relative -mx-5 -mt-7 mb-8 overflow-hidden border-b border-white/10 bg-white/[0.04] px-5 py-9 sm:-mx-8 sm:-mt-9 sm:mb-10 sm:px-8 sm:py-11 lg:-mt-10 lg:py-12">
          <div aria-hidden className="pointer-events-none absolute -right-24 -top-32 h-80 w-80 rounded-full bg-primary/30 blur-3xl" />
          <div className="relative mx-auto flex max-w-6xl flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="font-display text-2xl font-extrabold leading-tight text-white sm:text-3xl lg:text-4xl">
                Ready to get booked and paid?
              </p>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/70 sm:text-base">
                One link for bookings, UPI payments and reminders. Set it up once and let it run.
              </p>
              <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-3 text-sm text-white/85">
                {[
                  { t: 'Free forever plan', Icon: Gift },
                  { t: 'No card needed', Icon: CreditCard },
                  { t: 'Live in minutes', Icon: Zap },
                ].map(({ t, Icon }) => (
                  <li key={t} className="inline-flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-white">
                      <Icon size={14} aria-hidden="true" />
                    </span>
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex flex-shrink-0 flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                to={ROUTE_START}
                className="group inline-flex items-center justify-center gap-2 rounded-[6px] bg-white px-6 py-3 text-sm font-semibold text-ink shadow-[0_12px_30px_-12px_rgba(0,0,0,0.6)] transition-opacity hover:no-underline hover:opacity-90"
              >
                Start for free
                <ArrowRight size={16} className="transition-transform duration-300 group-hover:translate-x-0.5" />
              </Link>
              <Link
                to="/pricing"
                className="inline-flex items-center justify-center rounded-[6px] px-4 py-3 text-sm font-semibold text-white/80 transition-colors hover:text-white hover:no-underline"
              >
                See pricing
              </Link>
            </div>
          </div>
        </div>
      )}

      <div className="relative mx-auto max-w-6xl">
        {minimal ? (
          /* Booking / profile pages: brand + a compact legal bar only */
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <button type="button" onClick={scrollTop} className="text-left font-heading text-base font-bold text-white transition-colors hover:text-white/80">
              Meeticulous
            </button>
            <nav aria-label="Legal" className="flex flex-wrap gap-x-5 gap-y-2 sm:max-w-xl sm:justify-end">
              {LEGAL.map((l) => (
                <FLink key={l.t} href={l.href} className={LINK}>
                  {l.t}
                </FLink>
              ))}
            </nav>
          </div>
        ) : (
          <>
            <div className="grid sm:grid-cols-2 sm:gap-8 lg:grid-cols-[1.2fr_repeat(4,1fr)] lg:gap-8">
              <div className="pb-4 sm:pb-0">
                <button type="button" onClick={scrollTop} className="font-heading text-base font-bold text-white transition-colors hover:text-white/80">
                  Meeticulous
                </button>
                <div className="mt-4">
                  <Socials />
                </div>
              </div>

              {COLUMNS.map((col) => {
                const isOpen = !!open[col.title];
                return (
                  <nav key={col.title} aria-label={col.title} className="border-t border-white/10 py-3 sm:border-0 sm:py-0">
                    {/* Small grey label on desktop; a tap-to-open row on phones */}
                    <button
                      type="button"
                      onClick={() => setOpen((o) => ({ ...o, [col.title]: !o[col.title] }))}
                      aria-expanded={isOpen}
                      className="flex w-full items-center justify-between text-left text-sm font-medium text-white/50 sm:pointer-events-none sm:cursor-default"
                    >
                      {col.title}
                      <ChevronDown size={16} className={`transition-transform sm:hidden ${isOpen ? 'rotate-180' : ''}`} />
                    </button>
                    <ul className={`mt-3 space-y-2 ${isOpen ? 'block' : 'hidden'} sm:block`}>
                      {col.links.map((l) => (
                        <li key={l.t}>
                          <FLink href={l.href} className={LINK}>
                            {l.t}
                          </FLink>
                        </li>
                      ))}
                    </ul>
                  </nav>
                );
              })}
            </div>
          </>
        )}

        {/* Bottom row: © left · operator credit · back to top */}
        <div className="mt-5 flex flex-col gap-1.5 border-t sm:mt-7 sm:gap-2 border-white/10 pt-4 text-xs text-white/55 sm:flex-row sm:items-center sm:justify-between">
          <span>© {year} Meeticulous. All rights reserved.</span>
          {/* Company ownership visible site-wide — part of the Google OAuth
              verification checklist (homepage must identify the operator). */}
          <OperatorCredit />
          <button
            type="button"
            onClick={scrollTop}
            className="inline-flex w-fit items-center gap-1.5 text-white/60 transition-colors hover:text-white"
          >
            Back to top <ArrowUp size={14} />
          </button>
        </div>

        {/* Brand signature. Full footer: chalk "Meeticulous" with the doodle crew
            living on the letters (DoodleWordmark). Minimal (booking/profile):
            the quiet faint wordmark, so nothing competes with the booking flow. */}
        {minimal ? (
          <p
            aria-hidden
            className="pointer-events-none mt-3 select-none text-center font-display text-[clamp(2.75rem,10vw,7.5rem)] font-extrabold leading-[0.85] tracking-tight text-white/[0.05]"
          >
            Meeticulous
          </p>
        ) : (
          <div className="mt-6 sm:mt-8">
            <DoodleWordmark />
          </div>
        )}
      </div>
    </footer>
  );
}

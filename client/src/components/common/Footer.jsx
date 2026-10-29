import { Link } from 'react-router-dom';
import OperatorCredit from './OperatorCredit';

const ROUTE_START = '/become-a-host';
const EMAIL = 'bolt@meeticulous.in';

// Minimal footer: link discovery now lives in the navbar mega-menus, so the
// footer is just the CTA band + a centered legal strip + socials + operator bar.

// Single centered inline row (support + legal, no label). Solutions + Compare
// lead the row: they are hub pages (/solutions, /compare) that carry crawlable
// internal links to every profession (/for/*) and competitor (/compare/*) landing
// page, keeping those out of the SEO orphan list without a heavy footer sitemap.
const LEGAL = [
  { t: 'Solutions', href: '/solutions' },
  { t: 'Compare', href: '/compare' },
  { t: 'FAQ', href: '/#faq' },
  { t: 'Documentation', href: '/help/docs' },
  { t: 'Terms', href: '/terms' },
  { t: 'Privacy', href: '/privacy' },
  { t: 'Refund', href: '/refund' },
  { t: 'Guest Booking Terms', href: '/guest-terms' },
  { t: 'Host Agreement', href: '/host-agreement' },
  { t: 'Host Fee Schedule', href: '/host-fees' },
];

// Brand-icon paths (simple-icons, 24x24, fill=currentColor). Email uses a heroicons envelope glyph.
const SOCIALS = [
  { name: 'Instagram', href: 'https://www.instagram.com/bookasloth',
    d: 'M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z' },
  { name: 'X', href: 'https://x.com/bookasloth',
    d: 'M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z' },
  { name: 'LinkedIn', href: 'https://www.linkedin.com/company/book-a-sloth/',
    d: 'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z' },
  { name: 'Facebook', href: 'https://www.facebook.com/bookasloth',
    d: 'M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z' },
  { name: 'WhatsApp', href: 'https://wa.me/15559708785?text=Namaste%2C%20I%20want%20to%20talk%20about%20Book%20A%20Sloth',
    d: 'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.149-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.885-9.885 9.885M20.52 3.449C18.24 1.245 15.24 0 12.045 0 5.463 0 .104 5.334.101 11.892c0 2.096.549 4.142 1.595 5.945L0 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.582 0 11.940-5.334 11.943-11.893a11.821 11.821 0 00-3.416-8.452z' },
  { name: 'Email', href: `mailto:${EMAIL}`,
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

// Centered, pipe-separated inline row (support + legal links, no label).
function InlineRow({ items }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-y-2">
      {items.map((l, i) => (
        <span key={l.t} className="flex items-center">
          {i > 0 && <span aria-hidden="true" className="mx-3 text-white/20">|</span>}
          <FLink href={l.href} className="text-sm text-white/55 transition-colors hover:text-white hover:no-underline">
            {l.t}
          </FLink>
        </span>
      ))}
    </div>
  );
}

export default function Footer({ variant = 'full' }) {
  const year = new Date().getFullYear();
  const minimal = variant === 'minimal';
  return (
    <footer className="bg-ink px-5 pb-12 pt-16 text-white sm:px-8 lg:pt-20">
      <div className="mx-auto max-w-6xl">
        {/* CTA band */}
        <div className={`flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between ${minimal ? '' : 'pb-14'}`}>
          <h2 className="font-heading text-3xl font-bold leading-[1.05] tracking-tight text-white sm:text-4xl">
            Power up your<br />bookings.
          </h2>
          <div className="flex flex-col gap-4 sm:items-end">
            <p className="text-sm text-white/50">Get started in seconds — for free.</p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link to={ROUTE_START} className="inline-flex items-center justify-center rounded-[5px] bg-white px-7 py-3 text-sm font-semibold text-ink transition-colors hover:bg-white/90 hover:no-underline">
                Let's Get Started
              </Link>
              <Link to="/how-it-works" className="inline-flex items-center justify-center rounded-[5px] border border-white/25 px-7 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10 hover:no-underline">
                See how it works
              </Link>
            </div>
          </div>
        </div>

        {/* Link discovery lives in the navbar mega-menus + the /solutions and
            /compare hub pages now, so the full footer is just a centered legal
            strip + socials. Both are dropped in the minimal variant. */}
        {!minimal && (
        <>
        {/* Support + Legal — one centered inline row (leads with the Solutions +
            Compare hubs so every page carries a static link into them). */}
        <div className="border-t border-white/10 py-8">
          <InlineRow items={LEGAL} />
        </div>

        {/* Centered socials */}
        <div className="flex flex-wrap items-center justify-center gap-3 border-t border-white/10 py-8">
          {SOCIALS.map((s) => {
            const ext = s.href.startsWith('http');
            return (
              <a key={s.name} href={s.href} aria-label={s.name} {...(ext ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                className="flex h-9 w-9 items-center justify-center rounded-[5px] border border-white/15 text-white/60 transition-colors hover:border-white/30 hover:text-white hover:no-underline">
                <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="currentColor" aria-hidden="true">
                  <path d={s.d} />
                </svg>
              </a>
            );
          })}
        </div>
        </>
        )}

        {/* Minimal variant keeps just a compact legal bar */}
        {minimal && (
          <nav aria-label="Legal" className="mt-14 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 border-t border-white/10 py-6">
            {LEGAL.map((l) => (
              <FLink key={l.t} href={l.href} className="text-xs text-white/50 transition-colors hover:text-white hover:no-underline">
                {l.t}
              </FLink>
            ))}
          </nav>
        )}

        {/* Copyright / operator */}
        <div className="flex flex-col gap-3 border-t border-white/10 py-6 text-xs text-white/60 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <button type="button" onClick={scrollTop} className="font-heading text-sm font-extrabold text-white/80 transition-colors hover:text-white">Meeticulous</button>
            <span>© {year} All rights reserved.</span>
          </div>
          {/* Company ownership visible site-wide — part of the Google OAuth
              verification checklist (homepage must identify the operator). */}
          <OperatorCredit linkClassName="text-white/60 underline underline-offset-2 transition-colors hover:text-white" />
        </div>
      </div>
    </footer>
  );
}

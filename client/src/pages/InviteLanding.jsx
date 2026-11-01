// client/src/pages/InviteLanding.jsx
// ONE shared VIP landing for every /invite/:slug (marketing gimmick + lead-source
// attribution). Soft-modern design, built from the shipped home/pricing kit + a
// few presentational bits ported from the parked HomeArchive (/_attic) — kept
// LOCAL here on purpose so the invite chunk never imports the 2000-line archive.
// The global Navbar + Footer render on this route (it is NOT in App.jsx's
// hideNavbar list), so this page ships NO chrome of its own — only the body.
import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  CalendarCheck, Wallet, Wind, Star, Link2, CreditCard, BellRing, Users,
  Calendar, Sparkles, Lock, ShieldCheck, Eye, FileCheck, Plus, Minus,
} from 'lucide-react';
import { getInviteConfig, recordInviteVisit, getVendorGoogleUrl } from '../services/api';
import { STATS, Odometer } from './Home';
import { TESTIMONIALS } from '../data/testimonials';
import { HERO_FACES } from '../components/home/images';
import IconArt from '../components/common/IconArt';
import PricingCards from '../components/pricing/PricingCards';
import HowItWorks from '../components/home/HowItWorks';
import Reveal from '../components/home/Reveal';
import Seo from '../components/common/Seo';
import { ogCard } from '../config/ogImages';
import { readInvite, stashInvite } from '../utils/inviteStash';

/* ── Google CTA ─────────────────────────────────────────────────────────── */
const GoogleG = ({ className = 'h-4 w-4' }) => (
  <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.4 29.3 35 24 35c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 5.1 29.3 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21 21-9.4 21-21c0-1.2-.1-2.3-.4-3.5z" />
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 5.1 29.3 3 24 3 15.9 3 8.9 7.6 6.3 14.7z" />
    <path fill="#4CAF50" d="M24 45c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 36 26.7 37 24 37c-5.3 0-9.7-2.6-11.3-7l-6.5 5C8.8 40.3 15.8 45 24 45z" />
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.6l6.2 5.2C40.9 35.9 45 30.5 45 24c0-1.2-.1-2.3-.4-3.5z" />
  </svg>
);

// onDark: the closing band is bg-ink, so a bg-ink button would vanish into it —
// flip to a white fill there. Default is the dark button on light.
function GoogleCTA({ onClick, label = 'Get started with Google', onDark = false }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-3 rounded-[6px] px-7 py-3.5 text-sm font-semibold shadow-[0_8px_24px_-8px_rgba(26,26,26,0.4)] transition hover:opacity-95 ${
        onDark ? 'bg-white text-ink' : 'bg-ink text-white'
      }`}
    >
      <span className={`flex h-6 w-6 items-center justify-center rounded-full ${onDark ? 'bg-sand' : 'bg-white'}`}>
        <GoogleG />
      </span>
      {label}
    </button>
  );
}

/* ── Small presentational bits (ported-compact from /_attic) ────────────── */
// Hero social-proof face — webp with a neutral chip fallback.
function HeroFace({ src }) {
  const [err, setErr] = useState(false);
  if (err || !src) return <span className="h-10 w-10 flex-shrink-0 rounded-full border-2 border-canvas bg-gradient-to-br from-primary-light to-sand" />;
  return <img src={src} onError={() => setErr(true)} alt="" loading="lazy" className="h-10 w-10 flex-shrink-0 rounded-full border-2 border-canvas object-cover" />;
}

// Floating frosted card on the hero art (glass + float keyframes live in index.css).
function GlassCard({ icon: Icon, label, value, accent, className, float }) {
  return (
    <div className={`sloth-glass ${float} absolute flex items-center gap-3 rounded-2xl px-4 py-3 ${className}`}>
      <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${accent ? 'bg-primary/10 text-primary' : 'bg-neutral-900/5 text-neutral-700'}`}>
        <Icon size={18} />
      </span>
      <div>
        <div className="text-[11px] font-medium text-neutral-400">{label}</div>
        <div className={`text-sm font-semibold ${accent ? 'text-primary' : 'text-ink'}`}>{value}</div>
      </div>
    </div>
  );
}

// Testimonial avatar with initials fallback.
function TAvatar({ src, name }) {
  const [err, setErr] = useState(false);
  if (err || !src) return (
    <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10 text-sm font-bold text-primary">{name?.charAt(0) || '★'}</div>
  );
  return <img src={src} onError={() => setErr(true)} alt={name} loading="lazy" className="h-11 w-11 flex-shrink-0 rounded-xl object-cover" />;
}

/* ── Content (trimmed from /_attic data) ────────────────────────────────── */
const VALUE = [
  { icon: Link2, title: 'One booking link', desc: 'meeticulous.com/you — everything you offer, in a single calm link.', color: 'var(--c-blue)' },
  { icon: CreditCard, title: 'Payments built in', desc: 'Clients pay over UPI, cards or netbanking before the slot is confirmed.', color: 'var(--c-emerald)' },
  { icon: BellRing, title: 'Auto reminders', desc: 'Email + WhatsApp nudges go out before every session. You do nothing.', color: 'var(--c-violet)' },
  { icon: Calendar, title: 'Calendar sync', desc: 'Two-way Google Calendar + Meet links on every confirmed booking.', color: 'var(--c-amber)' },
  { icon: Users, title: 'Light CRM', desc: 'Notes, history and receipts for every client — zero spreadsheets.', color: 'var(--c-cyan)' },
  { icon: Sparkles, title: 'AI assistant', desc: 'Drafts your service copy, suggests slots, sends thank-yous.', color: 'var(--c-pink)' },
];

const TRUST = [
  { icon: Lock, title: 'Secure payments', desc: 'Processed by Razorpay, India’s trusted gateway.' },
  { icon: ShieldCheck, title: 'SSL encrypted', desc: 'Every page and payment is encrypted end to end.' },
  { icon: Eye, title: 'Privacy-first', desc: 'Your data is yours. Never sold, never shared.' },
  { icon: FileCheck, title: 'You own your data', desc: 'Clients, bookings and earnings always belong to you.' },
];

const FAQS = [
  { q: 'Is Meeticulous really free?', a: 'Yes. The free plan has no time limit — you pay a 5% fee only when you get paid. Upgrade to 0% commission once you’re booking regularly.' },
  { q: 'Can clients pay while booking?', a: 'Yes — that’s the point. Clients pay via UPI, card or netbanking at checkout, so you’re paid before the session starts.' },
  { q: 'Do clients need an account?', a: 'No. Clients book and pay without creating an account.' },
  { q: 'Can I connect Google Calendar?', a: 'Yes. Two-way sync keeps your availability accurate and adds Meet links to online bookings automatically.' },
  { q: 'Is GST handled?', a: 'Yes. GST invoices are generated automatically for every booking.' },
  { q: 'Can I cancel anytime?', a: 'Yes. No contracts, no lock-in — cancel from your dashboard whenever you like.' },
];

// First-touch: bas_invite is the durable single source of truth. If it already
// exists, change NOTHING — mirrors the referral bas_ref rule so localStorage and
// the UTM stash can never diverge on source.
function stashFirstTouch(slug) {
  try {
    if (!stashInvite(slug)) return;
    const cur = JSON.parse(sessionStorage.getItem('bas_utm') || '{}');
    if (!Object.keys(cur).length) {
      sessionStorage.setItem('bas_utm', JSON.stringify({ utm_source: `invite/${slug}`, utm_medium: 'invite' }));
    }
  } catch { /* non-fatal */ }
}

/* ── FAQ accordion (single-open) ────────────────────────────────────────── */
function Faq() {
  const [open, setOpen] = useState(0);
  return (
    <div className="mx-auto max-w-2xl space-y-3">
      {FAQS.map((f, i) => {
        const isOpen = open === i;
        return (
          <div key={f.q} className="overflow-hidden rounded-[10px] border border-black/5 bg-white shadow-[0_8px_30px_rgba(26,26,26,0.04)]">
            <button
              onClick={() => setOpen(isOpen ? -1 : i)}
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
              aria-expanded={isOpen}
            >
              <span className="font-heading text-base font-bold text-ink">{f.q}</span>
              {isOpen ? <Minus size={18} className="flex-shrink-0 text-primary" /> : <Plus size={18} className="flex-shrink-0 text-neutral-400" />}
            </button>
            {isOpen && <p className="px-5 pb-5 text-sm leading-relaxed text-neutral-600">{f.a}</p>}
          </div>
        );
      })}
    </div>
  );
}

export default function InviteLanding() {
  const { slug } = useParams();
  const nav = useNavigate();
  const [label, setLabel] = useState(null);

  useEffect(() => {
    let alive = true;
    getInviteConfig(slug)
      .then(({ data }) => {
        if (!alive) return;
        if (!data || data.active === false) { nav('/', { replace: true }); return; }
        setLabel(data.label || 'friend');
        stashFirstTouch(slug);
        recordInviteVisit(slug).catch(() => {});
      })
      .catch(() => { if (alive) nav('/', { replace: true }); });
    return () => { alive = false; };
  }, [slug, nav]);

  async function startGoogle() {
    try {
      const invite = readInvite() || slug;
      const { data } = await getVendorGoogleUrl('signup', invite);
      if (data?.url) window.location.href = data.url;
    } catch { /* error surfaces on the auth page */ }
  }

  if (!label) return null; // brief blank while validating (or redirecting)

  return (
    <div className="overflow-x-clip bg-canvas text-ink">
      <Seo title="You're invited — Meeticulous" description="Your personal invitation to Meeticulous." image={ogCard('invite', 'png')} robots="noindex" />

      {/* ── HERO — 2-col: copy + CTA left, product photo w/ floating cards right ── */}
      <section className="relative overflow-hidden px-5 pb-16 pt-12 sm:px-8 sm:pb-20 sm:pt-16 lg:pb-28">
        <div aria-hidden className="sloth-hero-aura" />
        <div className="relative z-10 mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
          {/* LEFT */}
          <div className="text-center lg:text-left">
            <Reveal as="p" className="mb-4 inline-block rounded-full border border-black/5 bg-white px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-primary shadow-[0_8px_30px_rgba(26,26,26,0.04)]">
              You're invited
            </Reveal>
            <Reveal as="h1" className="font-heading text-[clamp(2rem,6vw,3.4rem)] font-semibold leading-[1.08] tracking-[-0.03em]">
              Welcome, <span className="text-primary-cta">{label}</span>
            </Reveal>
            <Reveal as="p" delay={0.1} className="mx-auto mt-5 max-w-md text-lg text-neutral-500 lg:mx-0">
              One calm link for your bookings, payments and reminders. Set up in minutes — free to start.
            </Reveal>
            <Reveal delay={0.16} className="mt-8">
              <GoogleCTA onClick={startGoogle} />
              <p className="mt-3 text-xs text-neutral-500">
                By continuing you agree to our{' '}
                <Link to="/terms" className="underline">Terms</Link> and{' '}
                <Link to="/privacy" className="underline">Privacy Policy</Link>.
              </p>
            </Reveal>
            {/* Social proof */}
            <Reveal delay={0.22} className="mt-8 flex items-center justify-center gap-4 lg:justify-start">
              <div className="flex -space-x-3">
                {HERO_FACES.map((f, i) => <HeroFace key={i} src={f} />)}
              </div>
              <div className="text-left">
                <div className="flex items-center gap-1">
                  {[0, 1, 2, 3, 4].map((i) => <Star key={i} size={13} className="fill-amber-400 text-amber-400" />)}
                  <span className="ml-1 text-sm font-semibold text-ink">5/5</span>
                </div>
                <p className="text-xs text-neutral-500">Loved by India's creators and coaches.</p>
              </div>
            </Reveal>
          </div>

          {/* RIGHT — icon art + floating glass cards (sm+ only) */}
          <Reveal delay={0.1} className="relative hidden sm:block">
            <div className="relative mx-auto aspect-[4/5] w-full max-w-sm overflow-hidden rounded-[10px] bg-sand shadow-[0_40px_90px_-25px_rgba(26,26,26,0.38)] ring-1 ring-black/5">
              <IconArt icon={CalendarCheck} label="Bookings, payments and reminders on Meeticulous" className="h-full w-full border-0 shadow-none" iconClassName="h-24 w-24" />
              <div aria-hidden className="pointer-events-none absolute inset-0 rounded-[10px] ring-1 ring-inset ring-white/15" />
            </div>
            <GlassCard icon={CalendarCheck} label="New booking" value="Confirmed · 4:30 PM" float="sloth-float" className="top-10 -left-6" />
            <GlassCard icon={Wallet} label="Payment received" value="₹2,500" accent float="sloth-float--mid" className="top-1/2 -right-5" />
            <GlassCard icon={Wind} label="Upcoming session" value="Tomorrow · 11 AM" float="sloth-float--slow" className="bottom-8 left-4" />
          </Reveal>
        </div>
      </section>

      {/* ── STATS (dark) — all 4, icon tiles, no clip ── */}
      <section className="bg-ink px-5 py-16 text-white sm:px-8 lg:py-20">
        <div className="mx-auto max-w-6xl">
          <Reveal as="p" className="text-center text-sm font-semibold uppercase tracking-[0.2em] text-primary">
            The calm starts here
          </Reveal>
          <div className="mt-10 grid grid-cols-2 gap-x-6 gap-y-10 lg:grid-cols-4 lg:gap-x-0 lg:divide-x lg:divide-white/10">
            {STATS.map((s) => (
              <div key={s.label} className="text-center lg:px-6">
                <span className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20">
                  <s.icon size={28} strokeWidth={2} className="text-primary" />
                </span>
                <Odometer value={s.value} className="font-heading text-4xl font-extrabold tracking-tight text-white sm:text-5xl" />
                <p className="mx-auto mt-2 max-w-[12rem] text-sm text-white/60">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS — light theme (page bg is canvas; default dark hides text) ── */}
      <section className="px-5 py-20 sm:px-8 lg:py-24">
        <div className="mx-auto max-w-6xl">
          <Reveal as="p" className="text-center text-sm font-medium uppercase tracking-[0.2em] text-primary">
            How it works
          </Reveal>
          <Reveal as="h2" delay={0.05} className="mt-3 text-center font-heading text-4xl font-extrabold leading-tight sm:text-5xl">
            Live in <span className="text-primary-cta">three steps</span>
          </Reveal>
          <HowItWorks theme="light" lift={false} />
        </div>
      </section>

      {/* ── VALUE — what you get (bento) ── */}
      <section className="px-5 py-20 sm:px-8 lg:py-24">
        <div className="mx-auto max-w-6xl">
          <Reveal as="p" className="text-center text-sm font-medium uppercase tracking-[0.2em] text-primary">
            Everything in one link
          </Reveal>
          <Reveal as="h2" delay={0.05} className="mt-3 text-center font-heading text-4xl font-extrabold leading-tight sm:text-5xl">
            Everything you need. <span className="text-primary-cta">Nothing you don't.</span>
          </Reveal>
          <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
            {VALUE.map((f) => (
              <Reveal key={f.title}>
                <div className="group flex h-full flex-col rounded-[10px] border border-black/5 bg-white p-6 shadow-[0_8px_30px_rgba(26,26,26,0.04)] transition hover:shadow-[0_24px_60px_-28px_rgba(26,26,26,0.16)]">
                  <span className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-black/5 bg-white shadow-sm" style={{ color: f.color }}>
                    <f.icon size={22} strokeWidth={1.75} />
                  </span>
                  <h3 className="font-heading text-base font-bold text-ink">{f.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-neutral-500">{f.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING (real component; attribution rides bas_invite) ── */}
      <section className="bg-sand px-5 py-20 sm:px-8 lg:py-24">
        <div className="mx-auto max-w-[860px]">
          <h2 className="mb-3 text-center font-heading text-4xl font-extrabold sm:text-5xl">
            Simple, <span className="text-primary-cta">honest</span> pricing
          </h2>
          <p className="mx-auto mb-10 max-w-[560px] text-center text-neutral-500">
            Start free. Upgrade only when you're earning enough that 0% commission beats the 5%.
          </p>
          <PricingCards />
        </div>
      </section>

      {/* ── TESTIMONIALS (with faces) ── */}
      <section className="px-5 py-20 sm:px-8 lg:py-24">
        <div className="mx-auto max-w-5xl">
          <Reveal as="h2" className="mb-10 text-center font-heading text-4xl font-extrabold sm:text-5xl">
            Loved by people who <span className="text-primary-cta">sell their time</span>
          </Reveal>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
            {TESTIMONIALS.slice(0, 6).map((t, i) => (
              <Reveal key={i}>
                <figure className="flex h-full flex-col rounded-[10px] border border-black/5 bg-white p-6 shadow-[0_8px_30px_rgba(26,26,26,0.04)] transition hover:shadow-[0_24px_60px_-28px_rgba(26,26,26,0.16)]">
                  <blockquote className="flex-1 text-sm leading-relaxed text-neutral-700">“{t.quote}”</blockquote>
                  <figcaption className="mt-5 flex items-center gap-3">
                    <TAvatar src={t.avatar} name={t.name} />
                    <div>
                      <div className="text-sm font-semibold text-ink">{t.name}</div>
                      {t.role && <div className="text-xs text-neutral-500">{t.role}</div>}
                    </div>
                  </figcaption>
                </figure>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="bg-sand px-5 py-20 sm:px-8 lg:py-24">
        <div className="mx-auto max-w-2xl">
          <Reveal as="h2" className="mb-10 text-center font-heading text-4xl font-extrabold sm:text-5xl">
            Questions, answered
          </Reveal>
          <Faq />
        </div>
      </section>

      {/* ── TRUST ── */}
      <section className="px-5 py-16 sm:px-8 lg:py-20">
        <div className="mx-auto max-w-5xl">
          <div className="grid grid-cols-2 gap-5 sm:gap-6 lg:grid-cols-4">
            {TRUST.map((t) => (
              <div key={t.title} className="rounded-[10px] border border-black/5 bg-white p-5 text-center shadow-[0_8px_30px_rgba(26,26,26,0.04)]">
                <span className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <t.icon size={20} />
                </span>
                <h3 className="font-heading text-sm font-bold text-ink">{t.title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-neutral-500">{t.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CLOSING CTA — dark band (fixes the old dead-end) ── */}
      <section className="bg-ink px-5 py-20 text-center text-white sm:px-8 lg:py-24">
        <div className="mx-auto max-w-2xl">
          <h2 className="font-heading text-3xl font-extrabold text-white sm:text-4xl">Ready when you are, {label}.</h2>
          <p className="mx-auto mt-4 max-w-md text-white/70">Your booking page, payments and reminders — live in minutes.</p>
          <div className="mt-8 flex justify-center">
            <GoogleCTA onClick={startGoogle} label="Claim your invite" onDark />
          </div>
          <p className="mt-4 text-xs text-white/50">Free to start · no card needed</p>
        </div>
      </section>
    </div>
  );
}

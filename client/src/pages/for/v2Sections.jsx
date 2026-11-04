// v2Sections — Integrations, Pricing + About sections for the v2 /for template.
//
// The bespoke /for pages (CA, architects, …) all carry a "Works with the tools
// you already use" logo grid, a two-plan pricing block and a "built for small
// businesses" about block; these bring the same sections to the v2 pages
// (ProfessionLandingV2 and the photo-studio skin), coloured from each page's
// --v2-* palette. Pass `Decor` to add a skin's card ornament (e.g. the studio
// viewfinder corners).

import { useState } from 'react';
import { Link } from 'react-router-dom';
import Reveal from '../../components/home/Reveal';
import { ArrowRight, Check, Lock, Landmark, ShieldCheck, BadgePercent } from 'lucide-react';
import { FREE_PLAN, PREMIUM_PLAN, PREMIUM_YEARLY_PER_MONTH, PREMIUM_ANNUAL_SAVE_PCT } from '../../data/plans';
import ToolLogo from './toolLogos';
import razorpayLogo from '../enterprise-v2/assets/logo/razorpay.png';
import outlookLogo from '../enterprise-v2/assets/logo/outlook.svg';

// REAL Meeticulous integrations only — same list as the bespoke /for pages.
const TOOLS = [
  { name: 'Google Calendar', icon: 'google-calendar', sub: 'Busy times blocked, bookings added to your calendar' },
  { name: 'Google Meet', logo: '/images/logos/google-meet.svg', sub: 'Auto-add a video link to every booking' },
  { name: 'Zoom', logo: '/images/logos/zoom.ico', sub: 'Share meeting links automatically' },
  { name: 'Outlook', logo: outlookLogo, sub: 'Sync bookings to your Outlook calendar' },
  { name: 'Razorpay', logo: razorpayLogo, sub: 'Payments, refunds and GST invoices' },
  { name: 'PhonePe', logo: '/images/logos/phonepe.svg', sub: 'Accept instant UPI payments' },
  { name: 'Gmail', logo: '/images/logos/gmail.svg', sub: 'Reminder emails, sent automatically' },
  { name: 'WhatsApp', logo: '/images/logos/whatsapp.svg', sub: 'Reminders and updates on autopilot' },
  { name: 'Client CRM', logo: '/favicon.svg', sub: 'Every client, note and history in one place' },
];

const TRUST = [
  { icon: Lock, value: 'Razorpay', label: 'Every payment signature-verified on our servers' },
  { icon: Landmark, value: 'Hosted in India', label: 'Your booking data runs on servers in Mumbai' },
  { icon: ShieldCheck, value: 'DPDP 2023', label: 'Operated under India’s data protection law' },
  { icon: BadgePercent, value: '0% commission', label: 'On Pro — keep every rupee' },
];

// `lift={false}` turns off the hover lift (the photo-studio page has none).
export function V2Integrations({ wrap, Decor = null, cardClass = 'rounded-[24px] border border-black/[0.08]', lift = true }) {
  return (
    <section id="integrations" className="px-5 py-20 sm:px-8 lg:py-24">
      <div className={`mx-auto ${wrap}`}>
        <div className="mx-auto max-w-2xl text-center">
          <Reveal as="h2" className="font-heading text-[clamp(1.7rem,3.3vw,2.4rem)] font-extrabold leading-tight tracking-[-0.02em]">
            Works with the tools you <span style={{ color: 'var(--v2-heading-accent)' }}>already use.</span>
          </Reveal>
          <Reveal as="p" delay={0.06} className="mt-4 text-[15.5px] leading-relaxed text-black/55">
            Connect your calendar, meetings, payments and WhatsApp. Meeticulous fits how you already work, no rewiring.
          </Reveal>
        </div>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TOOLS.map((t, i) => (
            <Reveal key={t.name} delay={(i % 3) * 0.05}>
              <div className={`group relative flex h-full items-start gap-4 bg-white p-5 ${lift ? 'transition-transform duration-200 hover:-translate-y-0.5' : ''} ${cardClass}`}>
                {Decor && <Decor />}
                <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full" style={{ background: 'var(--v2-wash)' }}>
                  {t.logo
                    ? <img src={t.logo} alt={`${t.name} logo`} loading="lazy" className="h-6 w-6 object-contain" />
                    : <ToolLogo name={t.icon} size={24} className="h-6 w-6" />}
                </span>
                <div className="min-w-0">
                  <h3 className="font-heading text-[15px] font-bold" style={{ margin: 0 }}>{t.name}</h3>
                  <p className="mt-1 text-[13px] leading-relaxed text-black/55">{t.sub}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal delay={0.1} className="mt-10 text-center">
          <Link to="/pricing" className="inline-flex items-center gap-2 rounded-full text-sm font-semibold hover:no-underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose" style={{ color: 'var(--v2-accent-ink)' }}>
            Explore all features <ArrowRight size={16} />
          </Link>
        </Reveal>
      </div>
    </section>
  );
}

/* Two plans from data/plans (the single price source) with a monthly / yearly
   toggle — same plans and maths as the bespoke /for pages. */
// `wrap` (optional) widens pricing to the page's full content width instead of max-w-5xl.
export function V2Pricing({ routeStart, Decor = null, cardClass = 'rounded-[24px] border border-black/[0.08]', lift = true, wrap = 'max-w-5xl' }) {
  const [yearly, setYearly] = useState(true);
  const proPrice = yearly ? PREMIUM_YEARLY_PER_MONTH : PREMIUM_PLAN.monthly;
  const plans = [
    { plan: FREE_PLAN, price: 0, note: `${FREE_PLAN.badge} · free forever`, features: FREE_PLAN.features.slice(0, 5), cta: 'Start free', featured: false },
    {
      plan: PREMIUM_PLAN, price: proPrice,
      note: yearly ? `Billed ₹${PREMIUM_PLAN.yearly.toLocaleString('en-IN')}/year · GST included` : 'Billed monthly · GST included',
      features: PREMIUM_PLAN.features.slice(0, 5), cta: `Go ${PREMIUM_PLAN.name}`, featured: true,
    },
  ];
  return (
    <section id="pricing" className="px-5 py-20 sm:px-8 lg:py-24">
      <div className={`mx-auto ${wrap}`}>
        <div className="mx-auto max-w-2xl text-center">
          <Reveal as="h2" className="font-heading text-[clamp(1.7rem,3.3vw,2.4rem)] font-extrabold leading-tight tracking-[-0.02em]">
            Start free. <span style={{ color: 'var(--v2-accent-ink)' }}>Upgrade when you are ready.</span>
          </Reveal>
          <Reveal as="p" delay={0.06} className="mt-4 text-[15.5px] leading-relaxed text-black/55">
            One price, GST included. No setup fee, no lock-in, cancel anytime.
          </Reveal>
        </div>
        <div className="mt-8 flex items-center justify-center gap-3">
          <button type="button" onClick={() => setYearly(false)} className={`rounded-full text-sm font-semibold focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose ${!yearly ? '' : 'text-black/60'}`}>Monthly</button>
          <button
            type="button" role="switch" aria-checked={yearly} aria-label="Toggle monthly or yearly billing" onClick={() => setYearly((v) => !v)}
            className="relative h-6 w-11 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose"
            style={{ background: yearly ? 'var(--v2-accent-cta)' : 'rgba(0,0,0,0.18)', minHeight: 0 }}
          >
            <span className="absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all" style={{ left: yearly ? '22px' : '2px' }} />
          </button>
          <button type="button" onClick={() => setYearly(true)} className={`rounded-full text-sm font-semibold focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose ${yearly ? '' : 'text-black/60'}`}>
            Yearly <span className="ml-1 rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ background: 'var(--v2-wash)', color: 'var(--v2-accent-ink)' }}>Save {PREMIUM_ANNUAL_SAVE_PCT}%</span>
          </button>
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-2">
          {plans.map(({ plan, price, note, features, cta, featured }, i) => (
            <Reveal key={plan.slug} delay={i * 0.06}>
              <div
                className={`group relative flex h-full flex-col p-7 ${cardClass} ${featured ? '' : 'bg-white'}`}
                style={featured ? { borderColor: 'var(--v2-accent)', borderWidth: 2, background: '#fff' } : undefined}
              >
                {Decor && <Decor />}
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-heading text-lg font-bold" style={{ margin: 0 }}>{plan.name}</h3>
                  {featured && <span className="rounded-full px-3 py-1 text-[11px] font-bold text-white" style={{ background: 'var(--v2-accent-cta)' }}>Most popular</span>}
                </div>
                <p className="mt-1 text-[13.5px] text-black/55">{plan.tagline}</p>
                <div className="mt-6 flex items-end gap-1">
                  <span className="pb-1.5 text-lg font-bold">₹</span>
                  <span className="font-heading text-5xl font-extrabold tracking-tight">{price}</span>
                  <span className="pb-1.5 text-sm text-black/60">/mo</span>
                </div>
                <p className="mt-1.5 text-[12px] font-semibold text-black/60">{note}</p>
                <ul className="mt-6 flex-1 space-y-2.5">
                  {features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-[14px] text-black/70">
                      <Check size={16} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--v2-accent)' }} />{f}
                    </li>
                  ))}
                </ul>
                <Link
                  to={routeStart}
                  className={`mt-7 inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold ${lift ? 'transition-transform hover:-translate-y-0.5' : ''} hover:no-underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose`}
                  style={featured ? { background: 'var(--v2-accent-cta)', color: '#fff' } : { border: '2px solid var(--v2-accent)', color: 'var(--v2-accent-ink)' }}
                >
                  {cta} <ArrowRight size={16} />
                </Link>
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal delay={0.1} className="mt-8 text-center">
          <Link to="/pricing" className="inline-flex items-center gap-2 rounded-full text-sm font-semibold hover:no-underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose" style={{ color: 'var(--v2-accent-ink)' }}>
            Compare every feature <ArrowRight size={16} />
          </Link>
        </Reveal>
      </div>
    </section>
  );
}

export function V2About({ wrap, label, background = 'var(--v2-wash)', Decor = null, cardClass = 'rounded-[24px] border border-black/[0.08]' }) {
  return (
    <section id="about" className="px-5 py-20 sm:px-8 lg:py-24" style={{ background }}>
      <div className={`mx-auto grid ${wrap} items-center gap-10 lg:grid-cols-[1fr_1.1fr] lg:gap-16`}>
        <div className="text-center lg:text-left">
          <Reveal as="h2" className="font-heading text-[clamp(1.7rem,3.3vw,2.4rem)] font-extrabold leading-tight tracking-[-0.02em]">
            Small businesses deserve <span style={{ color: 'var(--v2-heading-accent)' }}>better tools.</span>
          </Reveal>
          <Reveal as="p" delay={0.06} className="mt-5 text-[15.5px] leading-relaxed text-black/60">
            Meeticulous was built to make appointment-based businesses easier to run. Instead of stitching together
            calendars, WhatsApp messages, spreadsheets and payment apps, {label.toLowerCase()} run bookings, payments
            and reminders from one clean platform.
          </Reveal>
          <Reveal delay={0.1} className="mt-8">
            <Link to="/about" className="inline-flex items-center gap-2 rounded-full text-sm font-semibold hover:no-underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose" style={{ color: 'var(--v2-accent-ink)' }}>
              Know more about us <ArrowRight size={16} />
            </Link>
          </Reveal>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {TRUST.map((it, i) => (
            <Reveal key={it.value} delay={i * 0.05}>
              <div className={`group relative flex h-full items-start gap-3 bg-white p-5 ${cardClass}`}>
                {Decor && <Decor />}
                <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full" style={{ background: 'var(--v2-wash)', color: 'var(--v2-accent-ink)' }}>
                  <it.icon size={18} />
                </span>
                <div>
                  <div className="text-[14px] font-bold">{it.value}</div>
                  <div className="mt-0.5 text-[12.5px] leading-snug text-black/55">{it.label}</div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// /compare — hub for every competitor comparison page (/compare/*). Two jobs:
// a real "how do we compare" directory + side-by-side matrix, and crawlable
// static links to each /compare/* page so none is orphaned in the SEO audit.
//
// Competitor facts come ONLY from data/competitors.js (checked against each
// pricing page, with sources). Meeticulous's column comes ONLY from
// data/plans.js. Never type a price or a competitor claim into this file.
import { Link } from 'react-router-dom';
import { ArrowRight, Check, X } from 'lucide-react';
import Seo from '../components/common/Seo';
import { ogCard } from '../config/ogImages';
import { SITE_URL, collectionPageJsonLd, breadcrumbJsonLd } from '../utils/seo';
import { COMPETITOR_LIST, CHECKED_LABEL } from '../data/competitors';
import { FREE_PLAN, PREMIUM_PLAN, PLAN_MATRIX } from '../data/plans';

const TITLE = 'Meeticulous vs the alternatives | Compare';
const DESCRIPTION =
  'How Meeticulous compares to Calendly, Acuity, Setmore, SimplyBook, Zoho Bookings and Topmate: free plans, prices, commission, UPI and WhatsApp reminders, side by side.';

const inr = (n) => `₹${n.toLocaleString('en-IN')}`;
const commission = PLAN_MATRIX.flatMap((g) => g.rows).find((r) => r.label === 'Commission on your bookings');

// One honest line per competitor: what they do, then what's different here.
// Every competitor fact in these lines is backed by data/competitors.js.
const VERDICT = {
  calendly: 'Takes cards through Stripe or PayPal on paid plans. Meeticulous takes UPI too, sends GST invoices and bills in rupees.',
  acuity: 'No free plan, billed in USD. Meeticulous is free to start and takes UPI at booking.',
  setmore: 'A generous free plan, with payments through Square, Stripe or PayPal. Meeticulous takes UPI and bills in rupees.',
  simplybook: 'Its free plan stops at 50 bookings a month, and plans bill in euros. Meeticulous’s free plan has no booking cap.',
  zoho: 'Bills per user in USD and connects to Razorpay. Meeticulous includes UPI payments on its free plan, priced in rupees.',
  topmate: `Takes a cut of every sale. ${PREMIUM_PLAN.name} takes ${commission.premium} commission for a flat ${inr(PREMIUM_PLAN.monthly)} a month.`,
};

// Matrix rows: [label, Meeticulous value, competitor field].
const ROWS = [
  ['Free plan', `Yes: unlimited bookings, ${commission.free} commission`, 'freePlan'],
  ['Paid plan from', `${inr(PREMIUM_PLAN.monthly)} / month (${inr(PREMIUM_PLAN.yearly)} / year)`, 'paidFrom'],
  ['Billing currency', 'INR, GST included', 'currency'],
  ['Commission', `${commission.free} on ${FREE_PLAN.name}, ${commission.premium} on ${PREMIUM_PLAN.name}`, 'commission'],
  ['Taking payments', 'UPI and cards, through Razorpay', 'payments'],
  ['UPI at booking', true, 'upi'],
  ['WhatsApp reminders', `Yes, on ${PREMIUM_PLAN.name}`, 'whatsapp'],
];

// Guides people read while comparing, answered in ₹.
const GUIDES = [
  { title: 'Best appointment booking apps in India', href: '/blog/best-appointment-booking-apps-india' },
  { title: 'Calendly pricing in India (₹, GST, free plan)', href: '/blog/calendly-pricing-india' },
  { title: 'Can you take UPI payments on Calendly?', href: '/blog/calendly-upi-payments' },
  { title: 'Topmate commission and fees explained', href: '/blog/topmate-commission' },
  { title: 'What you keep on each plan: earnings calculator', href: '/earnings-calculator' },
];

function Cell({ value }) {
  if (value === true) return <span className="inline-flex items-center gap-1.5 font-semibold text-ink"><Check size={15} className="text-emerald-600" aria-hidden />Yes</span>;
  if (value === false) return <span className="inline-flex items-center gap-1.5 text-neutral-500"><X size={15} className="text-neutral-400" aria-hidden />No</span>;
  if (value == null) return <span className="text-neutral-400">Not listed</span>;
  return <span>{value}</span>;
}

const favicon = (domain) => `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;

export default function Compare() {
  const items = [
    ...COMPETITOR_LIST.map((c) => ({ name: `Meeticulous vs ${c.name}`, url: c.path })),
    ...GUIDES.map((g) => ({ name: g.title, url: g.href })),
  ];

  return (
    <main className="bg-canvas">
      <Seo
        title={TITLE}
        description={DESCRIPTION}
        image={ogCard('services')}
        canonical={`${SITE_URL}/compare`}
        jsonLd={[
          collectionPageJsonLd({ name: TITLE, description: DESCRIPTION, url: '/compare', items }),
          breadcrumbJsonLd({ items: [{ name: 'Home', path: '/' }, { name: 'Compare', path: '/compare' }] }),
        ]}
      />

      {/* Hero */}
      <section className="px-5 pb-14 pt-14 sm:px-8 lg:pb-20 lg:pt-20">
        <div className="mx-auto max-w-6xl">
          <nav aria-label="Breadcrumb" className="text-xs font-medium text-neutral-500">
            <Link to="/" className="text-neutral-500 hover:text-ink hover:no-underline">Home</Link>
            <span className="mx-2 text-neutral-300">/</span>
            <span className="text-ink">Compare</span>
          </nav>
          <h1 className="mt-5 max-w-3xl font-heading font-extrabold leading-[1.08] tracking-tight text-ink" style={{ fontSize: 'clamp(2.1rem, 3.7vw, 3.2rem)' }}>
            Meeticulous vs the <span className="text-primary-cta">alternatives</span>
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-neutral-600 sm:text-lg">
            An honest, side-by-side look at the booking tools people compare us with. Prices are
            as each company publishes them, checked in {CHECKED_LABEL}.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/become-a-host" className="rounded-[6px] bg-ink px-6 py-3 text-sm font-semibold text-white shadow-[0_8px_30px_rgba(26,26,26,0.12)] hover:no-underline hover:opacity-90">
              Start free
            </Link>
            <a href="#side-by-side" className="rounded-[6px] border border-black/10 bg-white px-6 py-3 text-sm font-semibold text-ink hover:no-underline hover:opacity-90">
              See the side-by-side
            </a>
          </div>
        </div>
      </section>

      {/* Directory */}
      <section aria-labelledby="compare-pages" className="px-5 pb-20 sm:px-8 lg:pb-28">
        <div className="mx-auto max-w-6xl">
          <h2 id="compare-pages" className="sr-only">Comparison pages</h2>
          <ul className="grid gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
            {COMPETITOR_LIST.map((c) => (
              <li key={c.key}>
                <Link
                  to={c.path}
                  className="group flex h-full flex-col rounded-[6px] border border-black/5 bg-white p-6 shadow-[0_8px_30px_rgba(26,26,26,0.04)] transition-colors hover:border-primary/30 hover:no-underline"
                >
                  <span className="flex items-center gap-3">
                    <img src={favicon(c.domain)} alt="" width="28" height="28" loading="lazy" className="h-7 w-7 rounded-full border border-black/5 bg-white p-0.5" />
                    <span className="font-heading text-lg font-bold text-ink">vs {c.name}</span>
                  </span>
                  <span className="mt-3 text-sm leading-relaxed text-neutral-600">{VERDICT[c.key]}</span>
                  <dl className="mt-5 space-y-1.5 border-t border-black/5 pt-4 text-xs">
                    <div className="flex gap-2"><dt className="w-20 shrink-0 text-neutral-500">Free plan</dt><dd className="text-ink">{c.freePlan}</dd></div>
                    <div className="flex gap-2"><dt className="w-20 shrink-0 text-neutral-500">Paid from</dt><dd className="text-ink">{c.paidFrom}</dd></div>
                  </dl>
                  <span className="mt-auto inline-flex items-center gap-1.5 pt-5 text-sm font-semibold text-primary-cta">
                    Read the comparison <ArrowRight size={15} className="transition group-hover:translate-x-0.5" aria-hidden />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Side-by-side matrix */}
      <section id="side-by-side" aria-labelledby="side-by-side-title" className="bg-sand px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-6xl">
          <h2 id="side-by-side-title" className="font-heading text-4xl font-extrabold tracking-tight text-ink sm:text-5xl">
            Side by <span className="text-primary-cta">side</span>
          </h2>
          <p className="mt-4 max-w-2xl text-neutral-600">
            &ldquo;Not listed&rdquo; means the company&rsquo;s pricing page doesn&rsquo;t say. It doesn&rsquo;t mean they can&rsquo;t.
          </p>
          <div className="mt-10 overflow-x-auto rounded-[6px] border border-black/5 bg-white shadow-[0_8px_30px_rgba(26,26,26,0.04)]">
            <table className="w-full min-w-[960px] border-collapse text-left text-sm">
              <caption className="sr-only">Meeticulous compared with six booking tools</caption>
              <thead>
                <tr className="border-b border-black/5">
                  <th scope="col" className="sticky left-0 z-10 bg-white p-4 text-xs font-semibold uppercase tracking-wide text-neutral-500">&nbsp;</th>
                  <th scope="col" className="bg-primary-light p-4 font-heading font-bold text-ink">Meeticulous</th>
                  {COMPETITOR_LIST.map((c) => (
                    <th key={c.key} scope="col" className="p-4 font-heading font-bold text-ink">
                      <Link to={c.path} className="text-ink hover:text-primary-cta hover:no-underline">{c.name}</Link>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROWS.map(([label, bas, field]) => (
                  <tr key={field} className="border-b border-black/5 last:border-0 align-top">
                    <th scope="row" className="sticky left-0 z-10 bg-white p-4 font-semibold text-ink">{label}</th>
                    <td className="bg-primary-light/60 p-4 text-ink"><Cell value={bas} /></td>
                    {COMPETITOR_LIST.map((c) => (
                      <td key={c.key} className="p-4 text-neutral-700"><Cell value={c[field]} /></td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-5 text-xs leading-relaxed text-neutral-500">
            Checked against each company&rsquo;s own pricing page in {CHECKED_LABEL}. Their prices are shown as published, in
            their currency, and may have changed since. Sources:{' '}
            {COMPETITOR_LIST.map((c, i) => (
              <span key={c.key}>
                <a href={c.source} target="_blank" rel="noopener noreferrer nofollow" className="text-neutral-500 underline underline-offset-2 hover:text-ink">{c.name}</a>
                {i < COMPETITOR_LIST.length - 1 ? ', ' : '.'}
              </span>
            ))}
          </p>
        </div>
      </section>

      {/* Guides */}
      <section aria-labelledby="compare-guides" className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-6xl">
          <h2 id="compare-guides" className="font-heading text-2xl font-extrabold text-ink">Pricing and fees, in rupees</h2>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {GUIDES.map(({ title, href }) => (
              <li key={href}>
                <Link
                  to={href}
                  className="group flex h-full items-start justify-between gap-3 rounded-[6px] border border-black/5 bg-white p-5 shadow-[0_8px_30px_rgba(26,26,26,0.04)] transition-colors hover:border-primary/30 hover:no-underline"
                >
                  <span className="font-heading text-[15px] font-bold leading-snug text-ink">{title}</span>
                  <ArrowRight size={16} className="mt-0.5 shrink-0 text-primary-cta transition group-hover:translate-x-0.5" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
          {/* Cross-links so this hub isn't a dead end. */}
          <p className="mt-10 text-sm text-neutral-600">
            Not sure which fits your work?{' '}
            <Link to="/solutions" className="font-semibold text-ink underline underline-offset-2">Find the page built for your profession</Link>{' '}
            or <Link to="/pricing" className="font-semibold text-ink underline underline-offset-2">see pricing</Link>.
          </p>
        </div>
      </section>
    </main>
  );
}

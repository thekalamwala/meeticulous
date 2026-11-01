// /solutions — guest-facing "find an expert" marketplace landing.
//
// Doubles as the SEO discovery hub it replaced: the category grid links every
// /for/:profession page in static HTML, so those pages aren't orphaned in the
// SEO audit (its original job). CATEGORIES is hand-mapped to the /for/* profession
// pages — keep it in sync with scripts/prerender.mjs when a profession is added.
//
// Styling follows the homepage house style (pages/Home.jsx): canvas/ink/primary
// tokens, soft rounded cards, orange uppercase eyebrows, Reveal scroll-ins.
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Scale, Calculator, Stethoscope, BarChart3, Flower2, Laptop, Dumbbell, GraduationCap,
  Camera, CalendarDays, Building2, UserCheck, Zap, ShieldCheck, Heart, Moon, Smile,
  Search, ArrowRight, PlayCircle, Compass, Brain, PersonStanding,
} from 'lucide-react';
import Seo from '../components/common/Seo';
import Reveal from '../components/home/Reveal';
import { ogCard } from '../config/ogImages';
import { SITE_URL, collectionPageJsonLd, breadcrumbJsonLd } from '../utils/seo';

const TITLE = 'Book the Right Expert | Meeticulous';
const DESCRIPTION =
  '1:1 sessions with verified professionals across industries — lawyers, doctors, consultants, salons, freelancers, tutors, photographers and more. Get advice, solve problems, learn new skills, all in one place.';

// label/sublabel from the design; `to` is the crawlable /for/* link.
const CATEGORIES = [
  { icon: Compass,       label: 'Architects & Designers',     sub: 'Architecture & Interior Design Studios', to: '/for/architects' },
  { icon: Scale,         label: 'Lawyers & Advocates',        sub: 'Legal & Litigation Experts',            to: '/for/lawyers' },
  { icon: Calculator,    label: 'Chartered Accountants',      sub: 'Tax, GST & Financial Experts',          to: '/for/chartered-accountants' },
  { icon: Zap,           label: 'Sports & Turf',              sub: 'Turf, Box Cricket & Court Owners',      to: '/for/sports-turf' },
  { icon: Stethoscope,   label: 'Doctors & Clinics',          sub: 'Healthcare Professionals',              to: '/for/doctors' },
  { icon: Smile,         label: 'Dentists & Clinics',         sub: 'Dental & Orthodontic Care',             to: '/for/dentists' },
  { icon: BarChart3,     label: 'Business Consultants',       sub: 'Advisors & Growth Experts',             to: '/for/business-consultant' },
  { icon: Flower2,       label: 'Salons & Spas',              sub: 'Beauty & Wellness',                     to: '/for/salon' },
  { icon: Laptop,        label: 'Freelancers',                sub: 'Designers, Developers, Writers & More', to: '/for/freelancers' },
  { icon: Dumbbell,      label: 'Fitness Trainers & Studios', sub: 'Coaches & Fitness Experts',             to: '/for/fitness' },
  { icon: GraduationCap, label: 'Tutors & Educators',         sub: 'Teachers & Mentors',                    to: '/for/tutors' },
  { icon: Camera,        label: 'Photographers',              sub: 'Photography & Videography',             to: '/for/photographers' },
  { icon: CalendarDays,  label: 'Event Organisers',           sub: 'Planners & Coordinators',               to: '/for/events' },
  { icon: Building2,     label: 'Agencies & Studios',         sub: 'Creative & Professional Teams',         to: '/for/agencies' },
  { icon: Building2,     label: 'Coworking Spaces',           sub: 'Desks, Cabins & Meeting Rooms',         to: '/for/coworking-spaces' },
  { icon: Zap,           label: 'Driving Schools',            sub: 'Lessons & Classes Booked Online',       to: '/for/driving-schools' },
  { icon: Building2,     label: 'Conference Halls',           sub: 'Halls & Event Spaces',                  to: '/for/conference-halls' },
  { icon: Camera,        label: 'Photo Studios',              sub: 'Shoots & Studio Rentals',               to: '/for/photo-studios' },
  { icon: Dumbbell,      label: 'Coaches & Mentors',          sub: 'Paid Coaching Sessions',                to: '/for/coaches' },
  { icon: Laptop,        label: 'Content Creators',           sub: 'Paid 1:1s & Collabs',                   to: '/for/content-creators' },
  { icon: GraduationCap, label: 'Educators',                  sub: 'Classes & Demo Calls',                  to: '/for/educators' },
  { icon: PersonStanding, label: 'Musicians',                 sub: 'Lessons & Gig Bookings',                to: '/for/musicians' },
  { icon: Brain,         label: 'Language Teachers',          sub: 'Lessons & Conversation Classes',        to: '/for/language-teachers' },
  { icon: Moon,          label: 'Astrologers & Consultants',  sub: 'Vedic, Tarot & Numerology',             to: '/for/astrologers' },
  { icon: Brain,         label: 'Therapists & Psychologists', sub: 'Counselling & Mental Health',           to: '/for/therapists' },
  { icon: PersonStanding, label: 'Yoga Instructors',          sub: 'Batches, Classes & Studios',            to: '/for/yoga-instructors' },
];

const CHIPS = ['Career advice', 'Business growth', 'Fitness guidance', 'Creative support'];

// ponytail: static marketing figures, matching the design. Wire to a live stats
// endpoint only if these ever need to be real — not worth it for v1.
const STATS = [
  { value: '50K+',  label: 'Sessions booked' },
  { value: '4.9/5', label: 'Average rating' },
  { value: '10K+',  label: 'Verified experts' },
  { value: '100+',  label: 'Industries' },
];

const WHY = [
  { icon: UserCheck,   title: 'Verified experts',    body: 'Real professionals, real experience.' },
  { icon: Zap,         title: 'Flexible scheduling', body: 'Book at a time that works for you.' },
  { icon: ShieldCheck, title: 'Secure payments',     body: 'Safe, simple and reliable.' },
  { icon: Heart,       title: 'For every goal',      body: 'Learn, solve, grow — your way.' },
];

export default function Solutions() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  const goSearch = (e) => {
    e.preventDefault();
    const q = query.trim();
    navigate(q ? `/explore?q=${encodeURIComponent(q)}` : '/explore');
  };

  const jsonLdItems = CATEGORIES.map((c) => ({ name: c.label, url: c.to }));

  return (
    <main className="overflow-x-clip bg-canvas text-ink">
      <Seo
        title={TITLE}
        description={DESCRIPTION}
        image={ogCard('services')}
        canonical={`${SITE_URL}/solutions`}
        jsonLd={[
          collectionPageJsonLd({ name: TITLE, description: DESCRIPTION, url: '/solutions', items: jsonLdItems }),
          breadcrumbJsonLd({ items: [{ name: 'Home', path: '/' }, { name: 'Solutions', path: '/solutions' }] }),
        ]}
      />

      {/* ════════════════ HERO ════════════════ */}
      <section className="px-5 pb-16 pt-10 sm:px-8 lg:pb-24 lg:pt-16">
        <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
          <div>
            <Reveal as="p" className="text-sm font-medium uppercase tracking-[0.2em] text-primary">
              Experts. On your terms.
            </Reveal>
            <Reveal as="h1" delay={0.05} className="mt-4 text-[clamp(2rem,7vw,2.7rem)] font-bold leading-[1.05] tracking-[-0.03em] text-ink sm:text-[3.4rem] lg:text-[3.9rem]">
              Book the right expert for your next big step.
            </Reveal>
            <Reveal as="p" delay={0.12} className="mt-5 max-w-md text-base leading-relaxed text-neutral-500 sm:text-lg">
              1:1 sessions with verified professionals across industries. Get advice, solve
              problems, learn new skills — all in one place.
            </Reveal>

            <Reveal delay={0.18}>
              <form
                onSubmit={goSearch}
                role="search"
                className="relative mt-8 flex max-w-xl items-center rounded-full border border-black/5 bg-white p-2 shadow-[0_12px_40px_-12px_rgba(26,26,26,0.18)] focus-within:border-primary"
              >
                <Search size={20} className="pointer-events-none ml-3 shrink-0 text-neutral-400" aria-hidden="true" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="What do you need help with?"
                  aria-label="What do you need help with?"
                  className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-base text-ink placeholder:text-neutral-400 focus:outline-none"
                />
                <button
                  type="submit"
                  className="shrink-0 rounded-full bg-ink px-6 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                >
                  Search
                </button>
              </form>
            </Reveal>

            <Reveal delay={0.24} className="mt-5 flex flex-wrap gap-2">
              {CHIPS.map((chip) => (
                <Link
                  key={chip}
                  to={`/explore?q=${encodeURIComponent(chip)}`}
                  className="rounded-full border border-black/5 bg-white px-4 py-1.5 text-sm text-neutral-600 transition-colors hover:border-primary/30 hover:text-primary hover:no-underline"
                >
                  {chip}
                </Link>
              ))}
            </Reveal>
          </div>

          {/* Brand panel + sticky note */}
          <Reveal delay={0.1} className="relative hidden lg:block">
            <div className="relative mx-auto flex aspect-[4/3] w-full max-w-md items-center justify-center overflow-hidden rounded-[2rem] bg-sand shadow-[0_40px_90px_-25px_rgba(26,26,26,0.32)] ring-1 ring-black/5">
              <img
                src="/brand/meeticulous-icon.svg"
                alt="Meeticulous"
                className="h-auto w-2/3 max-w-[16rem]"
                loading="eager"
              />
            </div>
            <div className="absolute -right-3 -top-5 max-w-[13rem] rotate-3 rounded-2xl bg-white px-4 py-3 shadow-[0_18px_40px_-16px_rgba(26,26,26,0.4)] ring-1 ring-black/5">
              <p className="font-heading text-sm font-bold leading-snug text-ink">
                Good Conversations Create Brighter Tomorrows
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ════════════════ CATEGORY GRID ════════════════ */}
      <section className="px-5 py-16 sm:px-8 lg:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <Reveal as="p" className="text-sm font-medium uppercase tracking-[0.2em] text-primary">
                Choose your path
              </Reveal>
              <Reveal as="h2" delay={0.05} className="mt-3 max-w-xl text-4xl leading-[1.1] text-ink sm:text-5xl">
                Explore professionals by category
              </Reveal>
            </div>
            <Reveal as="p" delay={0.1} className="max-w-sm text-neutral-500">
              From industry veterans to niche specialists, find the right expert for your goals.
            </Reveal>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {CATEGORIES.map(({ icon: Icon, label, sub, to }, i) => (
              <Reveal key={to} delay={(i % 5) * 0.05}>
                <Link
                  to={to}
                  className="group flex h-full flex-col rounded-2xl border border-black/5 bg-white p-6 shadow-[0_8px_30px_rgba(26,26,26,0.04)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_40px_-16px_rgba(26,26,26,0.28)] hover:no-underline"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon size={22} aria-hidden="true" />
                  </span>
                  <span className="mt-4 block font-heading font-bold leading-snug text-ink">{label}</span>
                  <span className="mt-1 block flex-1 text-sm text-neutral-500">{sub}</span>
                  <ArrowRight size={18} className="mt-4 text-neutral-400 transition-all group-hover:translate-x-1 group-hover:text-primary" aria-hidden="true" />
                </Link>
              </Reveal>
            ))}
          </div>

          <div className="mt-8 flex justify-end">
            <Link
              to="/services"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink hover:text-primary hover:no-underline"
            >
              View all categories <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>

          {/* Cross-links keep this page a live SEO hub, not a dead end: /compare
              (competitor hub), /services (full directory), and the India-specific
              doctors page — the one /for/* slug that has no card above. */}
          <p className="mt-6 text-sm text-neutral-500">
            Comparing tools instead?{' '}
            <Link to="/compare" className="font-semibold text-ink underline underline-offset-2 hover:text-primary">
              See how Meeticulous stacks up
            </Link>{' '}
            — browse{' '}
            <Link to="/services" className="font-semibold text-ink underline underline-offset-2 hover:text-primary">
              services by profession
            </Link>, or find a{' '}
            <Link to="/for/doctors" className="font-semibold text-ink underline underline-offset-2 hover:text-primary">
              doctor in India
            </Link>, or see our{' '}
            <Link to="/appointment-booking-software" className="font-semibold text-ink underline underline-offset-2 hover:text-primary">
              appointment booking software
            </Link>.
          </p>
        </div>
      </section>

      {/* ════════════════ STATS BAND ════════════════ */}
      <section className="bg-sand px-5 py-16 sm:px-8 lg:py-20">
        <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[1fr_1.4fr]">
          <div>
            <Reveal as="p" className="text-sm font-medium uppercase tracking-[0.2em] text-primary">
              Trusted by learners, creators, founders and more
            </Reveal>
            <Reveal as="h2" delay={0.05} className="mt-3 text-4xl leading-[1.1] text-ink sm:text-5xl">
              Real people.<br />Real progress.
            </Reveal>
          </div>
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            {STATS.map(({ value, label }, i) => (
              <Reveal key={label} delay={i * 0.08}>
                <div className="font-heading text-4xl font-extrabold tracking-tight text-ink sm:text-[2.6rem]">{value}</div>
                <p className="mt-2 text-sm text-neutral-500">{label}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════ WHY ════════════════ */}
      <section className="px-5 py-16 sm:px-8 lg:py-24">
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <Reveal as="p" className="text-sm font-medium uppercase tracking-[0.2em] text-primary">
              Why Meeticulous
            </Reveal>
            <Reveal as="h2" delay={0.05} className="mt-3 max-w-md text-4xl leading-[1.1] text-ink sm:text-5xl">
              More than a booking — it&rsquo;s a better way to grow.
            </Reveal>
          </div>
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
            {WHY.map(({ icon: Icon, title, body }, i) => (
              <Reveal key={title} delay={(i % 2) * 0.07}>
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon size={22} aria-hidden="true" />
                </span>
                <h3 className="mt-4 font-heading text-lg font-bold text-ink">{title}</h3>
                <p className="mt-1.5 text-sm text-neutral-500">{body}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════ FINAL CTA ════════════════ */}
      <section className="px-5 pb-20 sm:px-8 lg:pb-28">
        <div className="mx-auto max-w-6xl">
          <div className="overflow-hidden rounded-[2rem] bg-sand p-8 shadow-[0_8px_30px_rgba(26,26,26,0.04)] sm:p-12">
            <div className="max-w-xl">
              <Reveal as="p" className="text-sm font-medium uppercase tracking-[0.2em] text-primary">
                Ready to get started?
              </Reveal>
              <Reveal as="h2" delay={0.05} className="mt-3 text-4xl leading-[1.1] text-ink sm:text-5xl">
                Book your first session today.
              </Reveal>
              <Reveal as="p" delay={0.1} className="mt-4 text-neutral-500">
                Join thousands who are learning, growing and doing more — one conversation at a time.
              </Reveal>
              <Reveal delay={0.16} className="mt-7 flex flex-wrap items-center gap-3">
                <Link
                  to="/explore"
                  className="inline-flex items-center rounded-full bg-ink px-7 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 hover:no-underline"
                >
                  Get Started
                </Link>
                <Link
                  to="/how-it-works"
                  className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-6 py-3 text-sm font-semibold text-ink transition-colors hover:border-black/20 hover:no-underline"
                >
                  <PlayCircle size={18} aria-hidden="true" /> Watch how it works
                </Link>
              </Reveal>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

/**
 * WallOfLove.jsx — social proof wall.
 * Route: /wall-of-love (renders inside app chrome — global <Navbar/>).
 *
 * Two honest sources only:
 *   1. Verified reviews — signed-in accounts via /submit-review, admin-approved,
 *      published with consent (GET /api/platform-reviews).
 *   2. Host stories — client/src/data/wallOfLove.js: real hosts, quotes written
 *      with them and approved word-for-word. Shown as plain cards, never styled
 *      as X / Google / LinkedIn / Instagram posts (they weren't posted there),
 *      with no stars, likes or other engagement numbers.
 * Do not hardcode invented testimonials here; edit the data file.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, BadgeCheck } from 'lucide-react';
import Seo from '../components/common/Seo';
import { getPlatformReviews } from '../services/api';
import { collectionPageJsonLd, breadcrumbJsonLd, SITE_URL } from '../utils/seo';
import { WALL_STORIES } from '../data/wallOfLove';

// Avatar tint → our accent tokens (design-tokens.css / tailwind c-*).
const TINT = {
  orange: 'bg-primary-light text-primary',
  pink: 'bg-c-pink/10 text-c-pink',
  green: 'bg-c-emerald/10 text-c-emerald',
  blue: 'bg-c-blue/10 text-c-blue',
};

function Avatar({ children, tint, size = 'h-9 w-9 text-[11px]' }) {
  return (
    <span className={`grid ${size} shrink-0 place-items-center rounded-full font-heading font-bold ${TINT[tint]}`}>
      {children}
    </span>
  );
}

const CARD = 'rounded-xl border-2 border-ink/10 bg-surface shadow-sm transition hover:-translate-y-0.5 hover:shadow-md';

// Host story — a real host's approved quote. Plain card on purpose: no platform
// branding, stars or engagement numbers (see the header note).
function StoryCard({ r }) {
  return (
    <figure className={`flex min-h-[200px] flex-col p-5 ${CARD}`}>
      <blockquote className="text-[13px] leading-relaxed text-ink">&ldquo;{r.text}&rdquo;</blockquote>
      <figcaption className="mt-auto flex items-center gap-2.5 pt-5">
        <Avatar tint={r.tint}>{r.avatar}</Avatar>
        <div className="min-w-0 flex-1">
          <div className="truncate font-heading text-[13px] font-bold text-ink">{r.name}</div>
          <div className="truncate text-[11px] text-muted">{r.role}</div>
        </div>
      </figcaption>
    </figure>
  );
}

// Verified review — submitted by a signed-in account at /submit-review, approved
// by an admin, and published with the author's consent (v3.185).
function VerifiedReviewCard({ r }) {
  const initials = (r.name || '?').split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  const label = r.reviewer_role === 'host' ? 'Verified host' : 'Verified guest';
  const when = new Date(r.created_at).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
  return (
    <article className={`flex min-h-[240px] flex-col p-5 ${CARD}`}>
      <div className="flex items-center gap-2.5">
        {r.avatar
          ? <img src={r.avatar} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" loading="lazy" />
          : <Avatar tint="orange">{initials}</Avatar>}
        <div className="min-w-0 flex-1">
          <div className="truncate font-heading text-[13px] font-bold text-ink">
            {r.username ? <Link to={`/${r.username}`} className="hover:underline">{r.name}</Link> : r.name}
          </div>
          <div className="truncate text-[11px] text-muted">{r.profession || label}</div>
        </div>
      </div>
      <div className="mt-4 text-sm tracking-wide text-maroon" aria-label={`${r.rating} out of 5`}>
        {'★'.repeat(r.rating)}<span className="text-ink/20">{'★'.repeat(5 - r.rating)}</span>
      </div>
      {r.title && <p className="mt-2 font-heading text-[14px] font-bold text-ink">{r.title}</p>}
      <p className="mt-2 whitespace-pre-line text-[13px] leading-relaxed text-ink">{r.body}</p>
      <div className="mt-auto flex items-center gap-1.5 pt-5 text-[11px] text-muted">
        <BadgeCheck className="h-3.5 w-3.5 text-maroon" />{label} · {when}
      </div>
    </article>
  );
}

function VerifiedReviews({ data }) {
  return (
    <section className="mb-16">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-heading text-xl font-bold tracking-tight text-ink sm:text-2xl">Verified reviews</h2>
          <p className="mt-1 text-[12px] text-muted">
            {data.average} / 5 from {data.count} signed-in host{data.count !== 1 ? 's' : ''} and guests
          </p>
        </div>
        <Link to="/submit-review" className="mt-btn mt-btn--secondary mt-btn--s hover:no-underline">Leave a review</Link>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {data.reviews.map((r) => <VerifiedReviewCard key={r.id} r={r} />)}
      </div>
    </section>
  );
}

export default function WallOfLove() {
  const [verified, setVerified] = useState(null);
  useEffect(() => {
    getPlatformReviews().then(({ data }) => setVerified(data)).catch(() => { /* wall still renders */ });
  }, []);

  return (
    <div className="min-h-screen bg-canvas px-4 pb-24 pt-12 sm:pt-16">
      <Seo
        title="Wall of Love — Meeticulous"
        description="Verified reviews and real stories from Meeticulous hosts who publish services, get booked, and get paid."
        canonical={`${SITE_URL}/wall-of-love`}
        jsonLd={[
          collectionPageJsonLd({
            name: 'Wall of Love — Meeticulous',
            description: 'Real words from Meeticulous hosts who publish services, get booked, and get paid.',
            url: '/wall-of-love',
          }),
          breadcrumbJsonLd({ items: [{ name: 'Home', path: '/' }, { name: 'Wall of Love', path: '/wall-of-love' }] }),
        ]}
      />

      {/* Hero */}
      <header className="mx-auto max-w-2xl text-center">
        <span className="inline-flex items-center gap-2 rounded-full bg-primary-light px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-primary">
          <Heart className="h-4 w-4 fill-primary" />
          Wall of Love
        </span>
        <h1 className="mt-5 font-heading text-4xl font-extrabold tracking-tight text-ink sm:text-5xl">
          Loved by the hosts who use it every day.
        </h1>
        <p className="mt-4 text-base text-muted">
          Real stories from real Meeticulous hosts who save time, get more bookings and grow their business.
        </p>
      </header>

      {/* Wall */}
      <main className="mx-auto mt-14 max-w-6xl">
        {verified?.count > 0 && <VerifiedReviews data={verified} />}

        <section>
          <div className="mb-6">
            <h2 className="font-heading text-xl font-bold tracking-tight text-ink sm:text-2xl">Host stories</h2>
            <p className="mt-1 text-[12px] text-muted">Written with each host and published with their approval.</p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {WALL_STORIES.map((r) => <StoryCard key={r.name} r={r} />)}
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="relative mt-20 rounded-xl border-2 border-ink/10 bg-sand px-8 pb-10 pt-12 text-center">
          <Heart className="absolute -top-5 left-1/2 h-9 w-9 -translate-x-1/2 fill-primary text-primary" />
          <h2 className="font-heading text-2xl font-bold tracking-tight text-ink">Your success is our favorite story.</h2>
          <p className="mt-2 text-sm text-muted">Join amazing hosts growing their business with Meeticulous.</p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <Link to="/become-a-host" className="inline-flex min-h-10 items-center justify-center rounded bg-primary px-6 text-xs font-bold text-white transition hover:bg-primary-dark">
              Start Free
            </Link>
            <Link to="/pricing" className="inline-flex min-h-10 items-center justify-center rounded border-2 border-ink/10 bg-surface px-6 text-xs font-bold text-ink transition hover:border-ink/20">
              Book a Demo
            </Link>
            <Link to="/submit-review" className="inline-flex min-h-10 items-center justify-center rounded border-2 border-ink/10 bg-surface px-6 text-xs font-bold text-ink transition hover:border-ink/20">
              Leave a review
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}

/**
 * WallOfLove.jsx — multi-platform social-proof wall.
 * Route: /wall-of-love (renders inside app chrome — global <Navbar/>).
 *
 * Content comes from client/src/data/wallOfLove.js — REAL, CONSENTED hosts only.
 * YouTube is intentionally rendered as empty placeholder boxes until real video
 * stories exist (no fabricated videos). Do not hardcode invented testimonials
 * here; edit the data file.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Heart, MessageCircle, Repeat2, ThumbsUp, Share2, Send, Bookmark, Play, ArrowRight,
} from 'lucide-react';
import Seo from '../components/common/Seo';
import { collectionPageJsonLd, breadcrumbJsonLd, SITE_URL } from '../utils/seo';
import {
  WALL_TWEETS, WALL_GOOGLE, WALL_LINKEDIN, WALL_INSTAGRAM, WALL_YOUTUBE_PLACEHOLDERS,
} from '../data/wallOfLove';

const BRAND = (name) => `/assets/brands/${name}.svg`;

// Avatar tint → our accent tokens (design-tokens.css / tailwind c-*).
const TINT = {
  orange: 'bg-primary-light text-primary',
  pink: 'bg-c-pink/10 text-c-pink',
  green: 'bg-c-emerald/10 text-c-emerald',
  blue: 'bg-c-blue/10 text-c-blue',
};

const PLATFORMS = [
  { key: 'twitter', label: 'Twitter / X', brand: 'x' },
  { key: 'google', label: 'Google', brand: 'google' },
  { key: 'linkedin', label: 'LinkedIn', brand: 'linkedin' },
  { key: 'youtube', label: 'YouTube', brand: 'youtube' },
  { key: 'instagram', label: 'Instagram', brand: 'instagram' },
];

function Avatar({ children, tint, size = 'h-9 w-9 text-[11px]' }) {
  return (
    <span className={`grid ${size} shrink-0 place-items-center rounded-full font-heading font-bold ${TINT[tint]}`}>
      {children}
    </span>
  );
}

function UserRow({ r, sub }) {
  return (
    <div className="flex items-center gap-2.5">
      <Avatar tint={r.tint}>{r.avatar}</Avatar>
      <div className="min-w-0 flex-1">
        <div className="truncate font-heading text-[13px] font-bold text-ink">{r.name}</div>
        <div className="truncate text-[11px] text-muted">{sub}</div>
      </div>
    </div>
  );
}

const CARD = 'rounded-xl border-2 border-ink/10 bg-surface shadow-sm transition hover:-translate-y-0.5 hover:shadow-md';

function TweetCard({ r }) {
  return (
    <article className={`flex min-h-[280px] flex-col p-5 ${CARD}`}>
      <div className="flex items-start justify-between gap-4">
        <UserRow r={r} sub={r.handle} />
        <img src={BRAND('x')} alt="X" className="h-5 w-5 shrink-0" />
      </div>
      <p className="mt-5 text-[13px] leading-relaxed text-ink">{r.text}</p>
      <div className="mt-auto pt-5 text-[11px] text-muted">{r.date}</div>
      <div className="mt-3 flex items-center gap-6 border-t-2 border-ink/5 pt-3 text-[11px] text-muted">
        <span className="inline-flex items-center gap-1.5"><MessageCircle className="h-3.5 w-3.5" />{r.stats.r}</span>
        <span className="inline-flex items-center gap-1.5"><Repeat2 className="h-3.5 w-3.5" />{r.stats.rt}</span>
        <span className="inline-flex items-center gap-1.5"><Heart className="h-3.5 w-3.5" />{r.stats.l}</span>
      </div>
    </article>
  );
}

function GoogleCard({ r }) {
  return (
    <article className={`flex min-h-[280px] flex-col p-5 ${CARD}`}>
      <div className="flex items-start justify-between gap-4">
        <UserRow r={r} sub={r.meta} />
        <img src={BRAND('google')} alt="Google" className="h-5 w-5 shrink-0" />
      </div>
      <div className="mt-4 flex items-center gap-2">
        <span className="text-sm tracking-wide text-secondary">{'★★★★★'}</span>
        <span className="text-[11px] text-muted">{r.age}</span>
      </div>
      <p className="mt-3 text-[13px] leading-relaxed text-ink">{r.text}</p>
      <div className="mt-auto flex justify-between pt-5 text-[11px] text-muted">
        <span className="inline-flex items-center gap-1.5"><ThumbsUp className="h-3.5 w-3.5" />{r.helpful}</span>
        <span className="inline-flex items-center gap-1.5"><Share2 className="h-3.5 w-3.5" />Share</span>
      </div>
    </article>
  );
}

function LinkedinCard({ r }) {
  return (
    <article className={`flex min-h-[330px] flex-col p-5 ${CARD}`}>
      <div className="flex items-start justify-between gap-4">
        <UserRow r={{ ...r, name: `${r.name} · 2nd` }} sub={r.role} />
        <img src={BRAND('linkedin')} alt="LinkedIn" className="h-5 w-5 shrink-0" />
      </div>
      <p className="mt-5 whitespace-pre-line text-[13px] leading-relaxed text-ink">{r.text}</p>
      <div className="mt-auto flex justify-between pt-5 text-[11px] text-muted">
        <div className="flex items-center gap-1.5">
          <span className="grid h-4 w-4 place-items-center rounded-full bg-c-blue text-[7px] text-white">{'♥'}</span>
          <span className="grid h-4 w-4 place-items-center rounded-full bg-c-pink text-[7px] text-white">{'♥'}</span>
          <span>{r.likes}</span>
        </div>
        <span>{r.comments} comments</span>
      </div>
      <div className="mt-3 flex justify-between border-t-2 border-ink/5 pt-3 text-[11px] font-medium text-muted">
        <span>Like</span><span>Comment</span><span>Share</span>
      </div>
    </article>
  );
}

// YouTube placeholder — an empty, clearly-unpopulated tile. No fabricated video.
// Rendered until real video stories exist (see WALL_YOUTUBE_PLACEHOLDERS).
function YoutubePlaceholder() {
  return (
    <div className="group block" aria-hidden="true">
      <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-ink/10 bg-ink/[0.03]">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-ink/5 text-muted">
          <Play className="h-5 w-5" />
        </span>
      </div>
      <div className="pt-3">
        <div className="h-3 w-3/4 rounded bg-ink/5" />
        <div className="mt-2 h-2.5 w-1/2 rounded bg-ink/5" />
      </div>
    </div>
  );
}

function InstagramCard({ r }) {
  return (
    <article className={`overflow-hidden ${CARD}`}>
      <div className="flex h-12 items-center justify-between gap-2.5 px-3.5">
        <div className="flex items-center gap-2.5">
          <Avatar tint={r.tint} size="h-7 w-7 text-[8px]">{r.avatar}</Avatar>
          <span className="font-heading text-[11px] font-bold text-ink">{r.handle}</span>
        </div>
        <img src={BRAND('instagram')} alt="Instagram" className="h-5 w-5 shrink-0" />
      </div>
      <div className={`flex aspect-[1/0.83] items-center p-6 ${r.bg}`}>
        <div className="max-w-[85%] whitespace-pre-line font-heading text-xl font-bold leading-tight">
          {r.copy}
          <span className={`mt-2.5 block text-[10px] font-medium ${r.tag}`}>@bookasloth</span>
        </div>
      </div>
      <div className="flex items-center justify-between px-4 py-3.5">
        <div className="flex gap-3 text-ink">
          <Heart className="h-[18px] w-[18px]" /><MessageCircle className="h-[18px] w-[18px]" /><Send className="h-[18px] w-[18px]" />
        </div>
        <Bookmark className="h-[18px] w-[18px] text-ink" />
      </div>
      <div className="px-4 pb-3.5 text-[11px] font-medium text-ink">{r.likes} likes</div>
    </article>
  );
}

function Section({ platform, children }) {
  return (
    <section className="mt-16 first:mt-0">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <img src={BRAND(platform.brand)} alt={platform.label} className="h-7 w-7" />
          <h2 className="font-heading text-xl font-bold tracking-tight text-ink sm:text-2xl">{platform.label}</h2>
        </div>
        {platform.key === 'youtube' ? (
          <span className="text-[11px] font-medium text-muted">Video stories coming soon</span>
        ) : (
          <a href="#" className="inline-flex items-center gap-2 text-[11px] font-medium text-muted transition hover:text-ink">
            <span className="hidden sm:inline">View more on {platform.label}</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </a>
        )}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
    </section>
  );
}

const RENDERERS = {
  twitter: () => WALL_TWEETS.map((r) => <TweetCard key={r.name} r={r} />),
  google: () => WALL_GOOGLE.map((r) => <GoogleCard key={r.name} r={r} />),
  linkedin: () => WALL_LINKEDIN.map((r) => <LinkedinCard key={r.name} r={r} />),
  youtube: () => Array.from({ length: WALL_YOUTUBE_PLACEHOLDERS }, (_, i) => <YoutubePlaceholder key={i} />),
  instagram: () => WALL_INSTAGRAM.map((r) => <InstagramCard key={r.handle} r={r} />),
};

export default function WallOfLove() {
  const [filter, setFilter] = useState('all');
  const visible = PLATFORMS.filter((p) => filter === 'all' || filter === p.key);

  return (
    <div className="min-h-screen bg-canvas px-4 pb-24 pt-12 sm:pt-16">
      <Seo
        title="Wall of Love — Meeticulous"
        description="Real words from Meeticulous hosts who publish services, get booked, and get paid — across X, Google, LinkedIn and Instagram."
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

      {/* Filters */}
      <div className="mx-auto mt-10 flex max-w-4xl flex-nowrap items-center justify-start gap-2 overflow-x-auto pb-2 [scrollbar-width:none] sm:flex-wrap sm:justify-center sm:overflow-visible [&::-webkit-scrollbar]:hidden">
        <button
          type="button"
          onClick={() => setFilter('all')}
          className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-full border-2 bg-surface px-4 font-heading text-xs font-semibold text-ink transition hover:-translate-y-0.5 ${filter === 'all' ? 'border-primary shadow-sm' : 'border-ink/10'}`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          All
        </button>
        {PLATFORMS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => setFilter(p.key)}
            className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-full border-2 bg-surface px-4 font-heading text-xs font-semibold text-ink transition hover:-translate-y-0.5 ${filter === p.key ? 'border-primary shadow-sm' : 'border-ink/10'}`}
          >
            <img src={BRAND(p.brand)} alt="" className="h-4 w-4" />
            {p.label}
          </button>
        ))}
      </div>

      {/* Wall */}
      <main className="mx-auto mt-14 max-w-6xl">
        {visible.map((p) => (
          <Section key={p.key} platform={p}>{RENDERERS[p.key]()}</Section>
        ))}

        {/* Bottom CTA */}
        <section className="relative mt-20 rounded-xl border-2 border-ink/10 bg-sand px-8 pb-10 pt-12 text-center">
          <Heart className="absolute -top-5 left-1/2 h-9 w-9 -translate-x-1/2 fill-primary text-primary" />
          <h2 className="font-heading text-2xl font-bold tracking-tight text-ink">Your success is our favorite story.</h2>
          <p className="mt-2 text-sm text-muted">Join amazing hosts growing their business with Meeticulous.</p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <Link to="/be-a-sloth" className="inline-flex min-h-10 items-center justify-center rounded bg-primary px-6 text-xs font-bold text-white transition hover:bg-primary-dark">
              Start Free
            </Link>
            <Link to="/pricing" className="inline-flex min-h-10 items-center justify-center rounded border-2 border-ink/10 bg-surface px-6 text-xs font-bold text-ink transition hover:border-ink/20">
              Book a Demo
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}

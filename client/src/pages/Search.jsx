/**
 * Search.jsx — Google-style launcher for Meeticulous.
 * Route: /search  ·  Standalone full-bleed (own header + footer, app chrome hidden).
 *
 * DESIGN-ONLY: no live search backend. The bar submits to /explore?q= so the
 * existing Explore page does the real work; the pill shortcuts link to real routes.
 * Styled after the founder reference — orange pill bar, sloth hero, quick pills —
 * adapted to our tokens (border-2, rounded, brand #0079C1).
 */
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Search as SearchIcon, Sparkles, User, Briefcase, MapPin, Calendar, Tag,
} from 'lucide-react';
import Seo from '../components/common/Seo';
import { useHideChrome } from '../context/ChromeContext';
import { FEATURED } from '../data/moments';

// Discovery pills. Each links to a real route so the launcher is usable today.
const PILLS = [
  { icon: User,      label: 'Find a Host',      to: '/explore' },
  { icon: Briefcase, label: 'Explore Services', to: '/explore' },
  { icon: MapPin,    label: 'Nearby',           to: '/explore' },
  { icon: Calendar,  label: 'My Bookings',      to: '/my-bookings' },
  { icon: Tag,       label: 'Pricing plans',    to: '/pricing' },
];

const FOOTER_LEFT = [
  { label: 'Explore', to: '/explore' },
  { label: 'Pricing', to: '/pricing' },
  { label: 'Blog',    to: '/blog' },
];
const FOOTER_RIGHT = [
  { label: 'Privacy', to: '/privacy' },
  { label: 'Terms',   to: '/terms' },
  { label: 'Help',    to: '/help' },
];

export default function Search() {
  useHideChrome(); // full-bleed: drop the global navbar + footer
  const navigate = useNavigate();
  const [q, setQ] = useState('');

  const submit = (e) => {
    e.preventDefault();
    const v = q.trim();
    if (!v) { navigate('/moments'); return; }
    navigate(`/explore?q=${encodeURIComponent(v)}`);
  };

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-surface">
      <Seo
        title="Search — Meeticulous"
        description="Search hosts and services, or jump straight to explore, nearby, and your bookings on Meeticulous."
        robots="noindex"
      />

      {/* Header */}
      <header className="flex shrink-0 items-center justify-between px-6 py-4 sm:px-8">
        <Link to="/" aria-label="Meeticulous home">
          <img src="/favicon.svg" alt="Meeticulous" className="h-10 w-10" />
        </Link>
        <Link
          to="/login"
          className="rounded-xl border-2 border-primary px-6 py-2 text-sm font-semibold text-primary transition hover:bg-primary-light"
        >
          Login
        </Link>
      </header>

      {/* Main */}
      <main className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 py-4">
        {/* Featured moment — original image ratio. Width capped to 75% of the search
            bar on mobile, 50% on desktop; max-h keeps the page within 100dvh. */}
        <div className="mb-5 flex w-full max-w-3xl justify-center">
          <Link to={`/moments/${FEATURED.slug}`} title={FEATURED.title} aria-label={FEATURED.title} className="block w-3/4 sm:w-1/2">
            <img
              src={FEATURED.image}
              alt={FEATURED.title}
              className="mx-auto h-auto max-h-[32vh] w-full rounded-xl object-contain"
            />
          </Link>
        </div>

        <h1 className="mb-8 text-center font-heading text-2xl font-semibold text-muted sm:text-3xl">
          Search. Discover. Simplify.
        </h1>

        {/* Search bar */}
        <form onSubmit={submit} className="w-full max-w-3xl">
          <div className="flex items-center gap-3 rounded-full bg-surface py-2 pl-6 pr-2 shadow-[0_6px_28px_rgba(0,0,0,0.10)]">
            <SearchIcon className="h-6 w-6 shrink-0 text-muted" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="What are you looking for?"
              aria-label="Search Meeticulous"
              className="min-w-0 flex-1 border-0 bg-transparent py-2 text-lg text-ink outline-none focus:shadow-none placeholder:text-muted sm:text-xl"
            />
            <button
              type="button"
              onClick={submit}
              className="hidden shrink-0 items-center gap-1.5 px-2 text-sm font-medium text-muted transition hover:text-primary sm:flex"
            >
              <Sparkles className="h-4 w-4 text-primary" />
              AI Mode
            </button>
            <button
              type="submit"
              aria-label="Search"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-surface transition hover:brightness-95"
            >
              <SearchIcon className="h-5 w-5" />
            </button>
          </div>
        </form>

        {/* Discovery pills */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3 sm:gap-4">
          {PILLS.map(({ icon: Icon, label, to }) => (
            <Link
              key={label}
              to={to}
              className="group flex items-center gap-2 rounded-full border-2 border-ink/10 bg-surface px-5 py-2.5 text-sm text-ink transition hover:border-primary/40"
            >
              <Icon className="h-4 w-4 text-primary transition group-hover:fill-current" />
              {label}
            </Link>
          ))}
        </div>

        {/* AI link */}
        <Link to="/explore" className="mt-8 flex items-center gap-1.5 whitespace-nowrap text-xs text-muted transition hover:text-primary">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span className="font-semibold text-ink">AI Mode:</span>
          Get instant answers with AI →
        </Link>
      </main>

      {/* Footer */}
      <footer className="flex shrink-0 flex-col items-center justify-between gap-3 border-t-2 border-ink/10 px-6 py-4 text-sm sm:flex-row sm:px-9">
        <nav className="flex gap-8">
          {FOOTER_LEFT.map(({ label, to }) => (
            <Link key={label} to={to} className="text-muted transition hover:text-ink">{label}</Link>
          ))}
        </nav>
        <nav className="flex gap-8">
          {FOOTER_RIGHT.map(({ label, to }) => (
            <Link key={label} to={to} className="text-muted transition hover:text-ink">{label}</Link>
          ))}
        </nav>
      </footer>
    </div>
  );
}

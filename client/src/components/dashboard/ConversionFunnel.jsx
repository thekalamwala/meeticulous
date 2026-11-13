import { Link } from 'react-router-dom';
import { Eye, CalendarCheck, TrendingUp } from 'lucide-react';
import { buttonClasses } from './ui';
import { PREMIUM_PLAN } from '../../data/plans';

/**
 * ConversionFunnel — a Pro-gated "profile views → bookings → conversion %" stat for
 * the dashboard home. Builds on the v3.205 profile_views counter + the host's own
 * bookings count (no new data). Free hosts see a blurred teaser + upgrade overlay
 * (the same pattern as ClientsList/Products); Pro hosts see their real numbers.
 *
 * Props: views (number), bookings (number), isFree (bool).
 */
const pct = (bookings, views) => (views > 0 ? Math.round((bookings / views) * 100) : 0);

const Stat = ({ Icon, label, value }) => (
  <div className="flex-1 text-center">
    <span className="mx-auto mb-1.5 flex h-9 w-9 items-center justify-center rounded-full bg-maroon/10 text-maroon">
      <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
    </span>
    <div className="font-display text-2xl font-extrabold text-ink">{value}</div>
    <div className="text-[11px] font-medium uppercase tracking-wide text-ink/45">{label}</div>
  </div>
);

const Arrow = () => <span aria-hidden="true" className="px-1 text-lg text-ink/25">→</span>;

export default function ConversionFunnel({ views = 0, bookings = 0, isFree }) {
  // Blurred sample behind the upsell so a free host sees the shape of the feature.
  const show = isFree ? { views: 248, bookings: 37, rate: 15 } : { views, bookings, rate: pct(bookings, views) };

  return (
    <section aria-label="Views to bookings" className="relative overflow-hidden rounded-2xl border border-maroon/15 bg-white p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-display text-base font-bold text-ink">Views to bookings</h2>
        {isFree && (
          <span className="rounded-full bg-marigold-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-marigold-800">Pro</span>
        )}
      </div>

      <div className={isFree ? 'pointer-events-none select-none blur-[3px]' : ''} aria-hidden={isFree || undefined}>
        <div className="flex items-center justify-between">
          <Stat Icon={Eye} label="Views" value={show.views.toLocaleString('en-IN')} />
          <Arrow />
          <Stat Icon={CalendarCheck} label="Bookings" value={show.bookings.toLocaleString('en-IN')} />
          <Arrow />
          <Stat Icon={TrendingUp} label="Conversion" value={`${show.rate}%`} />
        </div>
      </div>

      {isFree && (
        <div className="absolute inset-0 grid place-items-center bg-white/55 p-4 backdrop-blur-[2px]">
          <div className="max-w-xs text-center">
            <h3 className="mb-1 font-display font-bold text-maroon">See what converts</h3>
            <p className="mb-3 text-sm text-ink/60">
              Track how many profile views turn into bookings — upgrade to {PREMIUM_PLAN.name} to unlock your funnel.
            </p>
            <Link to="/dashboard/upgrade?src=funnel" className={buttonClasses({ variant: 'primary' })}>
              Upgrade to {PREMIUM_PLAN.name}
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}

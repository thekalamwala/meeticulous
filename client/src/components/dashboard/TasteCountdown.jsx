import { Link } from 'react-router-dom';
import { MessageCircle, ArrowRight } from 'lucide-react';

/**
 * TasteCountdown — free→Pro urgency nudge for the WhatsApp "taste" window.
 *
 * A free host gets automatic WhatsApp reminders free for 60 days from their first
 * booking (services/proTaste.js), then they switch off. Counting the days down —
 * and, once it lapses, saying plainly that reminders are now off — turns an
 * invisible perk expiry into a reason to upgrade before guests start no-showing.
 *
 * Server already shapes this (GET /host/nudges → taste); render nothing when the
 * host isn't in a window (paid host, or no booking yet → taste is null).
 *
 * Props:
 *   taste — { endsAt, daysLeft, endedDaysAgo } | null
 */
export default function TasteCountdown({ taste }) {
  if (!taste) return null;
  const daysLeft = Number(taste.daysLeft) || 0;
  const active = daysLeft > 0;
  // Only show the "off" state while it's recently lapsed (server sends endedDaysAgo
  // as a non-null number then); a long-dead window with no data shows nothing.
  if (!active && taste.endedDaysAgo == null) return null;

  const urgent = active && daysLeft <= 7;
  const headline = active
    ? `WhatsApp reminders: ${daysLeft} day${daysLeft === 1 ? '' : 's'} left`
    : 'WhatsApp reminders are off';
  const sub = active
    ? 'Automatic WhatsApp reminders are free on your bookings for now. Go Pro to keep them on past your free window.'
    : 'Your free window ended. Go Pro to switch WhatsApp reminders back on and cut no-shows.';

  return (
    <div
      className={`mb-5 flex items-start gap-3 rounded-md border-2 p-4 ${
        active && !urgent ? 'border-maroon/15 bg-blush' : 'border-rose/40 bg-rose/5'
      }`}
    >
      <MessageCircle className="mt-0.5 h-5 w-5 shrink-0 text-maroon" strokeWidth={2.1} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ink">{headline}</p>
        <p className="mt-0.5 text-xs text-ink/60">{sub}</p>
      </div>
      <Link
        to="/dashboard/upgrade?src=reminders"
        className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-maroon px-4 py-1.5 text-xs font-bold text-white transition-colors hover:bg-maroon-dark"
      >
        Go Pro
        <ArrowRight className="h-3 w-3" strokeWidth={2.4} />
      </Link>
    </div>
  );
}

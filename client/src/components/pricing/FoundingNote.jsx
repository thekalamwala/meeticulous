import useFoundingSpots from '../../hooks/useFoundingSpots';
import { FOUNDING } from '../../data/plans';

// Founding line under a Pro price: true scarcity from the live count, never a
// fake timer. Renders nothing while loading, on error, or once the offer closes.
// Pricing v2: founding yearly (₹899) is cheaper than the card's ₹1,199, so the
// note names its own price — checkout routes Pro to premium_founding while open.
export default function FoundingNote({ className = '' }) {
  const spots = useFoundingSpots();
  if (!spots) return null;
  return (
    <p className={`inline-flex flex-wrap items-center gap-x-1.5 rounded-full bg-blush px-3 py-1 text-xs font-semibold text-maroon ${className}`}>
      <span>Founding price ₹{FOUNDING.yearly.toLocaleString('en-IN')}/yr · locked for life</span>
      <span aria-hidden="true">·</span>
      <span>{spots.left} of {spots.limit} spots left</span>
      <span className="font-normal text-maroon/70">then ₹{FOUNDING.nextYearly.toLocaleString('en-IN')}/yr</span>
    </p>
  );
}

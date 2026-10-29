import { cn } from './cn';

/**
 * App-style sticky action bar for primary CTAs (Save, Confirm, Withdraw…).
 *
 * On mobile it floats just above the fixed bottom tab bar (see DashboardLayout)
 * and respects the safe-area inset; on md+ (no tab bar) it pins to the bottom of
 * the content area. It stretches edge-to-edge inside the padded content column
 * via negative margins that mirror DashboardLayout's px-4 / sm:px-6 / md:px-8.
 *
 * Purely presentational — it renders whatever actions you pass. Buttons stack
 * full-width on mobile (thumb reach) and sit inline on sm+.
 */
export function StickyActionBar({ children, className = '' }) {
  return (
    <div
      className={cn(
        'sticky z-30 -mx-4 mt-6 border-t border-gray-200 bg-white/95 px-4 py-3 backdrop-blur',
        'bottom-[calc(4rem+env(safe-area-inset-bottom))] sm:-mx-6 sm:px-6 md:-mx-8 md:bottom-0 md:px-8',
        'shadow-[0_-8px_24px_-16px_rgba(15,23,42,0.25)]',
        className,
      )}
    >
      <div className="mx-auto flex w-full max-w-6xl flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {children}
      </div>
    </div>
  );
}

export default StickyActionBar;

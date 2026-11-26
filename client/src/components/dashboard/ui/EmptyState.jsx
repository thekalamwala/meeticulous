import { cn } from './cn';

/* Shared dashboard empty state. On the warm ramp, not Tailwind's cold greys.
 *
 * `script` is the one expressive affordance the brand allows here: a short
 * human phrase set in Instrument Serif italic, appended to the title. It is
 * optional — callers that want a plain, quiet empty row pass only `title`.
 * Mirrors the community EmptyState (pages/community/CommunityLayout.jsx) so
 * the two read as one system; that one also carries an illustration. */
export function EmptyState({ icon: Icon, title, script, description, action, className = '' }) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-[20px] bg-cream px-6 py-12 text-center',
        className,
      )}
    >
      {Icon && (
        <div className="mb-4 grid h-12 w-12 place-items-center rounded-[14px] bg-blush text-maroon">
          <Icon className="h-6 w-6" />
        </div>
      )}
      {title && (
        <h3 className="mb-0 font-display text-[17px] font-bold tracking-[-0.02em] text-ink">
          {title}
          {script && <> <span className="font-serif font-normal italic text-rose">{script}</span></>}
        </h3>
      )}
      {description && <p className="mt-1.5 max-w-sm text-[14px] text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export default EmptyState;

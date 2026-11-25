import { cn } from './cn';

// Standard failure state — borderless (unlike EmptyState's dashed frame),
// icon + title + message + optional retry. Use inline in any feed/list.
export function ErrorState({ icon: Icon, title = 'Something went wrong', message, onRetry, className = '' }) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-12 text-center', className)}>
      {Icon && (
        <div className="mb-4 grid h-12 w-12 place-items-center rounded-[14px] bg-blush text-maroon">
          <Icon className="h-6 w-6" />
        </div>
      )}
      <h3 className="mb-0 font-display text-[17px] font-bold tracking-[-0.02em] text-ink">{title}</h3>
      {message && <p className="mt-1.5 max-w-sm text-[14px] text-muted">{message}</p>}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-5 rounded-[12px] bg-maroon px-5 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-maroon-dark focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose"
        >
          Try again
        </button>
      )}
    </div>
  );
}

export default ErrorState;

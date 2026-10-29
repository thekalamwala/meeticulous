import { cn } from './cn';

// Standard failure state — borderless (unlike EmptyState's dashed frame),
// icon + title + message + optional retry. Use inline in any feed/list.
export function ErrorState({ icon: Icon, title = 'Something went wrong', message, onRetry, className = '' }) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-12 text-center', className)}>
      {Icon && (
        <div className="mb-3 rounded-full bg-red-50 p-3 text-red-400">
          <Icon className="h-6 w-6" />
        </div>
      )}
      <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      {message && <p className="mt-1 max-w-sm text-sm text-gray-500">{message}</p>}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800"
        >
          Try again
        </button>
      )}
    </div>
  );
}

export default ErrorState;

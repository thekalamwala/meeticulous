import { cn } from './cn';

export function EmptyState({ icon: Icon, title, description, action, className = '' }) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-md border border-dashed border-gray-300 bg-gray-50/60 px-6 py-12 text-center',
        className,
      )}
    >
      {Icon && (
        <div className="mb-3 rounded-full bg-gray-100 p-3 text-gray-400">
          <Icon className="h-6 w-6" />
        </div>
      )}
      {title && <h3 className="text-sm font-semibold text-gray-900">{title}</h3>}
      {description && <p className="mt-1 max-w-sm text-sm text-gray-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export default EmptyState;

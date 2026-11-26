import { cn } from './cn';

export function Skeleton({ className = '' }) {
  return <div className={cn('animate-pulse rounded-[12px] bg-neutral-100 motion-reduce:animate-none', className)} />;
}

export function SkeletonText({ lines = 3, className = '' }) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={cn('h-3', i === lines - 1 ? 'w-2/3' : 'w-full')} />
      ))}
    </div>
  );
}

export function SkeletonCard({ className = '' }) {
  return (
    <div className={cn('rounded-[20px] bg-white p-5', className)}>
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="mt-3 h-8 w-1/2" />
      <Skeleton className="mt-3 h-3 w-2/3" />
    </div>
  );
}

export default Skeleton;

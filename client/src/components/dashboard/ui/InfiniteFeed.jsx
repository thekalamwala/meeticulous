import { SkeletonCard } from './Skeleton';
import { EmptyState } from './EmptyState';
import { ErrorState } from './ErrorState';
import { useInfiniteScroll } from './useInfiniteScroll';
import { cn } from './cn';

// The one composite primitive: a list that owns its loading / empty / error /
// load-more states. Every host feed screen renders through this.
export function InfiniteFeed({
  items = [],
  renderItem,
  loadMore,
  hasMore = false,
  loading = false,
  error = null,
  onRetry,
  empty = null,
  className = '',
  skeletonCount = 4,
}) {
  const sentinelRef = useInfiniteScroll(loadMore || (() => {}), { hasMore, loading });

  if (loading && items.length === 0) {
    return (
      <div className={cn('space-y-3', className)}>
        {Array.from({ length: skeletonCount }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
    );
  }
  if (error && items.length === 0) {
    return <ErrorState message={typeof error === 'string' ? error : 'Failed to load.'} onRetry={onRetry} />;
  }
  if (!loading && items.length === 0) {
    return empty || <EmptyState title="Nothing here yet" />;
  }
  return (
    <div className={cn('space-y-3', className)}>
      {items.map((item, i) => renderItem(item, i))}
      {hasMore && <div ref={sentinelRef} aria-hidden="true" className="h-1" />}
      {loading && items.length > 0 && <SkeletonCard />}
      {error && items.length > 0 && (
        <div className="py-4 text-center text-sm text-gray-500">
          Couldn’t load more.{' '}
          <button type="button" onClick={onRetry} className="font-medium text-gray-900 underline">
            Retry
          </button>
        </div>
      )}
    </div>
  );
}

export default InfiniteFeed;

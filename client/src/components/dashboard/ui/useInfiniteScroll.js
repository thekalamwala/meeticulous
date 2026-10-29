import { useEffect, useRef } from 'react';

// Attach the returned ref to a sentinel element at the end of a list.
// Fires loadMore() when it scrolls into view, only while hasMore && !loading.
export function useInfiniteScroll(loadMore, { hasMore, loading }) {
  const sentinelRef = useRef(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore || loading) return undefined;
    const io = new IntersectionObserver(
      (entries) => { if (entries[0]?.isIntersecting) loadMore?.(); },
      { rootMargin: '200px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [loadMore, hasMore, loading]);
  return sentinelRef;
}

export default useInfiniteScroll;

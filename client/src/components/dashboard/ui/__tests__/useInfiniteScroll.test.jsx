import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useInfiniteScroll } from '../useInfiniteScroll';

let ioCallback;
beforeEach(() => {
  ioCallback = null;
  global.IntersectionObserver = class {
    constructor(cb) { ioCallback = cb; }
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

function Probe({ loadMore, hasMore, loading }) {
  const ref = useInfiniteScroll(loadMore, { hasMore, loading });
  return <div ref={ref} data-testid="sentinel" />;
}

describe('useInfiniteScroll', () => {
  it('calls loadMore when sentinel intersects and hasMore', () => {
    const loadMore = vi.fn();
    render(<Probe loadMore={loadMore} hasMore loading={false} />);
    ioCallback([{ isIntersecting: true }]);
    expect(loadMore).toHaveBeenCalledTimes(1);
  });

  it('does not observe when hasMore is false', () => {
    const loadMore = vi.fn();
    render(<Probe loadMore={loadMore} hasMore={false} loading={false} />);
    expect(ioCallback).toBeNull();
    expect(loadMore).not.toHaveBeenCalled();
  });
});

# Host Mobile Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the 6 missing Host Mobile Design System interaction primitives (+2 hooks +1 route wrapper) as an additive component library, with zero visible change to existing screens.

**Architecture:** New leaf components in `client/src/components/dashboard/ui/`, exported via the existing barrel `index.js`. `InfiniteFeed` is the one composite — it wires the existing `Skeleton`/`EmptyState` with the new `ErrorState` and `useInfiniteScroll`. `PageTransition` is the single edit to an existing file (`DashboardLayout`). Nothing is imported by a real screen in this phase.

**Tech Stack:** React 18, framer-motion v12, Tailwind, lucide-react, Vitest + @testing-library/react.

## Global Constraints

- Presentation-layer only. No backend, route, schema, or data-model changes.
- All new files under `client/src/components/dashboard/ui/`. Export each via `index.js`.
- Reuse conventions: `cn` from `./cn`, `dash-elev-*` classes, spring transitions (stiffness 320–500 / damping 18–40), `env(safe-area-inset-*)` where sheets touch the bottom edge.
- Test matchers available (from `client/src/tests/setup.js`): `toBeInTheDocument`, `toBeDisabled`, `toBeEnabled`, `toBeEmptyDOMElement`, `toHaveAttribute`. Nothing else — assert everything else via `getAttribute()` / node presence.
- Tests use vitest globals (`describe/it/expect/vi`) — no imports of them needed, but importing from `vitest` is also fine. Co-locate tests in `client/src/components/dashboard/ui/__tests__/`.
- **DO NOT** touch `client/src/pages/services/{ServiceForm,AddService,EditService}.jsx` — owned by `feat/write-with-bolt`.
- Run client tests: `cd client && npm test -- <path>`. Build check: `cd client && npm run build`.

---

## Phase 1a — Feed foundation

### Task 1: ErrorState

**Files:**
- Create: `client/src/components/dashboard/ui/ErrorState.jsx`
- Modify: `client/src/components/dashboard/ui/index.js`
- Test: `client/src/components/dashboard/ui/__tests__/ErrorState.test.jsx`

**Interfaces:**
- Produces: `ErrorState({ icon?, title?, message?, onRetry?, className? })` — renders title/message, and a "Try again" button that calls `onRetry` when provided.

- [ ] **Step 1: Write the failing test**

```jsx
// client/src/components/dashboard/ui/__tests__/ErrorState.test.jsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ErrorState } from '../ErrorState';

describe('ErrorState', () => {
  it('renders title and message', () => {
    render(<ErrorState title="Oops" message="It broke" />);
    expect(screen.getByText('Oops')).toBeInTheDocument();
    expect(screen.getByText('It broke')).toBeInTheDocument();
  });

  it('shows retry only when onRetry given and fires it', () => {
    const onRetry = vi.fn();
    const { rerender } = render(<ErrorState message="x" />);
    expect(screen.queryByRole('button')).toBeNull();
    rerender(<ErrorState message="x" onRetry={onRetry} />);
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npm test -- src/components/dashboard/ui/__tests__/ErrorState.test.jsx`
Expected: FAIL — cannot resolve `../ErrorState`.

- [ ] **Step 3: Write the implementation**

```jsx
// client/src/components/dashboard/ui/ErrorState.jsx
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
```

- [ ] **Step 4: Add barrel export**

In `client/src/components/dashboard/ui/index.js`, after the `EmptyState` line add:

```js
export { ErrorState } from './ErrorState';
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd client && npm test -- src/components/dashboard/ui/__tests__/ErrorState.test.jsx`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add client/src/components/dashboard/ui/ErrorState.jsx client/src/components/dashboard/ui/index.js client/src/components/dashboard/ui/__tests__/ErrorState.test.jsx
git commit -m "feat(host-ui): ErrorState primitive"
```

---

### Task 2: useInfiniteScroll hook

**Files:**
- Create: `client/src/components/dashboard/ui/useInfiniteScroll.js`
- Test: `client/src/components/dashboard/ui/__tests__/useInfiniteScroll.test.jsx`

**Interfaces:**
- Produces: `useInfiniteScroll(loadMore, { hasMore, loading }) → sentinelRef` — attach the returned ref to an element at the list end; `loadMore()` fires when it intersects and `hasMore && !loading`.

- [ ] **Step 1: Write the failing test**

The global setup stubs `IntersectionObserver` as a no-op. Override it in this test to capture the callback so we can drive intersection manually.

```jsx
// client/src/components/dashboard/ui/__tests__/useInfiniteScroll.test.jsx
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npm test -- src/components/dashboard/ui/__tests__/useInfiniteScroll.test.jsx`
Expected: FAIL — cannot resolve `../useInfiniteScroll`.

- [ ] **Step 3: Write the implementation**

```js
// client/src/components/dashboard/ui/useInfiniteScroll.js
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd client && npm test -- src/components/dashboard/ui/__tests__/useInfiniteScroll.test.jsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add client/src/components/dashboard/ui/useInfiniteScroll.js client/src/components/dashboard/ui/__tests__/useInfiniteScroll.test.jsx
git commit -m "feat(host-ui): useInfiniteScroll hook"
```

---

### Task 3: InfiniteFeed

**Files:**
- Create: `client/src/components/dashboard/ui/InfiniteFeed.jsx`
- Modify: `client/src/components/dashboard/ui/index.js`
- Test: `client/src/components/dashboard/ui/__tests__/InfiniteFeed.test.jsx`

**Interfaces:**
- Consumes: `SkeletonCard` from `./Skeleton`, `EmptyState` from `./EmptyState`, `ErrorState` from `./ErrorState` (Task 1), `useInfiniteScroll` from `./useInfiniteScroll` (Task 2).
- Produces: `InfiniteFeed({ items, renderItem, loadMore?, hasMore?, loading?, error?, onRetry?, empty?, className?, skeletonCount? })`.

State rules:
- `loading && items.length===0` → skeleton cards (count `skeletonCount`, default 4).
- `error && items.length===0` → `ErrorState` with `onRetry`.
- `!loading && items.length===0` → `empty` node, or a default `EmptyState`.
- otherwise → mapped `renderItem(item, i)`, a sentinel div (when `hasMore`), an inline skeleton while loading-more, and an inline retry row on load-more error.

- [ ] **Step 1: Write the failing test**

```jsx
// client/src/components/dashboard/ui/__tests__/InfiniteFeed.test.jsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { InfiniteFeed } from '../InfiniteFeed';

const row = (item) => <div key={item.id} data-testid="row">{item.name}</div>;

describe('InfiniteFeed', () => {
  it('shows skeletons on first load', () => {
    const { container } = render(
      <InfiniteFeed items={[]} renderItem={row} loading skeletonCount={3} />,
    );
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('shows ErrorState with retry on first-load error', () => {
    const onRetry = vi.fn();
    render(<InfiniteFeed items={[]} renderItem={row} error="boom" onRetry={onRetry} />);
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('shows empty state when settled and empty', () => {
    render(<InfiniteFeed items={[]} renderItem={row} empty={<div>None yet</div>} />);
    expect(screen.getByText('None yet')).toBeInTheDocument();
  });

  it('renders items when present', () => {
    render(<InfiniteFeed items={[{ id: 1, name: 'A' }, { id: 2, name: 'B' }]} renderItem={row} />);
    expect(screen.getAllByTestId('row')).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npm test -- src/components/dashboard/ui/__tests__/InfiniteFeed.test.jsx`
Expected: FAIL — cannot resolve `../InfiniteFeed`.

- [ ] **Step 3: Write the implementation**

```jsx
// client/src/components/dashboard/ui/InfiniteFeed.jsx
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
```

- [ ] **Step 4: Add barrel export**

In `index.js`, after the `ErrorState` line add:

```js
export { InfiniteFeed } from './InfiniteFeed';
export { useInfiniteScroll } from './useInfiniteScroll';
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd client && npm test -- src/components/dashboard/ui/__tests__/InfiniteFeed.test.jsx`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add client/src/components/dashboard/ui/InfiniteFeed.jsx client/src/components/dashboard/ui/index.js client/src/components/dashboard/ui/__tests__/InfiniteFeed.test.jsx
git commit -m "feat(host-ui): InfiniteFeed composite (skeleton/empty/error/load-more)"
```

---

## Phase 1b — Gesture & confirmation primitives

### Task 4: useLongPress hook

**Files:**
- Create: `client/src/components/dashboard/ui/useLongPress.js`
- Test: `client/src/components/dashboard/ui/__tests__/useLongPress.test.jsx`

**Interfaces:**
- Produces: `useLongPress(onLongPress, { delay=450 }) → { onPointerDown, onPointerUp, onPointerLeave, onPointerCancel }` — spread onto the target element.

- [ ] **Step 1: Write the failing test**

```jsx
// client/src/components/dashboard/ui/__tests__/useLongPress.test.jsx
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useLongPress } from '../useLongPress';

function Probe({ onLongPress }) {
  const handlers = useLongPress(onLongPress, { delay: 400 });
  return <div data-testid="target" {...handlers}>hold</div>;
}

describe('useLongPress', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('fires after the delay', () => {
    const cb = vi.fn();
    render(<Probe onLongPress={cb} />);
    fireEvent.pointerDown(screen.getByTestId('target'));
    act(() => { vi.advanceTimersByTime(400); });
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('cancels if released early', () => {
    const cb = vi.fn();
    render(<Probe onLongPress={cb} />);
    const el = screen.getByTestId('target');
    fireEvent.pointerDown(el);
    act(() => { vi.advanceTimersByTime(200); });
    fireEvent.pointerUp(el);
    act(() => { vi.advanceTimersByTime(400); });
    expect(cb).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npm test -- src/components/dashboard/ui/__tests__/useLongPress.test.jsx`
Expected: FAIL — cannot resolve `../useLongPress`.

- [ ] **Step 3: Write the implementation**

```js
// client/src/components/dashboard/ui/useLongPress.js
import { useCallback, useRef } from 'react';

// Fires onLongPress after `delay` ms of sustained pointer press.
// Spread the returned handlers onto the target element.
export function useLongPress(onLongPress, { delay = 450 } = {}) {
  const timer = useRef(null);
  const clear = useCallback(() => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
  }, []);
  const start = useCallback((e) => {
    clear();
    timer.current = setTimeout(() => onLongPress?.(e), delay);
  }, [onLongPress, delay, clear]);
  return {
    onPointerDown: start,
    onPointerUp: clear,
    onPointerLeave: clear,
    onPointerCancel: clear,
  };
}

export default useLongPress;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd client && npm test -- src/components/dashboard/ui/__tests__/useLongPress.test.jsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add client/src/components/dashboard/ui/useLongPress.js client/src/components/dashboard/ui/__tests__/useLongPress.test.jsx
git commit -m "feat(host-ui): useLongPress hook"
```

---

### Task 5: ContextMenu

**Files:**
- Create: `client/src/components/dashboard/ui/ContextMenu.jsx`
- Modify: `client/src/components/dashboard/ui/index.js`
- Test: `client/src/components/dashboard/ui/__tests__/ContextMenu.test.jsx`

**Interfaces:**
- Consumes: `Sheet` from `./Overlay`, `useLongPress` from `./useLongPress` (Task 4).
- Produces: `ContextMenu({ items:[{label,icon?,danger?,onSelect}], trigger, title?, openOnClick? })` — clones `trigger` with long-press (and optional click) handlers; opens a bottom `Sheet` action list.

- [ ] **Step 1: Write the failing test**

```jsx
// client/src/components/dashboard/ui/__tests__/ContextMenu.test.jsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ContextMenu } from '../ContextMenu';

describe('ContextMenu', () => {
  it('opens on click (openOnClick) and fires the selected action', () => {
    const onSelect = vi.fn();
    render(
      <ContextMenu
        openOnClick
        trigger={<button>More</button>}
        items={[{ label: 'Cancel booking', danger: true, onSelect }]}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    fireEvent.click(screen.getByRole('button', { name: /cancel booking/i }));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npm test -- src/components/dashboard/ui/__tests__/ContextMenu.test.jsx`
Expected: FAIL — cannot resolve `../ContextMenu`.

- [ ] **Step 3: Write the implementation**

```jsx
// client/src/components/dashboard/ui/ContextMenu.jsx
import { useState, cloneElement } from 'react';
import { Sheet } from './Overlay';
import { useLongPress } from './useLongPress';
import { cn } from './cn';

// Long-press (or click, with openOnClick) a trigger to open a bottom-sheet
// action list. Replaces per-card button grids for secondary row actions.
export function ContextMenu({ items = [], trigger, title, openOnClick = false }) {
  const [open, setOpen] = useState(false);
  const longPress = useLongPress(() => setOpen(true));
  const handlers = {
    ...longPress,
    ...(openOnClick ? { onClick: () => setOpen(true) } : {}),
  };
  return (
    <>
      {cloneElement(trigger, handlers)}
      <Sheet open={open} onClose={() => setOpen(false)} title={title}>
        <div className="flex flex-col pb-2">
          {items.map((it, i) => (
            <button
              key={i}
              type="button"
              onClick={() => { setOpen(false); it.onSelect?.(); }}
              className={cn(
                'flex items-center gap-3 rounded-lg px-4 py-3 text-left text-sm font-medium transition-colors hover:bg-gray-50',
                it.danger ? 'text-red-600' : 'text-gray-800',
              )}
            >
              {it.icon && <it.icon className="h-5 w-5" />}
              {it.label}
            </button>
          ))}
        </div>
      </Sheet>
    </>
  );
}

export default ContextMenu;
```

- [ ] **Step 4: Add barrel export**

In `index.js` add:

```js
export { ContextMenu } from './ContextMenu';
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd client && npm test -- src/components/dashboard/ui/__tests__/ContextMenu.test.jsx`
Expected: PASS (1 test).

- [ ] **Step 6: Commit**

```bash
git add client/src/components/dashboard/ui/ContextMenu.jsx client/src/components/dashboard/ui/index.js client/src/components/dashboard/ui/__tests__/ContextMenu.test.jsx
git commit -m "feat(host-ui): ContextMenu primitive"
```

---

### Task 6: SwipeActions

**Files:**
- Create: `client/src/components/dashboard/ui/SwipeActions.jsx`
- Modify: `client/src/components/dashboard/ui/index.js`
- Test: `client/src/components/dashboard/ui/__tests__/SwipeActions.test.jsx`

**Interfaces:**
- Produces: `SwipeActions({ children, right:[{label,icon?,color?,onAction}], left?, className? })` — a horizontally draggable row revealing action buttons; buttons are always in the DOM (behind the content) and fire `onAction` on click.

Note: gesture drag isn't exercisable in jsdom — the test asserts the action buttons render and fire; the drag/snap is verified manually in the gallery (Task 9).

- [ ] **Step 1: Write the failing test**

```jsx
// client/src/components/dashboard/ui/__tests__/SwipeActions.test.jsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { SwipeActions } from '../SwipeActions';

describe('SwipeActions', () => {
  it('renders content and right actions, fires onAction', () => {
    const onAction = vi.fn();
    render(
      <SwipeActions right={[{ label: 'Delete', color: '#ef4444', onAction }]}>
        <div>Row content</div>
      </SwipeActions>,
    );
    expect(screen.getByText('Row content')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /delete/i }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npm test -- src/components/dashboard/ui/__tests__/SwipeActions.test.jsx`
Expected: FAIL — cannot resolve `../SwipeActions`.

- [ ] **Step 3: Write the implementation**

```jsx
// client/src/components/dashboard/ui/SwipeActions.jsx
import { motion, useMotionValue, animate } from 'framer-motion';
import { cn } from './cn';

const ACTION_W = 72; // px per action button

function ActionButtons({ actions, side }) {
  return (
    <div className={cn('absolute inset-y-0 flex', side === 'right' ? 'right-0' : 'left-0')}>
      {actions.map((a, i) => (
        <button
          key={i}
          type="button"
          onClick={a.onAction}
          style={{ width: ACTION_W, backgroundColor: a.color || '#ef4444' }}
          className="flex flex-col items-center justify-center gap-1 text-xs font-medium text-white"
        >
          {a.icon && <a.icon className="h-5 w-5" />}
          {a.label}
        </button>
      ))}
    </div>
  );
}

// Swipe a row horizontally to reveal quick actions. ponytail: snap points are
// full-open / closed only; no partial-detent state. Good enough for row ops.
export function SwipeActions({ children, right = [], left = [], className = '' }) {
  const x = useMotionValue(0);
  const rightW = right.length * ACTION_W;
  const leftW = left.length * ACTION_W;

  const settle = () => {
    const cur = x.get();
    let to = 0;
    if (cur < -rightW / 2 && rightW) to = -rightW;
    else if (cur > leftW / 2 && leftW) to = leftW;
    animate(x, to, { type: 'spring', stiffness: 500, damping: 40 });
  };

  return (
    <div className={cn('relative overflow-hidden', className)}>
      {right.length > 0 && <ActionButtons actions={right} side="right" />}
      {left.length > 0 && <ActionButtons actions={left} side="left" />}
      <motion.div
        drag="x"
        style={{ x }}
        dragConstraints={{ left: -rightW, right: leftW }}
        dragElastic={0.08}
        onDragEnd={settle}
        className="relative bg-white"
      >
        {children}
      </motion.div>
    </div>
  );
}

export default SwipeActions;
```

- [ ] **Step 4: Add barrel export**

In `index.js` add:

```js
export { SwipeActions } from './SwipeActions';
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd client && npm test -- src/components/dashboard/ui/__tests__/SwipeActions.test.jsx`
Expected: PASS (1 test).

- [ ] **Step 6: Commit**

```bash
git add client/src/components/dashboard/ui/SwipeActions.jsx client/src/components/dashboard/ui/index.js client/src/components/dashboard/ui/__tests__/SwipeActions.test.jsx
git commit -m "feat(host-ui): SwipeActions primitive"
```

---

### Task 7: PullToRefresh

**Files:**
- Create: `client/src/components/dashboard/ui/PullToRefresh.jsx`
- Modify: `client/src/components/dashboard/ui/index.js`
- Test: `client/src/components/dashboard/ui/__tests__/PullToRefresh.test.jsx`

**Interfaces:**
- Produces: `PullToRefresh({ onRefresh: () => Promise, children, className? })` — wraps content; a downward pull past threshold at scroll-top calls `onRefresh`.

Note: touch physics can't run in jsdom — the test only asserts children render (smoke). Pull behavior verified in the gallery (Task 9).

- [ ] **Step 1: Write the failing test**

```jsx
// client/src/components/dashboard/ui/__tests__/PullToRefresh.test.jsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { PullToRefresh } from '../PullToRefresh';

describe('PullToRefresh', () => {
  it('renders wrapped content', () => {
    render(<PullToRefresh onRefresh={async () => {}}><div>Feed</div></PullToRefresh>);
    expect(screen.getByText('Feed')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npm test -- src/components/dashboard/ui/__tests__/PullToRefresh.test.jsx`
Expected: FAIL — cannot resolve `../PullToRefresh`.

- [ ] **Step 3: Write the implementation**

```jsx
// client/src/components/dashboard/ui/PullToRefresh.jsx
import { useRef, useState } from 'react';
import { motion, useMotionValue, animate } from 'framer-motion';
import { Loader2 } from 'lucide-react';

const THRESHOLD = 72;

// Pull down at the top of the wrapped scroll area to refresh.
// ponytail: naive touch-drag, assumes the wrapped content is the scroll
// container. Upgrade to scroll-parent detection if a screen nests scrollers.
export function PullToRefresh({ onRefresh, children, className = '' }) {
  const y = useMotionValue(0);
  const startY = useRef(null);
  const scrollRef = useRef(null);
  const [refreshing, setRefreshing] = useState(false);

  const onTouchStart = (e) => {
    if (scrollRef.current && scrollRef.current.scrollTop <= 0) {
      startY.current = e.touches[0].clientY;
    }
  };
  const onTouchMove = (e) => {
    if (startY.current == null || refreshing) return;
    const dy = e.touches[0].clientY - startY.current;
    if (dy > 0) y.set(Math.min(dy * 0.5, THRESHOLD * 1.5));
  };
  const onTouchEnd = async () => {
    if (startY.current == null) return;
    const pulled = y.get();
    startY.current = null;
    if (pulled >= THRESHOLD && onRefresh) {
      setRefreshing(true);
      animate(y, THRESHOLD, { duration: 0.1 });
      try { await onRefresh(); } finally {
        setRefreshing(false);
        animate(y, 0, { type: 'spring', stiffness: 400, damping: 40 });
      }
    } else {
      animate(y, 0, { type: 'spring', stiffness: 400, damping: 40 });
    }
  };

  return (
    <div className={className} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
      <motion.div style={{ height: y }} className="flex items-end justify-center overflow-hidden">
        <Loader2 className={`mb-2 h-5 w-5 text-gray-400 ${refreshing ? 'animate-spin' : ''}`} />
      </motion.div>
      <div ref={scrollRef} className="overflow-y-auto">{children}</div>
    </div>
  );
}

export default PullToRefresh;
```

- [ ] **Step 4: Add barrel export**

In `index.js` add:

```js
export { PullToRefresh } from './PullToRefresh';
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd client && npm test -- src/components/dashboard/ui/__tests__/PullToRefresh.test.jsx`
Expected: PASS (1 test).

- [ ] **Step 6: Commit**

```bash
git add client/src/components/dashboard/ui/PullToRefresh.jsx client/src/components/dashboard/ui/index.js client/src/components/dashboard/ui/__tests__/PullToRefresh.test.jsx
git commit -m "feat(host-ui): PullToRefresh primitive"
```

---

### Task 8: SuccessState

**Files:**
- Create: `client/src/components/dashboard/ui/SuccessState.jsx`
- Modify: `client/src/components/dashboard/ui/index.js`
- Test: `client/src/components/dashboard/ui/__tests__/SuccessState.test.jsx`

**Interfaces:**
- Produces: `SuccessState({ title?, message?, action?, className? })` — animated check + title/message + optional CTA. For committed money/save actions.

- [ ] **Step 1: Write the failing test**

```jsx
// client/src/components/dashboard/ui/__tests__/SuccessState.test.jsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { SuccessState } from '../SuccessState';

describe('SuccessState', () => {
  it('renders title, message and action', () => {
    render(<SuccessState title="Withdrawal requested" message="₹500 on the way" action={<button>Done</button>} />);
    expect(screen.getByText('Withdrawal requested')).toBeInTheDocument();
    expect(screen.getByText('₹500 on the way')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npm test -- src/components/dashboard/ui/__tests__/SuccessState.test.jsx`
Expected: FAIL — cannot resolve `../SuccessState`.

- [ ] **Step 3: Write the implementation**

```jsx
// client/src/components/dashboard/ui/SuccessState.jsx
import { motion } from 'framer-motion';
import { cn } from './cn';

// Committed-action confirmation with a drawn checkmark. Use after money/save
// actions instead of a fleeting success toast.
export function SuccessState({ title = 'Done', message, action, className = '' }) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-12 text-center', className)}>
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 18 }}
        className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100"
      >
        <svg viewBox="0 0 24 24" className="h-8 w-8 text-green-600" fill="none" stroke="currentColor" strokeWidth="3">
          <motion.path
            d="M5 13l4 4L19 7"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ delay: 0.15, duration: 0.4 }}
          />
        </svg>
      </motion.div>
      <h3 className="text-base font-semibold text-gray-900">{title}</h3>
      {message && <p className="mt-1 max-w-sm text-sm text-gray-500">{message}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export default SuccessState;
```

- [ ] **Step 4: Add barrel export**

In `index.js` add:

```js
export { SuccessState } from './SuccessState';
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd client && npm test -- src/components/dashboard/ui/__tests__/SuccessState.test.jsx`
Expected: PASS (1 test).

- [ ] **Step 6: Commit**

```bash
git add client/src/components/dashboard/ui/SuccessState.jsx client/src/components/dashboard/ui/index.js client/src/components/dashboard/ui/__tests__/SuccessState.test.jsx
git commit -m "feat(host-ui): SuccessState primitive"
```

---

### Task 9: PageTransition + wire into DashboardLayout

**Files:**
- Create: `client/src/components/dashboard/ui/PageTransition.jsx`
- Modify: `client/src/components/dashboard/ui/index.js`
- Modify: `client/src/components/common/DashboardLayout.jsx` (line ~551, the `<div className="mx-auto w-full max-w-6xl">{children}</div>`)
- Test: `client/src/components/dashboard/ui/__tests__/PageTransition.test.jsx`

**Interfaces:**
- Produces: `PageTransition({ children })` — wraps content in `AnimatePresence` keyed on `useLocation().pathname` for a slide-in push transition.

- [ ] **Step 1: Write the failing test**

```jsx
// client/src/components/dashboard/ui/__tests__/PageTransition.test.jsx
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import { PageTransition } from '../PageTransition';

describe('PageTransition', () => {
  it('renders children within a router', () => {
    render(
      <MemoryRouter>
        <PageTransition><div>Page body</div></PageTransition>
      </MemoryRouter>,
    );
    expect(screen.getByText('Page body')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npm test -- src/components/dashboard/ui/__tests__/PageTransition.test.jsx`
Expected: FAIL — cannot resolve `../PageTransition`.

- [ ] **Step 3: Write the implementation**

```jsx
// client/src/components/dashboard/ui/PageTransition.jsx
import { AnimatePresence, motion } from 'framer-motion';
import { useLocation } from 'react-router-dom';

// Slide-in push transition for host dashboard route changes. Keyed on
// pathname so each navigation animates in/out.
export function PageTransition({ children }) {
  const { pathname } = useLocation();
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pathname}
        initial={{ opacity: 0, x: 12 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -12 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

export default PageTransition;
```

- [ ] **Step 4: Add barrel export**

In `index.js` add:

```js
export { PageTransition } from './PageTransition';
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd client && npm test -- src/components/dashboard/ui/__tests__/PageTransition.test.jsx`
Expected: PASS (1 test).

- [ ] **Step 6: Wire into DashboardLayout**

At the top of `client/src/components/common/DashboardLayout.jsx`, add to the existing dashboard-ui imports:

```js
import { PageTransition } from '../dashboard/ui/PageTransition';
```

Then change the content wrapper (around line 551) from:

```jsx
<div className="mx-auto w-full max-w-6xl">{children}</div>
```

to:

```jsx
<div className="mx-auto w-full max-w-6xl">
  <PageTransition>{children}</PageTransition>
</div>
```

- [ ] **Step 7: Verify no host-layout test regressed**

Run: `cd client && npm test -- src/components/common src/pages/dashboard`
Expected: PASS (existing dashboard/layout suites unaffected — this is a transparent wrapper).

- [ ] **Step 8: Commit**

```bash
git add client/src/components/dashboard/ui/PageTransition.jsx client/src/components/dashboard/ui/index.js client/src/components/common/DashboardLayout.jsx client/src/components/dashboard/ui/__tests__/PageTransition.test.jsx
git commit -m "feat(host-ui): PageTransition wrapper on dashboard outlet"
```

---

### Task 10: Manual gallery verification + full build

Prove the gesture/motion primitives (that jsdom can't exercise) actually work in the browser, then remove the scaffold.

- [ ] **Step 1: Add a temporary gallery route**

Create `client/src/pages/dashboard/_UiGallery.jsx` mounting `InfiniteFeed` (each state), `SwipeActions`, `ContextMenu`, `PullToRefresh`, `SuccessState`, `ErrorState`, and a couple of navigable links (to see `PageTransition`). Register it under an existing host route in `App.jsx` at path `/dashboard/_ui-gallery`. (This file is throwaway — do not commit it.)

- [ ] **Step 2: Verify in the preview**

Start the client via preview tooling, open `/dashboard/_ui-gallery`, and confirm: swipe reveals actions & snaps; long-press opens the context sheet; pull-to-refresh triggers; success check animates; feed shows skeleton→items→empty→error; navigating between the two links slides.

- [ ] **Step 3: Remove the scaffold**

Delete `client/src/pages/dashboard/_UiGallery.jsx` and its route registration in `App.jsx`. Confirm `git status` shows no gallery files.

- [ ] **Step 4: Full suite + build**

Run: `cd client && npm test -- src/components/dashboard/ui`
Expected: PASS (all primitive suites).

Run: `cd client && npm run build`
Expected: build succeeds, no errors.

- [ ] **Step 5: Commit (only if the gallery cleanup left any tracked change; otherwise nothing to commit)**

```bash
git add -A
git commit -m "chore(host-ui): Phase 1 foundation verified; gallery scaffold removed" || echo "nothing to commit"
```

---

## Self-Review

- **Spec coverage:** ErrorState (T1), useInfiniteScroll (T2), InfiniteFeed (T3), useLongPress (T4), ContextMenu (T5), SwipeActions (T6), PullToRefresh (T7), SuccessState (T8), PageTransition (T9). All 6 primitives + 2 hooks + wrapper from the spec are covered. Existing primitives intentionally untouched. Dark theme + screen migration correctly excluded (Phase 2).
- **Placeholder scan:** none — every step has full code or exact commands.
- **Type consistency:** `useInfiniteScroll(loadMore, {hasMore, loading})→ref` consumed by InfiniteFeed as written. `ErrorState({message,onRetry})` consumed by InfiniteFeed. `useLongPress(cb,{delay})→handlers` consumed by ContextMenu. Barrel names match component export names.
- **Constraint:** no task touches service-form files; all changes presentation-layer.

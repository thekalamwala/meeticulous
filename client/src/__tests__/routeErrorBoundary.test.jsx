// Locks RouteErrorBoundary's two jobs: (1) render a recovery card instead of a
// blank screen when a child throws during render, and (2) actually REPORT the
// crash to analytics (route path + component stack + chunk-error flag) so a prod
// "This page didn't load" names its page/device instead of dying anonymously.
// Analytics is mocked so no real adapters load.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const { track, initAnalytics } = vi.hoisted(() => ({
  track: vi.fn(),
  initAnalytics: vi.fn(),
}));
vi.mock('../services/analytics', () => ({
  analytics: { track },
  initAnalytics,
  EVENTS: { APP_ERROR: 'app_error_boundary' },
}));

import RouteErrorBoundary from '../components/common/RouteErrorBoundary';

function Boom({ message }) {
  throw new Error(message);
}

describe('RouteErrorBoundary', () => {
  beforeEach(() => {
    track.mockClear();
    initAnalytics.mockClear();
    // Error boundaries log to console.error on catch — silence it for clean output.
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('renders the recovery card when a child throws', () => {
    render(
      <RouteErrorBoundary resetKey="/host/jane">
        <Boom message="kaboom" />
      </RouteErrorBoundary>
    );
    expect(screen.getByText(/this page didn.?t load/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reload page/i })).toBeInTheDocument();
  });

  it('reports the crash to analytics with route path and details', () => {
    render(
      <RouteErrorBoundary resetKey="/host/jane">
        <Boom message="kaboom" />
      </RouteErrorBoundary>
    );
    expect(initAnalytics).toHaveBeenCalled();
    expect(track).toHaveBeenCalledTimes(1);
    const [event, props] = track.mock.calls[0];
    expect(event).toBe('app_error_boundary');
    expect(props.message).toContain('kaboom');
    expect(props.path).toBe(window.location.pathname);
    expect(props.is_chunk_error).toBe(false);
    expect(typeof props.component_stack).toBe('string');
  });

  it('flags chunk-load failures so they are distinguishable from render bugs', () => {
    render(
      <RouteErrorBoundary resetKey="/x">
        <Boom message="Failed to fetch dynamically imported module: /assets/Foo-abc.js" />
      </RouteErrorBoundary>
    );
    const [, props] = track.mock.calls[0];
    expect(props.is_chunk_error).toBe(true);
  });

  it('reload clears the chunk-reload guard and does a cache-busting reload', () => {
    const setItem = () => {};
    const removeItem = vi.fn();
    vi.stubGlobal('sessionStorage', { setItem, removeItem, getItem: () => null });
    const replace = vi.fn();
    // jsdom location is read-only; stub the pieces handleReload touches.
    vi.stubGlobal('location', {
      href: 'https://meeticulous.com/host/jane',
      replace,
      reload: vi.fn(),
    });

    render(
      <RouteErrorBoundary resetKey="/host/jane">
        <Boom message="kaboom" />
      </RouteErrorBoundary>
    );
    fireEvent.click(screen.getByRole('button', { name: /reload page/i }));

    expect(removeItem).toHaveBeenCalledWith('bas:chunk-reload');
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace.mock.calls[0][0]).toMatch(/[?&]_rl=/);

    vi.unstubAllGlobals();
  });
});

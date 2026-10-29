// Locks the PostHog adapter's two de-dup fixes:
//   1. init disables autocapture $pageview (the deliberate page() call is the one
//      source) so navigations aren't logged twice.
//   2. track() drops server-authoritative conversion events so paid bookings /
//      registrations aren't double-counted (client copy + server posthog-node hit).
import { describe, it, expect, beforeEach, vi } from 'vitest';

const { phInit, phCapture } = vi.hoisted(() => ({ phInit: vi.fn(), phCapture: vi.fn() }));
vi.mock('posthog-js', () => ({
  default: { init: phInit, capture: phCapture, identify: vi.fn(), reset: vi.fn() },
}));

import posthog from '../posthog';

beforeEach(() => {
  phInit.mockClear();
  phCapture.mockClear();
  vi.stubEnv('VITE_POSTHOG_PROJECT_TOKEN', 'phc_test');
  vi.stubEnv('VITE_POSTHOG_HOST', 'https://us.i.posthog.com');
});

describe('posthog adapter de-duplication', () => {
  it('disables autocapture pageview at init', async () => {
    await posthog.init();
    expect(phInit).toHaveBeenCalledTimes(1);
    const [, opts] = phInit.mock.calls[0];
    expect(opts.capture_pageview).toBe(false);
  });

  it('drops server-owned conversion events but forwards other events', async () => {
    await posthog.init();
    phCapture.mockClear();

    posthog.track('booking_paid', { value: 100 });
    posthog.track('booking_created', {});
    posthog.track('user_registered', {});
    expect(phCapture).not.toHaveBeenCalled();

    posthog.track('booking_started', { service_id: 'x' });
    posthog.track('host_profile_viewed', {});
    expect(phCapture).toHaveBeenCalledTimes(2);
    expect(phCapture.mock.calls[0][0]).toBe('booking_started');
  });
});

// Locks the production-host gate: analytics must fire ONLY on the real prod site,
// never from localhost or a Vercel preview deploy (which otherwise pollute the one
// production PostHog project). See analyticsEnabled() in ../index.js.
import { describe, it, expect, afterEach, vi } from 'vitest';

// Mock every adapter so importing the bus never loads a real SDK. track() records
// whether the bus routed the call to an adapter.
const { phTrack } = vi.hoisted(() => ({ phTrack: vi.fn() }));
vi.mock('../adapters/posthog', () => ({ default: { name: 'posthog', needsConsent: false, init: vi.fn(), track: phTrack } }));
vi.mock('../adapters/ga4', () => ({ default: { name: 'ga4', needsConsent: true, init: vi.fn(), track: vi.fn() } }));
vi.mock('../adapters/pixel', () => ({ default: { name: 'pixel', needsConsent: true, init: vi.fn(), track: vi.fn() } }));
vi.mock('../adapters/clarity', () => ({ default: { name: 'clarity', needsConsent: true, init: vi.fn(), track: vi.fn() } }));
vi.mock('../adapters/gtm', () => ({ default: { name: 'gtm', needsConsent: true, init: vi.fn(), track: vi.fn() } }));

import { analytics, analyticsEnabled, EVENTS } from '../index';

function setHostname(host) {
  // jsdom's location is reconfigurable via delete + assign of the pieces we read.
  Object.defineProperty(window, 'location', { value: { hostname: host }, writable: true, configurable: true });
}

afterEach(() => { phTrack.mockClear(); });

describe('analyticsEnabled (production-host gate)', () => {
  it('is true only on the canonical production hosts', () => {
    setHostname('meeticulous.com');
    expect(analyticsEnabled()).toBe(true);
    setHostname('www.meeticulous.com');
    expect(analyticsEnabled()).toBe(true);
  });

  it('is false on localhost and Vercel preview domains', () => {
    setHostname('localhost');
    expect(analyticsEnabled()).toBe(false);
    setHostname('meeticulous-abc123-meeticulous-projects.vercel.app');
    expect(analyticsEnabled()).toBe(false);
    setHostname('127.0.0.1');
    expect(analyticsEnabled()).toBe(false);
  });

  it('drops track() calls off-prod and routes them on prod', () => {
    setHostname('localhost');
    analytics.track(EVENTS.BOOKING_STARTED, { service_id: 'x' });
    expect(phTrack).not.toHaveBeenCalled();

    setHostname('meeticulous.com');
    analytics.track(EVENTS.BOOKING_STARTED, { service_id: 'x' });
    expect(phTrack).toHaveBeenCalledTimes(1);
  });
});

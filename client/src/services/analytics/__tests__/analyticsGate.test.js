// Locks the production-host gate: analytics must fire ONLY on the real prod site,
// never from localhost or a Vercel preview deploy (which otherwise pollute the one
// production PostHog project). See analyticsEnabled() in ../index.js.
import { describe, it, expect, afterEach, vi } from 'vitest';

// Mock every adapter so importing the bus never loads a real SDK. track() records
// whether the bus routed the call to an adapter.
const { phTrack, gaTrack, pxTrack } = vi.hoisted(() => ({ phTrack: vi.fn(), gaTrack: vi.fn(), pxTrack: vi.fn() }));
vi.mock('../adapters/posthog', () => ({ default: { name: 'posthog', consent: null, init: vi.fn(), track: phTrack } }));
vi.mock('../adapters/ga4', () => ({ default: { name: 'ga4', consent: 'analytics', init: vi.fn(), track: gaTrack } }));
vi.mock('../adapters/pixel', () => ({ default: { name: 'pixel', consent: 'marketing', init: vi.fn(), track: pxTrack } }));
vi.mock('../adapters/clarity', () => ({ default: { name: 'clarity', consent: 'analytics', init: vi.fn(), track: vi.fn() } }));
vi.mock('../adapters/gtm', () => ({ default: { name: 'gtm', consent: 'marketing', init: vi.fn(), track: vi.fn() } }));

import { analytics, analyticsEnabled, EVENTS } from '../index';

function setHostname(host) {
  // jsdom's location is reconfigurable via delete + assign of the pieces we read.
  Object.defineProperty(window, 'location', { value: { hostname: host }, writable: true, configurable: true });
}

afterEach(() => { phTrack.mockClear(); gaTrack.mockClear(); pxTrack.mockClear(); localStorage.clear(); });

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

// Per-category consent (founder decision 2026-11-28): Analytics unlocks GA4/Clarity,
// Marketing unlocks Meta Pixel/GTM, and neither loads before the visitor chooses.
describe('per-category consent routing', () => {
  it('routes nothing gated before a choice; PostHog always', () => {
    setHostname('meeticulous.com');
    analytics.track(EVENTS.BOOKING_STARTED, {});
    expect(phTrack).toHaveBeenCalledTimes(1);
    expect(gaTrack).not.toHaveBeenCalled();
    expect(pxTrack).not.toHaveBeenCalled();
  });

  it('Analytics only → GA4 gets events, the Meta Pixel does not', () => {
    setHostname('meeticulous.com');
    analytics.setConsent({ analytics: true, marketing: false });
    analytics.track(EVENTS.BOOKING_STARTED, {});
    expect(gaTrack).toHaveBeenCalledTimes(1);
    expect(pxTrack).not.toHaveBeenCalled();
  });

  it('Accept (true) unlocks both; Reject (false) neither', () => {
    setHostname('meeticulous.com');
    analytics.setConsent(true);
    analytics.track(EVENTS.BOOKING_STARTED, {});
    expect(gaTrack).toHaveBeenCalledTimes(1);
    expect(pxTrack).toHaveBeenCalledTimes(1);
    analytics.setConsent(false);
    analytics.track(EVENTS.BOOKING_STARTED, {});
    expect(gaTrack).toHaveBeenCalledTimes(1);
    expect(pxTrack).toHaveBeenCalledTimes(1);
  });

  it('a visitor who chose on the old one-switch banner keeps that choice', () => {
    localStorage.setItem('bas_marketing_consent', 'granted');
    expect(analytics.getConsent()).toEqual({ analytics: true, marketing: true });
    expect(analytics.hasDecided()).toBe(true);
    localStorage.clear();
    localStorage.setItem('bas_marketing_consent', 'denied');
    expect(analytics.getConsent()).toEqual({ analytics: false, marketing: false });
  });
});

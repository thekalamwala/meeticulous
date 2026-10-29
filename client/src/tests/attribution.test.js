import { describe, test, expect, beforeEach, vi } from 'vitest';
import { captureAttribution, getAttribution } from '../utils/attribution';

function setUrl(search) {
  Object.defineProperty(window, 'location', { value: { search, pathname: '/land' }, writable: true });
}

beforeEach(() => { localStorage.clear(); });

describe('attribution capture', () => {
  test('captures a UTM-tagged arrival and returns it (minus timestamp)', () => {
    setUrl('?utm_source=google&utm_campaign=launch');
    captureAttribution();
    expect(getAttribution()).toMatchObject({ utm_source: 'google', utm_campaign: 'launch', landing_page: '/land?utm_source=google&utm_campaign=launch' });
    expect(getAttribution().at).toBeUndefined();
  });

  test('first touch is sticky — a later tagged visit does not overwrite it', () => {
    setUrl('?utm_source=facebook');
    captureAttribution();
    setUrl('?utm_source=google');
    captureAttribution();                 // second call must be a no-op
    expect(getAttribution().utm_source).toBe('facebook');
  });

  test('an untagged arrival stores nothing', () => {
    setUrl('?foo=bar');
    captureAttribution();
    expect(getAttribution()).toBeNull();
  });

  test('a fbclid-only arrival (Instagram) infers source and preserves the click id', () => {
    setUrl('?fbclid=abc123');
    captureAttribution();
    const att = getAttribution();
    expect(att).toMatchObject({ utm_source: 'facebook', utm_medium: 'paid', fbclid: 'abc123' });
    expect(att.landing_page).toContain('fbclid=abc123'); // raw id kept for exact attribution
  });

  test('a real utm_source wins over click-id inference but the raw id is still kept', () => {
    setUrl('?utm_source=newsletter&fbclid=abc123');
    captureAttribution();
    const att = getAttribution();
    expect(att.utm_source).toBe('newsletter');
    expect(att.fbclid).toBe('abc123');
  });

  test('blocked storage never throws', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    setUrl('?utm_source=google');
    expect(() => captureAttribution()).not.toThrow();
    spy.mockRestore();
  });
});

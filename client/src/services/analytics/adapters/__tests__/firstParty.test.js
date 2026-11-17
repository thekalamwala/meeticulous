/**
 * firstParty adapter — the properties a host is charged for.
 *
 * The theme: this is the only adapter whose numbers a host sees on a paid page,
 * so under-counting and double-counting are both real harms, and an event we
 * cannot attribute is dropped rather than guessed at.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import firstParty from '../firstParty';

const QUEUE_KEY = 'mt_evq';
const HOST = 'host-1';
const queue = () => JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
  firstParty.reset();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('what gets recorded', () => {
  it('queues a tracked event with the full envelope', () => {
    firstParty.track('host_profile_viewed', { host_id: HOST });
    const [e] = queue();
    expect(e).toMatchObject({ event: 'host_profile_viewed', host_id: HOST });
    // Every field the server's normalise() reads must be present.
    for (const k of ['visitor_id', 'session_id', 'occurred_at', 'device_type', 'route', 'ingest_id']) {
      expect(e[k]).toBeTruthy();
    }
  });

  it('ignores catalog events Intelligence does not read', () => {
    // These are real events — they just belong to PostHog/GA4, and copying them
    // here would fill a 500 MB cap with rows no Intelligence page queries.
    firstParty.track('page_viewed', { host_id: HOST });
    firstParty.track('upgrade_started', { host_id: HOST });
    expect(queue()).toHaveLength(0);
  });

  it('drops an event with no host_id rather than guessing', () => {
    firstParty.track('service_viewed', { service_id: 's1' });
    expect(queue()).toHaveLength(0);
  });

  it('does not count a host viewing their own page', () => {
    firstParty.identify(HOST);
    firstParty.track('host_profile_viewed', { host_id: HOST });
    expect(queue()).toHaveLength(0);

    // ...but still counts them viewing someone else's.
    firstParty.track('host_profile_viewed', { host_id: 'other-host' });
    expect(queue()).toHaveLength(1);
  });

  it('carries the payloads the two new events exist for', () => {
    firstParty.track('profile_link_clicked', { host_id: HOST, link_type: 'instagram' });
    firstParty.track('service_shared', { host_id: HOST, service_id: 's1', channel: 'whatsapp' });
    expect(queue().map((e) => [e.link_type, e.channel])).toEqual([
      ['instagram', null],
      [null, 'whatsapp'],
    ]);
  });

  it('gives every event its own ingest_id, so the server can dedupe a replay', () => {
    firstParty.track('service_viewed', { host_id: HOST, service_id: 's1' });
    firstParty.track('service_viewed', { host_id: HOST, service_id: 's1' });
    const [a, b] = queue();
    expect(a.ingest_id).not.toBe(b.ingest_id);
  });

  it('reuses one visitor and one session across events', () => {
    firstParty.track('host_profile_viewed', { host_id: HOST });
    firstParty.track('service_viewed', { host_id: HOST, service_id: 's1' });
    const [a, b] = queue();
    expect(a.visitor_id).toBe(b.visitor_id);
    expect(a.session_id).toBe(b.session_id);
  });
});

describe('route patterns never carry a path', () => {
  const { routePattern } = firstParty.__test;
  it.each([
    ['/', '/'],
    ['/ananyarao', '/:username'],
    ['/ananyarao/nutrition-deep-dive', '/:username/:serviceSlug'],
  ])('%s → %s', (path, expected) => {
    expect(routePattern(path)).toBe(expected);
  });
});

describe('flushing', () => {
  it('sends as soon as a full batch is queued, without waiting for the timer', () => {
    for (let i = 0; i < firstParty.__test.MAX_BATCH; i += 1) {
      firstParty.track('service_viewed', { host_id: HOST, service_id: `s${i}` });
    }
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetch.mock.calls[0][1].body).events).toHaveLength(firstParty.__test.MAX_BATCH);
  });

  it('otherwise waits for the timer', () => {
    firstParty.track('service_viewed', { host_id: HOST, service_id: 's1' });
    expect(fetch).not.toHaveBeenCalled();
    vi.advanceTimersByTime(5000);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('puts the batch back when the network fails, so a flaky connection loses nothing', async () => {
    fetch.mockRejectedValueOnce(new Error('offline'));
    firstParty.track('service_viewed', { host_id: HOST, service_id: 's1' });
    vi.advanceTimersByTime(5000);
    await vi.waitFor(() => expect(queue()).toHaveLength(1));
  });

  it('uses sendBeacon on pagehide, because fetch is cancelled by the navigation', () => {
    const beacon = vi.fn().mockReturnValue(true);
    vi.stubGlobal('navigator', { ...navigator, sendBeacon: beacon });
    firstParty.track('service_viewed', { host_id: HOST, service_id: 's1' });
    firstParty.__test.flush({ beacon: true });
    expect(beacon).toHaveBeenCalledTimes(1);
    expect(queue()).toHaveLength(0);
  });

  it('keeps the queue when a beacon is refused', () => {
    vi.stubGlobal('navigator', { ...navigator, sendBeacon: vi.fn().mockReturnValue(false) });
    firstParty.track('service_viewed', { host_id: HOST, service_id: 's1' });
    firstParty.__test.flush({ beacon: true });
    expect(queue()).toHaveLength(1);
  });
});

describe('storage is never allowed to break a page', () => {
  it('survives localStorage throwing, as it does in private mode', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(() => firstParty.track('service_viewed', { host_id: HOST })).not.toThrow();
    spy.mockRestore();
  });
});

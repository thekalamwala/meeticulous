import { describe, it, expect } from 'vitest';
import {
  COMMUNITY_TABS, activeGrowTab, growBand, growTabs, pageFields, pagePayload, pageUrl, reviewsSentence, waShare,
} from '../pages/grow/growModel';

const step = (key, done, title = key) => ({ key, done, title });

describe('growTabs', () => {
  it('is the four Grow tabs; Community is its own section', () => {
    expect(growTabs().map((t) => t.key)).toEqual(['overview', 'page', 'reviews', 'refer']);
  });
  it('keeps the old routes as the Reviews and Refer & earn tabs', () => {
    const tabs = growTabs();
    expect(tabs.find((t) => t.key === 'reviews').to).toBe('/dashboard/testimonials');
    expect(tabs.find((t) => t.key === 'refer').to).toBe('/dashboard/referrals');
  });
});

describe('activeGrowTab', () => {
  const tabs = growTabs();
  it('matches Overview exactly and Your page by prefix', () => {
    expect(activeGrowTab('/dashboard/grow', tabs)).toBe('overview');
    expect(activeGrowTab('/dashboard/grow/', tabs)).toBe('overview');
    expect(activeGrowTab('/dashboard/grow/page', tabs)).toBe('page');
  });
  it('lights each of the four Community tabs on its own route', () => {
    for (const k of ['activity', 'mentions', 'answer', 'spaces']) {
      expect(activeGrowTab(`/dashboard/community/${k}`, COMMUNITY_TABS)).toBe(k);
    }
  });
  it('does not match a look-alike prefix', () => {
    expect(activeGrowTab('/dashboard/growth', tabs)).toBe(null);
    expect(activeGrowTab('/dashboard/referrals-old', tabs)).toBe(null);
  });
});

describe('growBand', () => {
  it('leads with setup while any step is open, naming the next one', () => {
    const b = growBand({ steps: [step('a', true), step('b', false, 'Set up payouts'), step('c', false)], views: 40 });
    expect(b.kind).toBe('setup');
    expect(b.title[0]).toBe('Your page is 2 steps');
    expect(b.sub).toBe('Next: set up payouts.');
  });
  it('singular step', () => {
    expect(growBand({ steps: [step('a', false)] }).title[0]).toBe('Your page is 1 step');
  });
  it('talks visits + reviews once live and opened', () => {
    const b = growBand({ steps: [step('a', true)], views: 1465, reviews: { count: 3, avg: 4.67 } });
    expect(b.kind).toBe('views');
    expect(b.title[0]).toBe('1,465 visits to your page');
    expect(b.sub).toBe('Guests rate you 4.7 out of 5 from 3 reviews.');
  });
  it('asks to share when live but unopened, or when the count is unknown', () => {
    expect(growBand({ steps: [], views: 0 }).kind).toBe('share');
    expect(growBand({ steps: [], views: null }).kind).toBe('share');
  });
});

describe('reviewsSentence', () => {
  it('says it in words when there are none', () => {
    expect(reviewsSentence({ count: 0, avg: 0 })).toMatch(/^No guest reviews yet/);
    expect(reviewsSentence({ count: 1, avg: 5 })).toBe('Guests rate you 5.0 out of 5 from 1 review.');
  });
});

describe('links', () => {
  it('pageUrl is null before a username exists', () => {
    expect(pageUrl('', 'https://x.in')).toBe(null);
    expect(pageUrl('riya', 'https://x.in')).toBe('https://x.in/riya');
  });
  it('waShare encodes the link into a wa.me text', () => {
    expect(waShare(null)).toBe(null);
    expect(waShare('https://x.in/riya', 'Hi')).toBe('https://wa.me/?text=Hi%20https%3A%2F%2Fx.in%2Friya');
  });
});

describe('pagePayload', () => {
  it('sends only the guest-facing keys, never account fields', () => {
    const form = { ...pageFields({ name: '  Riya  ', bio: 'b', theme_color: '#960D32', tagline: 'kw', date_of_birth: '1990-01-01' }), reschedule_fee: 99 };
    const out = pagePayload(form);
    expect(Object.keys(out).sort()).toEqual(['bio', 'cover_image', 'location', 'name', 'profession', 'profile_image', 'social_links', 'theme_color'].sort());
    expect(out.name).toBe('Riya');
    expect(out).not.toHaveProperty('tagline');
    expect(out).not.toHaveProperty('date_of_birth');
    expect(out).not.toHaveProperty('reschedule_fee');
  });
  it('drops an empty theme colour so the stored one stays', () => {
    expect(pagePayload(pageFields({ name: 'R' }))).not.toHaveProperty('theme_color');
  });
});

'use strict';

const { cloudinaryHostCard } = require('../../services/seo/hostOgCard');

const H = { name: 'Ketaki Dhande', avatar: 'https://lh3.googleusercontent.com/a/xyz=s96-c', profession: 'Coach', city: 'Pune', handle: 'ketaki' };

describe('cloudinaryHostCard', () => {
  beforeEach(() => {
    delete process.env.CLOUDINARY_CLOUD;
    delete process.env.OG_ASSET_BASE;
    process.env.PUBLIC_SITE_URL = 'https://meeticulous.com';
  });

  test('returns null when CLOUDINARY_CLOUD is unset (safe fallback)', () => {
    expect(cloudinaryHostCard(H)).toBeNull();
  });

  test('returns null when there is no name to render', () => {
    process.env.CLOUDINARY_CLOUD = 't5vsmb6w';
    expect(cloudinaryHostCard({ ...H, name: '' })).toBeNull();
  });

  describe('with a cloud configured', () => {
    beforeEach(() => { process.env.CLOUDINARY_CLOUD = 't5vsmb6w'; });

    test('is a 1200x630 fetch card on the right cloud', () => {
      const url = cloudinaryHostCard(H);
      expect(url.startsWith('https://res.cloudinary.com/t5vsmb6w/image/fetch/')).toBe(true);
      expect(url).toContain('w_1200,h_630,c_fill');
      expect(url).toContain('Ketaki%20Dhande'); // name in the text overlay
    });

    test('is deterministic — same inputs, same URL (CDN cache hit, no re-render)', () => {
      expect(cloudinaryHostCard(H)).toBe(cloudinaryHostCard({ ...H }));
    });

    test('upscales the Google avatar before it is fetched as the ring photo', () => {
      const url = cloudinaryHostCard(H);
      expect(url).toContain('l_fetch:'); // avatar overlay present
      // the avatar URL is base64url-embedded; decode the l_fetch payloads and check
      const fetched = [...url.matchAll(/l_fetch:([A-Za-z0-9_-]+)/g)]
        .map((m) => Buffer.from(m[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
      const avatar = fetched.find((u) => u.includes('googleusercontent'));
      expect(avatar).toContain('=s512-c');
      expect(avatar).not.toContain('=s96-c');
    });

    test('no photo → falls back to the favicon ee mark, not the wordmark', () => {
      const withPhoto = cloudinaryHostCard(H);
      const noPhoto = cloudinaryHostCard({ ...H, avatar: '' });
      // Same overlay count — the ring slot is filled either way (photo or mark).
      expect(noPhoto.match(/l_fetch:/g).length).toBe(withPhoto.match(/l_fetch:/g).length);
      const fetched = [...noPhoto.matchAll(/l_fetch:([A-Za-z0-9_-]+)/g)]
        .map((m) => Buffer.from(m[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
      // The RING slot is the favicon mark, on a blush disc (b_rgb:FFE4EA) with the
      // ring — NOT the host avatar and NOT the wordmark (the wordmark is a separate
      // top-left brand overlay, present on every card).
      expect(fetched).toContain('https://meeticulous.com/favicon.svg');
      expect(noPhoto).toContain('b_rgb:FFE4EA,r_max');
    });

    test('OG_ASSET_BASE overrides where Cloudinary fetches the committed assets', () => {
      process.env.OG_ASSET_BASE = 'https://raw.example.com/brand/og';
      const url = cloudinaryHostCard(H);
      const base = decodeURIComponent(url.split('/').pop());
      expect(base).toBe('https://raw.example.com/brand/og/host-bg-cream.png');
    });
  });
});

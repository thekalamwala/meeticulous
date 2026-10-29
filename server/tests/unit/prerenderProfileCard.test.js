'use strict';
process.env.NODE_ENV = 'test';
process.env.PUBLIC_SITE_URL = 'https://bookasloth.com';

// The controller lazily require()s these inside the handler, so a module mock is
// enough — no Supabase, no network.
jest.mock('../../controllers/hostController', () => ({ buildHostProfile: jest.fn() }));

const { buildHostProfile } = require('../../controllers/hostController');
const { renderProfileMeta } = require('../../controllers/prerenderController');

const mockRes = () => {
  const r = {};
  r.set = jest.fn(() => r);
  r.status = jest.fn(() => r);
  r.send = jest.fn(() => r);
  r.redirect = jest.fn(() => r);
  return r;
};

const wireHost = (over) =>
  buildHostProfile.mockResolvedValue({
    payload: {
      host: { username: 'ketaki', name: 'Ketaki Dhande', profession: 'Coach', ...over },
      services: [],
    },
  });

const render = async () => {
  const res = mockRes();
  await renderProfileMeta({ params: { username: 'ketaki' } }, res);
  return res.send.mock.calls[0][0];
};

beforeEach(() => jest.clearAllMocks());

describe('profile OG card', () => {
  const ogImageContent = (html) => (html.match(/property="og:image" content="([^"]*)"/) || [])[1];

  // v3.88: og:image is a generated 1200x630 CARD, never the square avatar (which
  // letterboxes under summary_large_image). The avatar moves to JSON-LD instead.
  test('uses the generated card as og:image when one is ready', async () => {
    wireHost({
      og_status: 'ready',
      og_image: 'https://cdn.supabase/images/host-og/ketaki.png?v=1',
      profile_image: 'https://lh3.googleusercontent.com/a/xyz=s96-c',
    });
    const html = await render();

    expect(ogImageContent(html)).toBe('https://cdn.supabase/images/host-og/ketaki.png?v=1');
    // Known 1200x630 card => size hints are honest here.
    expect(html).toContain('<meta property="og:image:width" content="1200">');
    expect(html).toContain('<meta property="og:image:height" content="630">');
  });

  // Until a host's own card is generated, serve the site-wide card — a real
  // 1200x630 image — NOT the bare avatar.
  test('falls back to the site card when no generated card exists', async () => {
    wireHost({ og_status: 'none', og_image: null, profile_image: 'https://cdn.example.com/pic.png' });
    const html = await render();

    expect(ogImageContent(html)).toBe('https://bookasloth.com/og-image.png');
    expect(html).not.toContain('content="https://cdn.example.com/pic.png"'); // avatar is NOT the og:image
  });

  test('a dirty card still serves its (stale) image, never the avatar', async () => {
    wireHost({
      og_status: 'dirty',
      og_image: 'https://cdn.supabase/host-og/ketaki.png?v=1',
      profile_image: 'https://cdn.example.com/pic.png',
    });
    const html = await render();
    // Design: dirty => serve the OLD card while a regen is queued, not the generic.
    expect(ogImageContent(html)).toBe('https://cdn.supabase/host-og/ketaki.png?v=1');
    expect(html).not.toContain('content="https://cdn.example.com/pic.png"');
  });

  // The avatar still belongs in structured data (Person.image), upscaled past
  // Google's =s96-c so it isn't a thumbnail there either.
  test('upscales the Google avatar in the JSON-LD Person image', async () => {
    wireHost({ profile_image: 'https://lh3.googleusercontent.com/a/xyz=s96-c' });
    const html = await render();

    expect(html).toContain('=s512-c');
    expect(html).not.toContain('=s96-c');
  });
});

'use strict';
process.env.NODE_ENV = 'test';
process.env.PUBLIC_SITE_URL = 'https://meeticulous.com';

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

beforeEach(() => {
  jest.clearAllMocks();
  delete process.env.CLOUDINARY_CLOUD; // off by default; each test opts in
});

describe('profile OG card', () => {
  const ogImageContent = (html) => (html.match(/property="og:image" content="([^"]*)"/) || [])[1];

  // og:image is a 1200x630 CARD, never the square avatar (which letterboxes under
  // summary_large_image). The avatar moves to JSON-LD instead.

  // An admin-set og_image is a manual override and always wins (even over the
  // Cloudinary card), so the site can still pin a bespoke card for a host.
  test('admin override (og_image) is used verbatim as og:image', async () => {
    process.env.CLOUDINARY_CLOUD = 't5vsmb6w';
    wireHost({
      og_image: 'https://cdn.example.com/custom-card.png',
      profile_image: 'https://lh3.googleusercontent.com/a/xyz=s96-c',
    });
    const html = await render();
    expect(ogImageContent(html)).toBe('https://cdn.example.com/custom-card.png');
    expect(html).toContain('<meta property="og:image:width" content="1200">');
  });

  // With a cloud configured and no override, og:image is the Cloudinary card URL,
  // composited on crawl from the committed bg + this host's live fields.
  test('builds the Cloudinary card when CLOUDINARY_CLOUD is set', async () => {
    process.env.CLOUDINARY_CLOUD = 't5vsmb6w';
    wireHost({ og_image: null, profile_image: 'https://lh3.googleusercontent.com/a/xyz=s96-c' });
    const url = ogImageContent(await render());
    expect(url).toContain('https://res.cloudinary.com/t5vsmb6w/image/fetch/');
    expect(url).toContain('Ketaki'); // host name rendered into the text overlay
    // Still a known 1200x630 card => honest size hints.
    expect(url).not.toContain('=s96-c'); // avatar upscaled for the fetch overlay
  });

  // No cloud configured => graceful fallback to the static site card (a real
  // 1200x630 image), NOT the bare avatar. Lets the code ship before the env var.
  test('falls back to the site card when CLOUDINARY_CLOUD is unset', async () => {
    wireHost({ og_image: null, profile_image: 'https://cdn.example.com/pic.png' });
    const html = await render();
    expect(ogImageContent(html)).toBe('https://meeticulous.com/og-image.png');
    expect(html).not.toContain('content="https://cdn.example.com/pic.png"'); // avatar is NOT the og:image
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

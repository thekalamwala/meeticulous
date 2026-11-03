import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// The module reads import.meta.env at load, so reset + restub per case.
beforeEach(() => vi.resetModules());
afterEach(() => vi.unstubAllEnvs());

describe('cloudinaryBlogCard', () => {
  it('returns null without VITE_CLOUDINARY_CLOUD (safe fallback)', async () => {
    vi.stubEnv('VITE_CLOUDINARY_CLOUD', '');
    const { cloudinaryBlogCard } = await import('../ogCard');
    expect(cloudinaryBlogCard({ title: 'Anything' })).toBeNull();
  });

  it('builds a 1200x630 card with headline, category and author·read time', async () => {
    vi.stubEnv('VITE_CLOUDINARY_CLOUD', 't5vsmb6w');
    vi.stubEnv('VITE_PUBLIC_SITE_URL', 'https://meeticulous.com');
    const { cloudinaryBlogCard } = await import('../ogCard');
    const url = cloudinaryBlogCard({ title: 'No-show playbook', category: 'Growth', author: 'Tithi', readMins: 6 });
    expect(url.startsWith('https://res.cloudinary.com/t5vsmb6w/image/fetch/')).toBe(true);
    expect(url).toContain('w_1200,h_630,c_fill');
    expect(url).toContain('No-show%20playbook'); // headline
    expect(url).toContain('Growth');             // category
    expect(url).toContain('6%20min%20read');     // author · read time
    // ee brand mark sits in the ring (l_fetch of a base64url'd asset URL)
    const fetched = [...url.matchAll(/l_fetch:([A-Za-z0-9_-]+)/g)]
      .map((m) => decodeURIComponent(escape(atob(m[1].replace(/-/g, '+').replace(/_/g, '/')))));
    expect(fetched.some((u) => u.endsWith('/ee-mark.svg'))).toBe(true);
  });
});

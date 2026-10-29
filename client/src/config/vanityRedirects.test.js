import { describe, it, expect } from 'vitest';
import { isVanitySlug, VANITY_TARGET, VANITY_SLUGS } from './vanityRedirects';

describe('vanityRedirects', () => {
  it('matches vanity slugs case-insensitively', () => {
    expect(isVanitySlug('69')).toBe(true);
    expect(isVanitySlug('FOUNDER')).toBe(true);
    expect(isVanitySlug(' nsfw ')).toBe(true);
  });

  it('does not match the redirect target or a normal host', () => {
    expect(isVanitySlug(VANITY_TARGET)).toBe(false); // never self-loops
    expect(isVanitySlug('sndatarkar')).toBe(false);
    expect(isVanitySlug('somehost')).toBe(false);
    expect(isVanitySlug('')).toBe(false);
    expect(isVanitySlug(undefined)).toBe(false);
  });

  it('covers all 19 configured slugs', () => {
    expect(VANITY_SLUGS.size).toBe(19);
  });
});

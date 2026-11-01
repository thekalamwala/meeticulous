/**
 * tests/unit/corsOrigins.test.js
 *
 * The CORS allowlist builder. Regression guard for the "Sign in with Google
 * button does nothing on www.meeticulous.com" bug: the prod CORS lock matched a
 * single exact CLIENT_URL, so the www host (and the vercel alias) 500'd every
 * /api call. buildAllowedOrigins must auto-include the www/apex sibling and any
 * CLIENT_URLS extras.
 */

const { buildAllowedOrigins, sibling, stripSlash } = require('../../config/corsOrigins');

describe('corsOrigins', () => {
  describe('sibling()', () => {
    it('apex → www', () => {
      expect(sibling('https://meeticulous.com')).toBe('https://www.meeticulous.com');
    });
    it('www → apex', () => {
      expect(sibling('https://www.meeticulous.com')).toBe('https://meeticulous.com');
    });
    it('preserves scheme/port', () => {
      expect(sibling('http://localhost:5173')).toBe('http://www.localhost:5173');
    });
    it('returns null for garbage', () => {
      expect(sibling('not-a-url')).toBeNull();
    });
  });

  describe('buildAllowedOrigins()', () => {
    it('apex CLIENT_URL allows both apex and www', () => {
      const set = buildAllowedOrigins({ CLIENT_URL: 'https://meeticulous.com' });
      expect(set.has('https://meeticulous.com')).toBe(true);
      expect(set.has('https://www.meeticulous.com')).toBe(true);
    });

    it('www CLIENT_URL allows both www and apex', () => {
      const set = buildAllowedOrigins({ CLIENT_URL: 'https://www.meeticulous.com' });
      expect(set.has('https://www.meeticulous.com')).toBe(true);
      expect(set.has('https://meeticulous.com')).toBe(true);
    });

    it('CLIENT_URLS extras (and their siblings) are included', () => {
      const set = buildAllowedOrigins({
        CLIENT_URL: 'https://meeticulous.com',
        CLIENT_URLS: 'https://meeticulous.vercel.app, https://staging.meeticulous.com',
      });
      expect(set.has('https://meeticulous.vercel.app')).toBe(true);
      expect(set.has('https://www.meeticulous.vercel.app')).toBe(true);
      expect(set.has('https://staging.meeticulous.com')).toBe(true);
      expect(set.has('https://www.staging.meeticulous.com')).toBe(true);
    });

    it('normalises trailing slashes', () => {
      const set = buildAllowedOrigins({ CLIENT_URL: 'https://meeticulous.com/' });
      expect(set.has('https://meeticulous.com')).toBe(true);
      expect(stripSlash('https://meeticulous.com/')).toBe('https://meeticulous.com');
    });

    it('does not allow an unrelated origin', () => {
      const set = buildAllowedOrigins({ CLIENT_URL: 'https://meeticulous.com' });
      expect(set.has('https://evil.example.com')).toBe(false);
    });

    it('empty env yields an empty set (no crash)', () => {
      expect(buildAllowedOrigins({}).size).toBe(0);
    });
  });
});

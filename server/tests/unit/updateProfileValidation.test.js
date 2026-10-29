/**
 * Regression guard for the host profile-update validators.
 *
 * Context: hosts sign in only via Google, so their Google avatar URL
 * (lh3.googleusercontent.com/…=s96-c) is stored as `profile_image`. Those
 * signed URLs routinely exceed 1000 chars. The `audit H1` fix that added the
 * http(s)-only allowlist also imposed a 1000-char cap, which 422'd every
 * "Save Profile" for such hosts (the client re-sends the stored image on each
 * save). The cap is now 2048 — long enough for real Google URLs, still bounded
 * and still http(s)-only.
 */
const { updateProfileRules } = require('../../middleware/validate');
const { validationResult } = require('express-validator');

// Run the updateProfile validators against a body and return the list of
// fields that failed (empty array = valid).
async function runValidators(body) {
  const req = { body };
  for (const rule of updateProfileRules) await rule.run(req);
  return validationResult(req).array().map((e) => e.path);
}

// A realistic Google avatar URL of a given total length.
const googleAvatarUrl = (len) => {
  const prefix = 'https://lh3.googleusercontent.com/a-/';
  const suffix = '=s96-c';
  return prefix + 'A'.repeat(len - prefix.length - suffix.length) + suffix;
};

describe('updateProfileRules — profile/cover image URL length', () => {
  test('accepts a 1126-char Google avatar URL (the reported failure)', async () => {
    const failed = await runValidators({
      name: 'leena goklani',
      tagline: 'Finance Professional | Career Consultant',
      profile_image: googleAvatarUrl(1126),
    });
    expect(failed).toEqual([]);
  });

  test('accepts a profile_image up to the 2048-char cap', async () => {
    const failed = await runValidators({ profile_image: googleAvatarUrl(2048) });
    expect(failed).not.toContain('profile_image');
  });

  test('rejects a profile_image longer than the cap', async () => {
    const failed = await runValidators({ profile_image: 'https://x.co/' + 'a'.repeat(2100) });
    expect(failed).toContain('profile_image');
  });

  test('still rejects a non-http(s) scheme (stored-XSS guard from audit H1)', async () => {
    const failed = await runValidators({ profile_image: 'javascript:alert(document.cookie)' });
    expect(failed).toContain('profile_image');
  });

  test('empty string clears the image without a 422', async () => {
    const failed = await runValidators({ profile_image: '', cover_image: '' });
    expect(failed).toEqual([]);
  });

  test('cover_image gets the same 2048 allowance', async () => {
    const failed = await runValidators({ cover_image: googleAvatarUrl(1500) });
    expect(failed).not.toContain('cover_image');
  });
});

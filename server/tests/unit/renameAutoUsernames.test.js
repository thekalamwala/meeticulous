// renameAutoUsernames: only OLD generator output ({email-handle}-xxxx / user-xxxx)
// is a rename candidate — a chosen name that happens to end in 4 letters never is.
jest.mock('../../config/supabase', () => ({ supabaseAdmin: {} }));
const { isOldAutoUsername, oldBaseFromEmail } = require('../../scripts/renameAutoUsernames');

test('recognises the live case and the user-xxxx fallback', () => {
  expect(oldBaseFromEmail('mohinidaf5@gmail.com')).toBe('mohinidaf5');
  expect(isOldAutoUsername('mohinidaf5-p6zi', 'mohinidaf5@gmail.com')).toBe(true);
  expect(isOldAutoUsername('user-9x2k', 'x@y.z')).toBe(true);
  expect(isOldAutoUsername('priya-sharma-x4k9', 'Priya.Sharma+work@gmail.com')).toBe(true);
});

test('never flags a chosen or name-based username', () => {
  expect(isOldAutoUsername('mohini-daf', 'mohinidaf5@gmail.com')).toBe(false);
  expect(isOldAutoUsername('john-paul', 'jp.writes@gmail.com')).toBe(false); // ends in 4 letters, not email-derived
  expect(isOldAutoUsername('sndatarkar', 'sndatarkar@gmail.com')).toBe(false);
  expect(isOldAutoUsername('mohinidaf5-p6zi', 'someone.else@gmail.com')).toBe(false);
});

test('ambiguity is by design limited: {handle}-{4 letters} DOES match, so the dry run is reviewed by a person', () => {
  // A host on source auto/onboarding whose name is exactly "<email handle>-paul" is
  // indistinguishable from generator output; --apply needs founder approval of the list.
  expect(isOldAutoUsername('john-paul', 'john@gmail.com')).toBe(true);
});

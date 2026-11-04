/**
 * Regression guard for the service write validators (serviceWriteRules), shared
 * by POST/PUT /api/services and /api/host/services.
 *
 * Context: the rich-text "Long description" editor stores HTML, which inflates
 * length far past the visible text. The server cap was 5000, which silently
 * 422'd real writeups (the editor had no client cap) and the generic
 * "Validation failed" hid the field. The cap is now 20000. This test locks that
 * number so a future edit can't quietly lower it back into drift with the
 * editor, plus guards the other bounded fields.
 */
const { serviceWriteRules } = require('../../middleware/validate');
const { validationResult } = require('express-validator');

// Run the service write validators against a body; return the fields that failed
// (empty array = valid).
async function runValidators(body) {
  const req = { body };
  for (const rule of serviceWriteRules) await rule.run(req);
  return validationResult(req).array().map((e) => e.path);
}

const longDesc = (len) => 'a'.repeat(len);

describe('serviceWriteRules — long_description cap', () => {
  test('accepts a long_description at the 20000-char cap', async () => {
    const failed = await runValidators({ long_description: longDesc(20000) });
    expect(failed).not.toContain('long_description');
  });

  test('rejects a long_description over the cap', async () => {
    const failed = await runValidators({ long_description: longDesc(20001) });
    expect(failed).toContain('long_description');
  });

  test('a realistic formatted writeup (well under cap) is accepted', async () => {
    const html = '<p>' + 'Great mentorship session. '.repeat(100) + '</p>';
    const failed = await runValidators({ long_description: html });
    expect(failed).not.toContain('long_description');
  });
});

describe('serviceWriteRules — other bounded fields', () => {
  test('every field optional: an empty body is valid (partial update)', async () => {
    expect(await runValidators({})).toEqual([]);
  });

  test('title shorter than 3 chars is rejected', async () => {
    expect(await runValidators({ title: 'ab' })).toContain('title');
  });

  test('price above the max is rejected', async () => {
    expect(await runValidators({ price: 500001 })).toContain('price');
  });

  test('free (price 0) is accepted', async () => {
    expect(await runValidators({ price: 0 })).not.toContain('price');
  });

  test('an unknown meeting_mode is rejected', async () => {
    expect(await runValidators({ meeting_mode: 'telepathy' })).toContain('meeting_mode');
  });

  test('a valid meeting_mode is accepted', async () => {
    expect(await runValidators({ meeting_mode: 'online' })).not.toContain('meeting_mode');
  });
});

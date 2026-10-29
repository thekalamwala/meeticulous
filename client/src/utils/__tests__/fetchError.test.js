import { describe, test, expect } from 'vitest';
import { isNotFoundError } from '../fetchError';

// Only an HTTP 404 is a genuine "not found". Everything else is transient and
// must NOT be treated as gone (which would render the noindex ErrorPage over a
// live prerendered page).
describe('isNotFoundError', () => {
  test('true only for an HTTP 404', () => {
    expect(isNotFoundError({ response: { status: 404 } })).toBe(true);
  });

  test('false for transient / environmental failures', () => {
    expect(isNotFoundError({ response: { status: 500 } })).toBe(false); // server error
    expect(isNotFoundError({ response: { status: 429 } })).toBe(false); // edge rate-limit
    expect(isNotFoundError({ response: { status: 403 } })).toBe(false); // ip guard
    expect(isNotFoundError({ code: 'ECONNABORTED' })).toBe(false);      // timeout, no response
    expect(isNotFoundError({ message: 'Network Error' })).toBe(false);  // network, no response
  });

  test('false for null/undefined', () => {
    expect(isNotFoundError(null)).toBe(false);
    expect(isNotFoundError(undefined)).toBe(false);
  });
});

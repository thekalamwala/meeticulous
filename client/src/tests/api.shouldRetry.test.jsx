import { describe, it, expect } from 'vitest';
import { shouldRetry } from '../services/api';

// Guards the money-safety boundary: transient READS retry, mutations never do.
describe('shouldRetry', () => {
  const netErr    = { code: 'ERR_NETWORK' };                 // no response
  const timeout   = { code: 'ECONNABORTED' };
  const err500    = { response: { status: 503 } };
  const err404    = { response: { status: 404 } };

  it('retries GET on network error, timeout, and 5xx', () => {
    expect(shouldRetry(netErr,  'get')).toBe(true);
    expect(shouldRetry(timeout, 'GET')).toBe(true);
    expect(shouldRetry(err500,  'get')).toBe(true);
  });

  it('never retries mutations, even on transient failures', () => {
    expect(shouldRetry(netErr, 'post')).toBe(false);
    expect(shouldRetry(err500, 'put')).toBe(false);
    expect(shouldRetry(err500, 'delete')).toBe(false);
    expect(shouldRetry(err500, 'patch')).toBe(false);
  });

  it('does not retry non-transient reads (4xx)', () => {
    expect(shouldRetry(err404, 'get')).toBe(false);
  });

  it('defaults missing method to get (idempotent)', () => {
    expect(shouldRetry(netErr, undefined)).toBe(true);
  });
});

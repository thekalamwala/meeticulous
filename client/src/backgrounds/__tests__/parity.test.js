import { describe, it, expect } from 'vitest';
import { backgroundKeys } from '../registry';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { BACKGROUND_KEYS } = require('../../../../server/config/backgroundKeys.js');

describe('registry/server key parity', () => {
  it('both client and server have empty key lists', () => {
    expect(backgroundKeys).toEqual([]);
    expect(BACKGROUND_KEYS).toEqual([]);
  });
});

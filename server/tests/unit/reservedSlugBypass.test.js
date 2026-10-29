// Proves the reserved guard cannot be bypassed at the username-change endpoint
// via case / unicode / zero-width tricks. Each variant must 400 and must NOT
// reach usernameService.changeUsername (the RPC).
jest.mock('../../services/usernameService', () => ({
  changeUsername: jest.fn(),
  usernameExists: jest.fn(),
  resolve: jest.fn(),
}));
jest.mock('../../utils/httpError', () => ({
  safeError: (res) => res.status(500).json({ message: 'error' }),
}));
jest.mock('../../utils/sitemapCache', () => ({ bustSitemapCache: jest.fn() }));

const usernameService = require('../../services/usernameService');
const { changeUsername } = require('../../controllers/usernameController');

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const RESERVED_BYPASS_ATTEMPTS = [
  'admin',          // baseline
  'Admin',          // case
  'ADMIN',          // case
  'aDmIn',          // mixed case
  'ＡＤＭＩＮ',          // NFKC fullwidth
  'ⓐdmin',          // NFKC circled
  'ad​min',          // ZWSP
  'ad‌min',          // ZWNJ
  'admin­',          // soft hyphen
  '﻿admin',          // BOM
  '  admin  ',      // padding
  'pricing',        // future namespace
  'docs',           // future namespace
];

describe('reserved-slug bypass resistance (PUT /api/host/username)', () => {
  beforeEach(() => jest.clearAllMocks());

  it.each(RESERVED_BYPASS_ATTEMPTS)('rejects "%s" with 400 and never calls the RPC', async (attempt) => {
    const res = mockRes();
    await changeUsername({ user: { id: 'u1' }, body: { username: attempt } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(usernameService.changeUsername).not.toHaveBeenCalled();
  });

  it('still allows a normal handle through to the RPC', async () => {
    usernameService.changeUsername.mockResolvedValue({ ok: true, username: 'jane-doe' });
    const res = mockRes();
    await changeUsername({ user: { id: 'u1' }, body: { username: 'Jane-Doe' } }, res);
    // normalized to 'jane-doe' before the RPC call
    expect(usernameService.changeUsername).toHaveBeenCalledWith('u1', 'jane-doe');
    expect(res.json).toHaveBeenCalledWith({ success: true, username: 'jane-doe' });
  });
});

'use strict';
jest.mock('../../../config/supabase', () => {
  const storageFrom = jest.fn(() => ({
    upload: jest.fn().mockResolvedValue({ data: { path: 'x' }, error: null }),
    getPublicUrl: jest.fn(() => ({ data: { publicUrl: 'https://cdn.example/x.png' } })),
  }));
  return {
    supabaseAdmin: {
      from: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: { role: 'guest', is_host: false } }),
      })),
      storage: { from: storageFrom },
    },
  };
});
const { uploadImage } = require('../../../controllers/uploadController');

const res = () => { const r = {}; r.status = jest.fn(() => r); r.json = jest.fn(() => r); return r; };
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), Buffer.alloc(32)]);
const req = (folder, user = { id: 'guest-1' }) => ({ file: { size: 100, buffer: PNG }, user, admin: null, query: { folder } });

describe('uploadImage community folder', () => {
  test('guest + folder=community is not 403', async () => {
    const r = res();
    await uploadImage(req('community'), r);
    expect(r.status).not.toHaveBeenCalledWith(403);
  });
  test('guest + folder=services is 403', async () => {
    const r = res();
    await uploadImage(req('services'), r);
    expect(r.status).toHaveBeenCalledWith(403);
  });
  test('no user + folder=community is still 403', async () => {
    const r = res();
    await uploadImage(req('community', null), r);
    expect(r.status).toHaveBeenCalledWith(403);
  });
});

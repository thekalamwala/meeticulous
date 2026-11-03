'use strict';
jest.mock('../../../services/featureFlags', () => ({ isFeatureEnabled: jest.fn() }));
jest.mock('../../../config/supabase', () => {
  // community_members lookup -> {early_access} per test; profiles -> plain guest.
  const state = { member: null };
  const storageFrom = jest.fn(() => ({
    upload: jest.fn().mockResolvedValue({ data: { path: 'x' }, error: null }),
    getPublicUrl: jest.fn(() => ({ data: { publicUrl: 'https://cdn.example/x.png' } })),
  }));
  return {
    supabaseAdmin: {
      __state: state,
      from: jest.fn((table) => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockImplementation(() => Promise.resolve({
          data: table === 'community_members' ? state.member : { role: 'guest', is_host: false },
        })),
      })),
      storage: { from: storageFrom },
    },
  };
});
const { isFeatureEnabled } = require('../../../services/featureFlags');
const { supabaseAdmin } = require('../../../config/supabase');
const { uploadImage, uploadProductFile } = require('../../../controllers/uploadController');

const res = () => { const r = {}; r.status = jest.fn(() => r); r.json = jest.fn(() => r); return r; };
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), Buffer.alloc(32)]);
const req = (folder, user = { id: 'guest-1' }) => ({ file: { size: 100, buffer: PNG }, user, admin: null, query: { folder } });

beforeEach(() => { supabaseAdmin.__state.member = null; isFeatureEnabled.mockResolvedValue(false); });

describe('uploadImage community folder', () => {
  test('flag on + guest + community -> not 403', async () => {
    isFeatureEnabled.mockResolvedValue(true);
    const r = res();
    await uploadImage(req('community'), r);
    expect(r.status).not.toHaveBeenCalledWith(403);
  });
  test('flag off + early-access guest -> not 403', async () => {
    supabaseAdmin.__state.member = { early_access: true };
    const r = res();
    await uploadImage(req('community'), r);
    expect(r.status).not.toHaveBeenCalledWith(403);
  });
  test('flag off + plain guest -> 403', async () => {
    const r = res();
    await uploadImage(req('community'), r);
    expect(r.status).toHaveBeenCalledWith(403);
  });
  test('flag on + guest + folder=services -> 403', async () => {
    isFeatureEnabled.mockResolvedValue(true);
    const r = res();
    await uploadImage(req('services'), r);
    expect(r.status).toHaveBeenCalledWith(403);
  });
  test('flag on + no user + community -> 403', async () => {
    isFeatureEnabled.mockResolvedValue(true);
    const r = res();
    await uploadImage(req('community', null), r);
    expect(r.status).toHaveBeenCalledWith(403);
  });
});

describe('uploadProductFile', () => {
  test('flag on + guest + ?folder=community -> still 403', async () => {
    isFeatureEnabled.mockResolvedValue(true);
    const r = res();
    await uploadProductFile(req('community'), r);
    expect(r.status).toHaveBeenCalledWith(403);
  });
});

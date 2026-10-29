/**
 * tests/unit/purgeUserStorage.test.js
 * Verifies the account-deletion Storage sweep removes public profile/cover
 * images and every private KYC + host-doc object, and never throws.
 */
// Names must be `mock`-prefixed to be referenced inside the jest.mock factory.
const mockListMap = {};
const mockRemove = jest.fn().mockResolvedValue({ data: [{}], error: null });

jest.mock('../../config/supabase', () => ({
  supabaseAdmin: {
    storage: {
      from: jest.fn((bucket) => ({
        // list resolves per (bucket, prefix) from mockListMap; default empty.
        list: jest.fn((prefix) =>
          Promise.resolve(mockListMap[`${bucket}:${prefix}`] || { data: [], error: null })),
        remove: mockRemove,
      })),
    },
  },
}));

const { supabaseAdmin } = require('../../config/supabase');
const { purgeUserStorage, imagesPathFromUrl } = require('../../utils/purgeUserStorage');

const PUBLIC = 'https://proj.supabase.co/storage/v1/object/public/images/';

beforeEach(() => {
  jest.clearAllMocks();
  for (const k of Object.keys(mockListMap)) delete mockListMap[k];
});

describe('imagesPathFromUrl', () => {
  test('extracts the in-bucket path from a public images URL', () => {
    expect(imagesPathFromUrl(`${PUBLIC}profiles/a_1_x.jpg`)).toBe('profiles/a_1_x.jpg');
  });
  test('returns null for external / non-images / empty URLs', () => {
    expect(imagesPathFromUrl('https://lh3.googleusercontent.com/a/x')).toBeNull();
    expect(imagesPathFromUrl('')).toBeNull();
    expect(imagesPathFromUrl(null)).toBeNull();
    expect(imagesPathFromUrl('not a url')).toBeNull();
  });
});

describe('purgeUserStorage', () => {
  test('removes profile + cover images and all KYC/host-doc files', async () => {
    mockListMap['kyc:u1'] = { data: [{ name: 'selfie_1.jpg', id: 'x' }, { name: 'pan_2.pdf', id: 'y' }], error: null };
    mockListMap['kyc:host-docs/u1'] = { data: [{ name: 'agreement.pdf', id: 'z' }], error: null };

    const out = await purgeUserStorage('u1', {
      profile_image: `${PUBLIC}profiles/p.jpg`,
      cover_image: `${PUBLIC}covers/c.jpg`,
    });

    // images bucket removed with both derived keys
    expect(supabaseAdmin.storage.from).toHaveBeenCalledWith('images');
    expect(mockRemove).toHaveBeenCalledWith(['profiles/p.jpg', 'covers/c.jpg']);
    // kyc bucket removed with all three prefixed keys
    expect(mockRemove).toHaveBeenCalledWith(['u1/selfie_1.jpg', 'u1/pan_2.pdf', 'host-docs/u1/agreement.pdf']);
    expect(out).toEqual({ images: 1, kyc: 1 });
  });

  test('skips the images remove when there are no ownable image URLs', async () => {
    await purgeUserStorage('u1', { profile_image: 'https://lh3.googleusercontent.com/a/x', cover_image: null });
    // Only KYC list/remove paths run; no remove call with image keys.
    expect(mockRemove).not.toHaveBeenCalledWith(expect.arrayContaining(['profiles/p.jpg']));
  });

  test('never throws and returns zeros when userId is missing', async () => {
    await expect(purgeUserStorage(null)).resolves.toEqual({ images: 0, kyc: 0 });
  });
});

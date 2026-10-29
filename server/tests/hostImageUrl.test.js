jest.mock('../config/supabase', () => ({ supabaseAdmin: { from: () => ({}) } }));

const { cleanImageUrl, imagesBucketPath } = require('../controllers/hostController');

describe('cleanImageUrl (audit H1 — profile/cover URL allowlist)', () => {
  it('keeps empty / blank as empty string', () => {
    expect(cleanImageUrl('')).toBe('');
    expect(cleanImageUrl('   ')).toBe('');
    expect(cleanImageUrl(undefined)).toBe('');
    expect(cleanImageUrl(null)).toBe('');
  });

  it('keeps Google account avatars', () => {
    const g = 'https://lh3.googleusercontent.com/a/ACg8ocIQxav170=s96-c';
    expect(cleanImageUrl(g)).toBe(g);
  });

  it('keeps our own public images-bucket URLs', () => {
    const u = 'https://ayjhlwyzszykqtnaktpb.supabase.co/storage/v1/object/public/images/profiles/abc_1_x.jpg';
    expect(cleanImageUrl(u)).toBe(u);
    const c = 'https://xwvciqkayammbvsidqig.supabase.co/storage/v1/object/public/images/covers/def_1_y.webp';
    expect(cleanImageUrl(c)).toBe(c);
  });

  it('rejects dangerous schemes → empty', () => {
    expect(cleanImageUrl('javascript:alert(1)')).toBe('');
    expect(cleanImageUrl('data:image/png;base64,AAAA')).toBe('');
    expect(cleanImageUrl('blob:https://x/y')).toBe('');
    expect(cleanImageUrl('http://lh3.googleusercontent.com/a/x')).toBe(''); // non-https
  });

  it('rejects arbitrary external hosts → empty', () => {
    expect(cleanImageUrl('https://evil.example.com/track.gif')).toBe('');
    expect(cleanImageUrl('https://not-supabase.co/storage/v1/object/public/images/x')).toBe('');
    // a private (non-public) supabase path is not a valid public image URL
    expect(cleanImageUrl('https://x.supabase.co/storage/v1/object/sign/kyc/secret')).toBe('');
  });

  it('rejects host-spoofing (allowlisted string as a subdomain of an attacker domain)', () => {
    expect(cleanImageUrl('https://googleusercontent.com.evil.com/a')).toBe('');
    expect(cleanImageUrl('https://supabase.co.evil.com/storage/v1/object/public/images/x')).toBe('');
  });
});

describe('imagesBucketPath (audit M1 — orphan cleanup path extraction)', () => {
  const P = 'https://ayjhlwyzszykqtnaktpb.supabase.co/storage/v1/object/public/images/';

  it('extracts the in-bucket path for our own profile/cover objects', () => {
    expect(imagesBucketPath(P + 'profiles/abc_1_x.jpg')).toBe('profiles/abc_1_x.jpg');
    expect(imagesBucketPath(P + 'covers/def_2_y.webp')).toBe('covers/def_2_y.webp');
  });

  it('returns null for objects we must not delete', () => {
    // Google avatars — never ours
    expect(imagesBucketPath('https://lh3.googleusercontent.com/a/x')).toBeNull();
    // empty / cleared
    expect(imagesBucketPath('')).toBeNull();
    expect(imagesBucketPath(null)).toBeNull();
    // our bucket but a prefix we don't own here (services, host-og, blog-og, branding)
    expect(imagesBucketPath(P + 'services/x.jpg')).toBeNull();
    expect(imagesBucketPath(P + 'host-og/x.png')).toBeNull();
    // external / spoofed host
    expect(imagesBucketPath('https://supabase.co.evil.com/storage/v1/object/public/images/profiles/x')).toBeNull();
    // non-public (signed/private) path
    expect(imagesBucketPath(P.replace('/public/', '/sign/') + 'profiles/x')).toBeNull();
  });
});

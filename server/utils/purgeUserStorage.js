/**
 * purgeUserStorage.js — remove every Storage object a user owns.
 *
 * WHY: deleting a profile row cascades the user's DB rows via FK, but Supabase
 * Storage is NOT covered by that cascade. Without this, a deleted user's public
 * profile/cover images and their PRIVATE KYC + host documents (PAN/Aadhaar/bank
 * scans) linger in the buckets forever — a data-retention/erasure gap. This
 * closes it as a best-effort sweep that callers run right after the row delete.
 *
 * Best-effort by design: it never throws. The DB row is the index, so an
 * orphaned object is invisible to the app; a failed cleanup must never fail (or
 * roll back) the account deletion. Returns a small summary for the audit log.
 */
const { supabaseAdmin } = require('../config/supabase');

const IMAGES_BUCKET = 'images'; // public — profile/cover photos
const KYC_BUCKET = 'kyc'; // private — KYC submissions + admin host documents

// A public images-bucket URL → its in-bucket path (e.g.
// 'profiles/abc_1_x.jpg'). Mirrors hostController.imagesBucketPath but accepts
// any object we own. Returns null for empty/external/non-images URLs (Google
// avatars, etc.) so we never try to delete something that isn't ours.
const imagesPathFromUrl = (url) => {
  const s = String(url ?? '').trim();
  if (!s) return null;
  let u;
  try { u = new URL(s); } catch { return null; }
  if (u.protocol !== 'https:' || !u.hostname.toLowerCase().endsWith('.supabase.co')) return null;
  const marker = '/storage/v1/object/public/images/';
  const i = u.pathname.indexOf(marker);
  if (i === -1) return null;
  return decodeURIComponent(u.pathname.slice(i + marker.length)) || null;
};

// List every file directly under a folder prefix and return full storage keys.
// Skips nested-folder placeholder entries (id === null). Never throws.
const listKeysUnder = async (bucket, prefix) => {
  try {
    const { data, error } = await supabaseAdmin.storage
      .from(bucket).list(prefix, { limit: 1000 });
    if (error || !Array.isArray(data)) return [];
    return data
      .filter((o) => o && o.name && o.id !== null)
      .map((o) => `${prefix}/${o.name}`);
  } catch { return []; }
};

const removeKeys = async (bucket, keys) => {
  if (!keys.length) return 0;
  try {
    const { data } = await supabaseAdmin.storage.from(bucket).remove(keys);
    return Array.isArray(data) ? data.length : 0;
  } catch (e) {
    console.warn(`purgeUserStorage: ${bucket} remove failed (non-fatal):`, e?.message);
    return 0;
  }
};

/**
 * Remove all Storage objects belonging to `userId`.
 * @param {string} userId
 * @param {{profile_image?: string, cover_image?: string}} profile - the row's
 *        image URLs, read BEFORE the delete (images keys are random, derivable
 *        only from the stored URL). Optional; KYC files are found by prefix.
 * @returns {Promise<{images: number, kyc: number}>} count removed per bucket.
 */
const purgeUserStorage = async (userId, profile = {}) => {
  const removed = { images: 0, kyc: 0 };
  if (!userId) return removed;

  // 1) Public profile + cover images — keyed only by their stored URL.
  const imageKeys = [profile?.profile_image, profile?.cover_image]
    .map(imagesPathFromUrl)
    .filter(Boolean);
  removed.images = await removeKeys(IMAGES_BUCKET, imageKeys);

  // 2) Private KYC bucket: submission docs (kyc/<userId>/*) and admin-uploaded
  //    host documents (kyc/host-docs/<userId>/*). Found by prefix so we catch
  //    every file regardless of what the DB rows referenced.
  const kycKeys = [
    ...(await listKeysUnder(KYC_BUCKET, userId)),
    ...(await listKeysUnder(KYC_BUCKET, `host-docs/${userId}`)),
  ];
  removed.kyc = await removeKeys(KYC_BUCKET, kycKeys);

  return removed;
};

module.exports = { purgeUserStorage, imagesPathFromUrl };

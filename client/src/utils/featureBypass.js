/**
 * resolveFeature(base, key, user) — the gating decision behind useFeature().
 *
 * `base` is the plain flag-map verdict (fail-open). When a feature is OFF, a
 * Supreme holder (user.bypasses_flags) still gets it — UNLESS the key is on the
 * server-supplied safety denylist (user.safety_keys: financial / auth / freeze
 * kills). Pure + dependency-free so it unit-tests without React or the api layer,
 * and mirrors server/middleware/requireFeature.js exactly.
 */
export const resolveFeature = (base, key, user) => {
  if (base) return true;
  if (user?.bypasses_flags && !(user?.safety_keys || []).includes(key)) return true;
  return false;
};

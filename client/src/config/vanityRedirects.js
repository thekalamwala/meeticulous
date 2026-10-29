// Vanity easter-egg slugs → one public profile. Hitting e.g. /69 or /founder
// redirects to /sndatarkar. The server reserves this same list
// (server/config/reservedNamespaces VANITY) so none can be claimed as a
// username — keep the two lists in sync.
export const VANITY_TARGET = 'sndatarkar';

export const VANITY_SLUGS = new Set([
  '18', '21', '69', '420', '007', '0001', '1337', '999',
  'adult', '18plus', 'nsfw', 'uncensored', 'private', 'secret',
  'human', 'founder', 'boss', 'lore', 'me',
]);

// True when a raw URL slug is a vanity handle (case-insensitive).
export const isVanitySlug = (slug) =>
  VANITY_SLUGS.has(String(slug || '').trim().toLowerCase());

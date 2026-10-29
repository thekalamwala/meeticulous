// Reserved usernames — public guard kept for backward-compat (importers:
// usernameGenerator, usernameController, vendorOnboardingController, authController).
// Internals now delegate to the L1 registry (config/reservedNamespaces.js) and the
// shared normalizer, so every caller gets the full route-derived list plus
// unicode/separator/zero-width hardening for free. For the FULL availability
// check (L1 + L2 admin/premium + L3 taken) use services/reservedSlugService.js.
const { normalizeSlug } = require('./slugNormalize');
const { isStaticReserved, RESERVED_SET } = require('../config/reservedNamespaces');

// Synchronous L1-only check. Normalizes first, so case/unicode/separator/zero-
// width variants of a reserved word are all caught. Empty/nullish => reserved.
function isReserved(slug) {
  if (slug === null || slug === undefined || slug === '') return true;
  const norm = normalizeSlug(slug);
  if (!norm) return true;
  return isStaticReserved(norm);
}

// RESERVED kept as a named export for any legacy importer; it is now the L1 set.
module.exports = { isReserved, RESERVED: RESERVED_SET };

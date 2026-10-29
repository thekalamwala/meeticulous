/**
 * publicCacheBust.js — one place to invalidate the responseCache namespaces that
 * public reads populate, so any controller that mutates a profile or a service
 * can call the same helper (no controller-to-controller requires / cycles).
 *
 * Namespace-wide by design: writes are rare, and a service mutation only carries
 * host_id while the cache is keyed by username — clearing the whole namespace is
 * simpler and correct. Both the profile listing (`hostprofile:`) and the service
 * detail pages (`service:`) embed service/host data, so both are cleared.
 *
 * Mirrors the existing bustSitemapCache() pattern — call it at the same write
 * sites.
 */
const responseCache = require('./responseCache');

function bustPublicReadCaches() {
  responseCache.bust('hostprofile:');
  responseCache.bust('service:');
}

module.exports = { bustPublicReadCaches };

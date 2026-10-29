import { FALLBACK_HOST } from './demoData';

// The deck's booking demo runs on a curated persona — never live/internal
// account data — so an externally shared link always shows a clean,
// aspirational flow (no ₹1 test services, no internal "KYC"/"App Demo"
// listings). Slide 08 re-skins this per profession via CATEGORY_DEMOS.
// ponytail: intentionally static — the old live fetch of /sndatarkar added a
// 2.5s timeout + fragile data risk for zero selling upside. Bring back a live
// fetch only if the deck must show a real, curated showcase host.
export function usePresentationHost() {
  return { host: FALLBACK_HOST, services: FALLBACK_HOST.services, loading: false, source: 'curated' };
}

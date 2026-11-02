// Slug typed into the homepage hero's "Claim my link" box. Stashed just before
// the Google sign-up redirect and read once by onboarding's SlugClaim step, so
// the host lands on the link they asked for (SlugClaim still runs the real
// availability check). sessionStorage survives the same-tab OAuth round-trip.
const KEY = "meet_hero_slug";

// Same shape SlugClaim accepts: lowercase letters, numbers, hyphens, ≤30 chars.
export const cleanSlug = (v) =>
  String(v || "").toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 30);

export function saveHeroSlug(slug) {
  try {
    const s = cleanSlug(slug);
    if (s) sessionStorage.setItem(KEY, s);
    else sessionStorage.removeItem(KEY);
  } catch { /* storage blocked — onboarding falls back to the auto slug */ }
}

export function takeHeroSlug() {
  try {
    const s = sessionStorage.getItem(KEY) || "";
    if (s) sessionStorage.removeItem(KEY);
    return cleanSlug(s);
  } catch {
    return "";
  }
}

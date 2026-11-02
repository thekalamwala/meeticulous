/**
 * Which Pro price list a visitor sees: 'IN' (INR, GST-inclusive) or 'INTL' (USD).
 *
 * Country comes from the `mt_cc` cookie the Vercel edge middleware sets from
 * x-vercel-ip-country (set on the HTML response, so it's there before JS runs).
 * No cookie (local dev, geo header missing) → fall back to the browser timezone. India is one timezone, so IST is a solid
 * proxy. Unknown → 'IN' (home market, and the only one we can charge today).
 *
 * DISPLAY ONLY. The server prices every checkout from subscription_plans; this
 * never reaches the API.
 */
export function getPricingRegion() {
  if (typeof document === "undefined") return "IN";
  const cc = document.cookie.match(/(?:^|;\s*)mt_cc=([A-Z]{2})/)?.[1];
  if (cc) return cc === "IN" ? "IN" : "INTL";
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    if (!tz) return "IN";
    return tz === "Asia/Kolkata" || tz === "Asia/Calcutta" ? "IN" : "INTL";
  } catch {
    return "IN";
  }
}

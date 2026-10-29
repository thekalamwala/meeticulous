import { useEffect, useState } from "react";
import { getAppearance } from "../services/api";
import { prerendered } from "../services/prerenderData";

/**
 * useAppearance — active navbar logo config (mode + image URLs).
 *
 * Reads a cached value from localStorage for an instant, flash-free first paint,
 * then revalidates from GET /api/appearance in the background. Falls back to
 * sensible defaults so the navbar always has something to render even offline.
 */

const CACHE_KEY = "bas_appearance";

// icon_url points at the bundled 96x96 mark, not the 800x800 CDN original: the
// navbar renders it at 26px, so the CDN file shipped ~25 KiB to paint 46 device
// pixels AND cost a cross-origin connection. Same artwork, same-origin, 13 KiB.
// Keep in sync with DEFAULTS in server/controllers/appearanceController.js.
const DEFAULTS = {
  navbar_logo_mode: "icon_text",
  icon_url: "/favicon-96x96.png",
  logo_image_url: "",
  festive_logo_url: "",
};

const readCache = () => {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
  } catch (_) {
    return DEFAULTS;
  }
};

export default function useAppearance() {
  // A prerendered page bakes the build-time /appearance; start from it so the
  // navbar logo is right on the first frame, then revalidate as before.
  const [appearance, setAppearance] = useState(() => {
    const baked = prerendered("/appearance");
    return baked ? { ...DEFAULTS, ...baked } : readCache();
  });

  useEffect(() => {
    let alive = true;
    getAppearance()
      .then(({ data }) => {
        if (!alive || !data) return;
        const next = { ...DEFAULTS, ...data };
        setAppearance(next);
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify(next));
        } catch (_) { /* ignore quota / private mode */ }
      })
      .catch(() => { /* keep cached/defaults */ });
    return () => { alive = false; };
  }, []);

  return appearance;
}

export { DEFAULTS };

import { useMemo } from 'react';

// First-touch UTM / click-id capture for paid-traffic attribution.
//
// On the first page that calls this with UTM params in the URL, we persist them
// to sessionStorage so they survive the SPA navigation INTO onboarding (where the
// real conversion fires). First-touch wins: once stored, later param-less or
// differently-tagged navigations don't overwrite the original ad source.
//
// Returns a flat object (possibly empty) safe to spread into analytics props.

const UTM_KEYS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'gclid',  // Google Ads click id
  'fbclid', // Meta click id
];

const STORAGE_KEY = 'bas_utm';

export default function useUtm() {
  return useMemo(() => {
    if (typeof window === 'undefined') return {};
    try {
      const params = new URLSearchParams(window.location.search);
      const fromUrl = {};
      UTM_KEYS.forEach((k) => {
        const v = params.get(k);
        if (v) fromUrl[k] = v;
      });

      let stored = {};
      try {
        stored = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '{}');
      } catch (_) {
        stored = {};
      }

      // First-touch: only persist when nothing is stored yet AND the URL carries tags.
      if (!Object.keys(stored).length && Object.keys(fromUrl).length) {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(fromUrl));
        return fromUrl;
      }
      return Object.keys(stored).length ? stored : fromUrl;
    } catch (_) {
      return {};
    }
  }, []);
}

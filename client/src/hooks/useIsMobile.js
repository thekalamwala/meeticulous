import { useEffect, useState } from 'react';

// True below Tailwind's `md` breakpoint (768px). Used to switch dashboard
// popups between an anchored desktop dropdown and a mobile bottom sheet.
export default function useIsMobile(query = '(max-width: 767px)') {
  const get = () =>
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia(query).matches
      : false;

  const [isMobile, setIsMobile] = useState(get);

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setIsMobile(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return isMobile;
}

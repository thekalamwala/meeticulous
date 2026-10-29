// ChromeContext — lets a full-bleed page (error / offline) tell App to drop the
// global Navbar + Footer, even when the page is the catch-all 404 whose URL is
// unknown ahead of time (so pathname-prefix hiding can't reach it).
//
// App owns the boolean and passes the setter down. A page calls useHideChrome()
// once; the hook hides chrome on mount and restores it on unmount. useLayoutEffect
// flips the flag before paint, so the navbar never visibly flashes.
import { createContext, useContext, useLayoutEffect, useEffect } from 'react';

export const ChromeContext = createContext({
  setChromeHidden: () => {},
  setFooterMode: () => {},
});

export function useHideChrome() {
  const { setChromeHidden } = useContext(ChromeContext);
  useLayoutEffect(() => {
    setChromeHidden(true);
    return () => setChromeHidden(false);
  }, [setChromeHidden]);
}

// A page (e.g. a "host/service not found" state) that wants the stripped-down
// footer instead of the full one calls this with `active` = whether it's in that
// state. Unlike useHideChrome, the navbar stays — original header is kept — and
// the footer is forced on even for logged-in users, who normally get none.
export function useMinimalFooter(active) {
  const { setFooterMode } = useContext(ChromeContext);
  useEffect(() => {
    if (!active) return undefined;
    setFooterMode('minimal');
    return () => setFooterMode('default');
  }, [active, setFooterMode]);
}

export default ChromeContext;

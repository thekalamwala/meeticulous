import { createContext, useContext, useRef, useCallback, useEffect } from 'react';

/* Lets a page hand its own refetch to the shell's pull-to-refresh without prop
 * drilling. The provider lives in each dashboard/guest shell; a page registers
 * its loader with useRegisterRefresh(fn). If no page registers (a static page),
 * the pull falls back to a soft reload so the gesture is never a dead end. */
const RefreshContext = createContext(null);

export const RefreshProvider = ({ children }) => {
  const handlerRef = useRef(null);

  const register = useCallback((fn) => {
    handlerRef.current = fn;
    return () => { if (handlerRef.current === fn) handlerRef.current = null; };
  }, []);

  // Always returns a promise so the spinner can wait for the real fetch.
  const run = useCallback(async () => {
    if (handlerRef.current) { await handlerRef.current(); return; }
    window.location.reload();
  }, []);

  return (
    <RefreshContext.Provider value={{ register, run }}>
      {children}
    </RefreshContext.Provider>
  );
};

export const useRefreshRunner = () => useContext(RefreshContext);

// Register the current page's refetch. `fn` should return a promise (awaited).
export const useRegisterRefresh = (fn) => {
  const ctx = useContext(RefreshContext);
  useEffect(() => {
    if (!ctx || typeof fn !== 'function') return undefined;
    return ctx.register(fn);
  }, [ctx, fn]);
};

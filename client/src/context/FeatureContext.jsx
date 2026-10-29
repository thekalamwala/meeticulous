import { createContext, useContext, useEffect, useState } from 'react';
import { prerendered } from '../services/prerenderData';
import { getFeatureFlags } from '../services/api';
import { useAuth } from './AuthContext';
import { resolveFeature } from '../utils/featureBypass';

/**
 * FeatureContext — loads the public feature-flag map once and exposes it app-wide.
 *
 * Fail-OPEN: while loading, on error, or for any key the server didn't return,
 * `isOn(key)` is `true`. A flag only hides/blocks UI when the admin has an
 * explicit `enabled = false` row. Mirrors the server's fail-open guard so the
 * two layers never disagree on the safe default.
 */

const FeatureContext = createContext({ flags: {}, ready: false, isOn: () => true });

export const FeatureProvider = ({ children }) => {
  // Prerendered pages bake the build-time flags: start from them so the first
  // render already has them (no flag-gated UI popping in); the fetch refreshes.
  const baked = prerendered('/feature-flags');
  const [flags, setFlags] = useState(() => (baked && typeof baked === 'object' ? baked : {}));
  const [ready, setReady] = useState(!!baked);

  useEffect(() => {
    let alive = true;
    getFeatureFlags()
      .then(({ data }) => { if (alive) setFlags(data && typeof data === 'object' ? data : {}); })
      .catch(() => { if (alive) setFlags({}); })
      .finally(() => { if (alive) setReady(true); });
    return () => { alive = false; };
  }, []);

  const isOn = (key) => (key in flags ? !!flags[key] : true);

  return (
    <FeatureContext.Provider value={{ flags, ready, isOn }}>
      {children}
    </FeatureContext.Provider>
  );
};

export const useFeatures = () => useContext(FeatureContext);

/**
 * Convenience hook: `const showCover = useFeature('cover_photo')`.
 * Layers the Supreme kill-switch bypass on top of the flag map: a holder whose
 * /auth/me carried `bypasses_flags` sees an OFF feature unless its key is on the
 * server-supplied `safety_keys` denylist. `useAuth()` is undefined outside an
 * AuthProvider (e.g. isolated tests) → no user → plain flag-map behaviour.
 */
export const useFeature = (key) => {
  const base = useContext(FeatureContext).isOn(key);
  const auth = useAuth();
  return resolveFeature(base, key, auth?.user);
};

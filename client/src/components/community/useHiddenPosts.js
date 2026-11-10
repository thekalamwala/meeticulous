import { useCallback, useState } from 'react';

// "Hide it" is a per-viewer convenience, kept in localStorage (never server state).
// Wrapped in try/catch so private windows / blocked storage degrade to in-memory only.
const KEY = 'mt_community_hidden';

const load = () => {
  try { return new Set(JSON.parse(localStorage.getItem(KEY) || '[]')); } catch { return new Set(); }
};

export default function useHiddenPosts() {
  const [hidden, setHidden] = useState(load);
  const hide = useCallback((id) => {
    setHidden((prev) => {
      const next = new Set(prev).add(id);
      try { localStorage.setItem(KEY, JSON.stringify([...next])); } catch { /* storage blocked */ }
      return next;
    });
  }, []);
  return { hidden, hide, isHidden: useCallback((id) => hidden.has(id), [hidden]) };
}

import { useEffect, useRef, useState } from 'react';

// Keeps a sheet mounted while it animates out.
//
// `{open && <Sheet/>}` can only ever animate IN — React tears the node out the moment
// the flag flips, so the exit never gets a frame. This holds the node for the length of
// the close animation and reports a phase the markup can style.
//
// Returns { mounted, phase }: render while `mounted`, and put `phase` ('open' | 'closing')
// on the elements so CSS can pick the matching animation.
export default function useSheet(open, ms = 260) {
  const [mounted, setMounted] = useState(open);
  const [phase, setPhase] = useState(open ? 'open' : 'closing');
  const timer = useRef(null);

  useEffect(() => {
    clearTimeout(timer.current);
    if (open) {
      setMounted(true);
      // Mount first, paint, then switch to 'open' so the entry animation has a start state.
      timer.current = setTimeout(() => setPhase('open'), 10);
    } else if (mounted) {
      setPhase('closing');
      timer.current = setTimeout(() => setMounted(false), ms);
    }
    return () => clearTimeout(timer.current);
  }, [open, ms, mounted]);

  return { mounted, phase };
}

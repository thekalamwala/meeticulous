import { useEffect, useState } from 'react';

// Pixels the on-screen keyboard currently occludes at the bottom of the layout
// viewport, from the VisualViewport API. 0 when there's no keyboard or the API
// is unsupported. Pair with `interactive-widget=resizes-content` (index.html):
// browsers that resize the layout viewport report ~0 here (the fixed container
// already shrinks); browsers that overlay the keyboard report its height, which
// the composer uses to translate its bottom toolbar up and keep it visible.
export default function useKeyboardInset() {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return undefined;
    const update = () => setInset(Math.max(0, window.innerHeight - vv.height - vv.offsetTop));
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => { vv.removeEventListener('resize', update); vv.removeEventListener('scroll', update); };
  }, []);
  return inset;
}

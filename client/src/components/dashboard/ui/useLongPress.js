import { useCallback, useRef } from 'react';

// Fires onLongPress after `delay` ms of sustained pointer press.
// Spread the returned handlers onto the target element.
export function useLongPress(onLongPress, { delay = 450 } = {}) {
  const timer = useRef(null);
  const clear = useCallback(() => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
  }, []);
  const start = useCallback((e) => {
    clear();
    timer.current = setTimeout(() => onLongPress?.(e), delay);
  }, [onLongPress, delay, clear]);
  return {
    onPointerDown: start,
    onPointerUp: clear,
    onPointerLeave: clear,
    onPointerCancel: clear,
  };
}

export default useLongPress;

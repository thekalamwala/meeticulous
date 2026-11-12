import { useEffect, useRef } from 'react';

const FOCUSABLE = 'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled])';

// Focus-trap for overlay dialogs (drawer, bottom sheet): focus moves inside on
// mount, Tab cycles within, Esc closes, focus returns to the opener on unmount.
// Same mechanics as Dialog.jsx, extracted so the drawer/sheet reuse it.
export default function useFocusTrap(onClose) {
  const ref = useRef(null);
  useEffect(() => {
    const opener = document.activeElement;
    ref.current?.querySelector(FOCUSABLE)?.focus();
    return () => { if (opener?.isConnected) opener.focus?.(); };
  }, []);

  const onKeyDown = (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); onClose(); return; }
    if (e.key !== 'Tab') return;
    const f = [...(ref.current?.querySelectorAll(FOCUSABLE) || [])];
    if (!f.length) return;
    const first = f[0];
    const last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };

  return { ref, onKeyDown };
}

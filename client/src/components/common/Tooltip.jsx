import { useState, useRef, useEffect, useId } from "react";

/**
 * Small accessible tooltip. The trigger is a real <button>, so it works on tap
 * (mobile), hover (mouse) and keyboard focus; Escape and an outside tap close it.
 * Used for the "Limited" chips on /pricing so a small free-plan number lives in
 * the tooltip instead of being printed bare on the page.
 */
export default function Tooltip({ content, children, className = "" }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span
      ref={wrapRef}
      className={`relative inline-flex ${className}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-describedby={open ? id : undefined}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="inline-flex items-center"
      >
        {children}
      </button>
      {open && (
        <span
          role="tooltip"
          id={id}
          className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-max max-w-[220px] -translate-x-1/2 rounded-[6px] bg-ink px-3 py-2 text-xs font-medium leading-snug text-white shadow-lg"
        >
          {content}
          <span
            className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-ink"
            aria-hidden="true"
          />
        </span>
      )}
    </span>
  );
}

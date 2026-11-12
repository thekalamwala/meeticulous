import { useRef, useState } from 'react';
import { ArrowRight, Check, Loader2 } from 'lucide-react';

// Slide-to-confirm button (kokonutui pattern, brand colours, no deps).
// Drag the thumb past 90% to fire onConfirm; release early springs back.
// Enter/Space confirm. States: idle → confirming (spinner, ≥800ms) → done.
const INSET = 4;   // left-1 / top-1
const THUMB = 48;  // h-12 w-12

export default function SlideToConfirm({
  label = 'Slide to confirm',
  confirmingLabel = 'Please wait…',
  doneLabel = 'Done',
  onConfirm,
  resetAfter = 2600,
  disabled = false,
}) {
  const trackRef = useRef(null);
  const drag = useRef(null);
  const [x, setX] = useState(0);
  const [phase, setPhase] = useState('idle'); // idle | dragging | confirming | done

  const maxX = () => Math.max(0, (trackRef.current?.offsetWidth || 0) - THUMB - INSET * 2);
  const back = () => { setPhase('idle'); setX(0); };

  const confirm = async () => {
    if (phase === 'confirming' || phase === 'done') return;
    setPhase('confirming');
    setX(maxX());
    const t0 = Date.now();
    try { await Promise.resolve(onConfirm?.()); }
    catch { setTimeout(back, 300); return; }
    setTimeout(() => {
      setPhase('done');
      if (resetAfter != null) setTimeout(back, resetAfter);
    }, Math.max(0, 800 - (Date.now() - t0)));
  };

  const onDown = (e) => {
    if (disabled || phase === 'confirming' || phase === 'done') return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    drag.current = { x0: e.clientX, off: x };
    setPhase('dragging');
  };
  const onMove = (e) => {
    if (!drag.current) return;
    setX(Math.max(0, Math.min(maxX(), drag.current.off + (e.clientX - drag.current.x0))));
  };
  const onUp = () => {
    if (!drag.current) return;
    const m = maxX();
    const done = m > 0 && x / m >= 0.9;
    drag.current = null;
    if (done) confirm(); else back();
  };
  const onKey = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); confirm(); } };

  const done = phase === 'done';
  const pct = (() => { const m = maxX(); return m ? x / m : 0; })();
  const snap = phase === 'dragging' ? 'none' : 'transform .35s cubic-bezier(.22,1,.36,1)';

  return (
    <div
      ref={trackRef}
      className={`relative h-14 w-full select-none overflow-hidden rounded-full border-2 ${
        done ? 'border-maroon bg-blush' : 'border-ink/10 bg-cream'} ${disabled ? 'opacity-60' : ''}`}
    >
      {/* ink fill behind the thumb */}
      <div
        className="absolute inset-y-0 left-0 rounded-full bg-maroon"
        style={{ width: `${x + THUMB + INSET}px`, transition: phase === 'dragging' ? 'none' : 'width .35s cubic-bezier(.22,1,.36,1)' }}
        aria-hidden="true"
      />
      <span
        aria-live="polite"
        className={`pointer-events-none absolute inset-0 flex items-center justify-center pl-10 text-sm font-semibold ${
          done || pct > 0.5 ? 'text-cream' : 'text-ink/60'}`}
      >
        {done ? doneLabel : phase === 'confirming' ? confirmingLabel : label}
      </span>
      <button
        type="button"
        role="slider"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct * 100)}
        disabled={disabled}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onKeyDown={onKey}
        className="absolute left-1 top-1 grid h-12 w-12 touch-none place-items-center rounded-full bg-maroon text-cream shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose"
        style={{ transform: `translateX(${x}px)`, transition: snap }}
      >
        {phase === 'confirming'
          ? <Loader2 size={20} className="animate-spin" aria-hidden="true" />
          : done ? <Check size={20} aria-hidden="true" /> : <ArrowRight size={20} aria-hidden="true" />}
      </button>
    </div>
  );
}

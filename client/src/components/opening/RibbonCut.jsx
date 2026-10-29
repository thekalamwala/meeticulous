/**
 * RibbonCut.jsx — the interaction. A soft orange ribbon across the ink stage with
 * a floating scissors knob. Drag the knob along the ribbon (mouse or finger);
 * cross ~68% of its width and it snips — halves ease away, haptic buzz.
 *
 * One-shot. Keyboard-accessible (Enter/Space cuts) so nobody is trapped behind a
 * drag gesture; reduced-motion still works (the cut just isn't animated).
 */
import { useRef, useState } from 'react';
import { Scissors } from 'lucide-react';

const THRESHOLD = 0.68;

export default function RibbonCut({ onCut }) {
  const barRef = useRef(null);
  const [progress, setProgress] = useState(0);
  const [cut, setCut] = useState(false);
  const dragging = useRef(false);

  const doCut = () => {
    if (cut) return;
    setCut(true);
    setProgress(1);
    navigator.vibrate?.(60);
    onCut?.();
  };

  const moveTo = (clientX) => {
    const bar = barRef.current;
    if (!bar) return;
    const r = bar.getBoundingClientRect();
    const p = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    setProgress(p);
    if (p >= THRESHOLD) doCut();
  };

  const onDown = (e) => { dragging.current = true; e.currentTarget.setPointerCapture?.(e.pointerId); };
  const onMove = (e) => { if (dragging.current) moveTo(e.clientX); };
  const onUp = () => { dragging.current = false; if (!cut) setProgress(0); };

  const halfEase = 'transform 900ms cubic-bezier(.6,0,.2,1), opacity 900ms ease';

  return (
    <div className="w-full max-w-xl mx-auto select-none">
      <div
        ref={barRef}
        className="relative mx-auto h-[52px] w-full"
        style={{ touchAction: 'none', cursor: cut ? 'default' : 'grab' }}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
        role="slider" aria-label="Drag the scissors across the ribbon to cut it"
        aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)} tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); doCut(); } }}
      >
        {/* left half */}
        <span className="absolute top-1/2 left-0 h-[26px] rounded-[5px]"
          style={{
            width: `${(cut ? 0.5 : Math.max(progress, 0.001)) * 100}%`,
            background: 'linear-gradient(180deg,#ff7a3c,#2E1065)',
            boxShadow: '0 6px 16px rgba(254,81,0,.35)',
            transform: cut ? 'translateY(-50%) translateX(-64%) rotate(-6deg)' : 'translateY(-50%)',
            opacity: cut ? 0 : 1,
            transition: cut ? halfEase : 'none',
          }} />
        {/* right half */}
        <span className="absolute top-1/2 right-0 h-[26px] rounded-[5px]"
          style={{
            width: `${(cut ? 0.5 : Math.max(1 - progress, 0.001)) * 100}%`,
            background: 'linear-gradient(180deg,#ff7a3c,#2E1065)',
            boxShadow: '0 6px 16px rgba(254,81,0,.35)',
            transform: cut ? 'translateY(-50%) translateX(64%) rotate(6deg)' : 'translateY(-50%)',
            opacity: cut ? 0 : 1,
            transition: cut ? halfEase : 'none',
          }} />
        {/* scissors knob */}
        {!cut && (
          <span className="absolute top-1/2 z-10 grid h-[54px] w-[54px] -translate-y-1/2 place-items-center rounded-full bg-white text-primary"
            style={{ left: `calc(${progress * 100}% - 27px)`, boxShadow: '0 22px 45px -18px rgba(26,26,26,.55)' }}>
            <Scissors size={24} strokeWidth={2} />
          </span>
        )}
      </div>
    </div>
  );
}

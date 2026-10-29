import { useState, useEffect, useRef } from 'react';

// ───────────────────────────────────────────────────────────────────────────
// Preloader timing state machine.
//
//   greet ──(elapsed ≥ min AND (ready OR elapsed ≥ max))──▶ brand
//   brand ──(brandDuration)──▶ exit
//   exit  ──(exitDuration)──▶ hidden ▶ onDone()
//
// Guarantees: never vanishes before `min` (no flash), never hangs past `max`
// (hard cap). StrictMode-safe: timers cleaned per effect, onDone fired once.
// ───────────────────────────────────────────────────────────────────────────
export default function usePreloader({
  ready = false,
  minDuration = 1200,
  maxDuration = 3000,
  brandDuration = 620,
  exitDuration = 520,
  onDone,
}) {
  const [phase, setPhase] = useState('greet');
  const startRef = useRef(null);
  if (startRef.current === null) startRef.current = Date.now();
  const doneRef = useRef(false);

  // greet → brand: poll cheaply until min met and (content ready or capped).
  useEffect(() => {
    if (phase !== 'greet') return undefined;
    const tick = () => {
      const elapsed = Date.now() - startRef.current;
      if (elapsed >= minDuration && (ready || elapsed >= maxDuration)) setPhase('brand');
    };
    tick();
    const id = setInterval(tick, 80);
    return () => clearInterval(id);
  }, [phase, ready, minDuration, maxDuration]);

  // brand → exit
  useEffect(() => {
    if (phase !== 'brand') return undefined;
    const id = setTimeout(() => setPhase('exit'), brandDuration);
    return () => clearTimeout(id);
  }, [phase, brandDuration]);

  // exit → hidden (+ onDone once)
  useEffect(() => {
    if (phase !== 'exit') return undefined;
    const id = setTimeout(() => {
      setPhase('hidden');
      if (!doneRef.current) { doneRef.current = true; onDone?.(); }
    }, exitDuration);
    return () => clearTimeout(id);
  }, [phase, exitDuration, onDone]);

  return phase;
}

import { useState, useEffect, useMemo, useCallback } from 'react';
import usePreloader from './usePreloader';
import { ensureGreetingFonts } from './fontLoader';
import { resolveGreetings } from './greetings';
import './preloader.css';

// ───────────────────────────────────────────────────────────────────────────
// <BrandPreloader> — universal branded welcome overlay.
//
// Renders as a fixed full-screen overlay ABOVE the real page (which mounts
// underneath), so there is zero layout shift and assets load behind it. Self-
// manages timing via usePreloader; fades out and unmounts when content is ready.
//
//   <BrandPreloader variant="homepage" ready={assetsReady} />
//   <BrandPreloader variant="profile"  ready={!loading} profileName={name} accentColor={tc} />
// ───────────────────────────────────────────────────────────────────────────

const CYCLE_MS = 380;  // greeting swap cadence

// Show the branded intro at most once per browser session — every public-page
// load after the first skips straight to content.
const SESSION_KEY = 'bas_intro_shown';

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export default function BrandPreloader({
  variant = 'homepage',
  ready = false,
  profileName = null,
  accentColor = '#960D32',
  minDuration,
  maxDuration,
  onDone,
}) {
  const reduce = useMemo(prefersReducedMotion, []);

  // Skip the intro entirely for reduced-motion users and for any load after the
  // first this session — it must never sit on the LCP critical path twice.
  const skipIntro = useMemo(() => {
    if (reduce) return true;
    try { return sessionStorage.getItem(SESSION_KEY) === '1'; } catch (_) { return false; }
  }, [reduce]);

  // Snappy + readiness-gated: a brief greeting, then exit as soon as the page
  // reports `ready` (hard-capped so a slow network never hangs the hero behind
  // it). Content loads under the fixed overlay, so there's zero layout shift.
  const greetMs = minDuration ?? 400;
  const capMs = maxDuration ?? 1200;
  const brandMs = 400;
  const exitMs = 320;

  const [skipped, setSkipped] = useState(false);
  const phase = usePreloader({
    // When skipping, drive the machine to 'hidden' immediately so onDone (if any)
    // still fires for callers that gate on it.
    ready: skipIntro ? true : ready,
    minDuration: (skipIntro || skipped) ? 0 : greetMs,
    maxDuration: (skipIntro || skipped) ? 0 : capMs,
    brandDuration: skipIntro ? 0 : brandMs,
    exitDuration: skipIntro ? 0 : exitMs,
    onDone,
  });

  // Mark the session so later public-page loads skip the intro.
  useEffect(() => { try { sessionStorage.setItem(SESSION_KEY, '1'); } catch (_) {} }, []);

  // Inject greeting Noto subsets only when we'll actually show greetings.
  useEffect(() => { if (!skipIntro) ensureGreetingFonts(); }, [skipIntro]);

  // Greeting cycling — only while greeting.
  const greetings = useMemo(() => resolveGreetings({ variant }), [variant]);
  const [gi, setGi] = useState(0);
  useEffect(() => {
    if (phase !== 'greet') return undefined;
    const id = setInterval(() => setGi((i) => (i + 1) % greetings.length), CYCLE_MS);
    return () => clearInterval(id);
  }, [phase, greetings.length]);

  // Body scroll lock + aria-busy while the overlay is up.
  useEffect(() => {
    if (skipIntro || phase === 'hidden') return undefined;
    const root = document.getElementById('root');
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    root?.setAttribute('aria-busy', 'true');
    return () => {
      document.body.style.overflow = prev;
      root?.removeAttribute('aria-busy');
    };
  }, [phase, skipIntro]);

  // ESC = skip for power users.
  const onKey = useCallback((e) => { if (e.key === 'Escape') setSkipped(true); }, []);
  useEffect(() => {
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onKey]);

  if (skipIntro || phase === 'hidden') return null;

  const g = greetings[gi % greetings.length] || greetings[0];
  const showBrand = phase === 'brand' || phase === 'exit';

  const srMessage =
    variant === 'profile'
      ? `Loading ${profileName || 'profile'} on Meeticulous`
      : 'Welcome to Meeticulous';

  return (
    <div
      className="pl-overlay"
      data-phase={phase}
      data-variant={variant}
      style={{ '--pl-accent': accentColor }}
      role="status"
      aria-live="polite"
      aria-label={srMessage}
    >
      <p className="pl-sr">{srMessage}</p>

      <div className="pl-stack">
        {!showBrand ? (
          // Cycling greeting. key remount retriggers the enter animation.
          <p
            key={gi}
            className="pl-greet"
            aria-hidden="true"
            lang={g.lang}
            style={g.font ? { fontFamily: `'${g.font}', 'Poppins', sans-serif` } : undefined}
          >
            {g.text}
          </p>
        ) : variant === 'profile' && profileName ? (
          // Profile: personal handoff.
          <div className="pl-brand" aria-hidden="true">
            <p className="pl-brand__sub">You’re visiting</p>
            <h2 className="pl-brand__word">
              <span className="pl-brand__name">{profileName}</span>
            </h2>
            <span className="pl-brand__dot" />
          </div>
        ) : (
          // Homepage / fallback: brand lockup.
          <div className="pl-brand" aria-hidden="true">
            <span className="pl-brand__mark">🦥</span>
            <h2 className="pl-brand__word">Meeticulous</h2>
            <span className="pl-brand__dot" />
          </div>
        )}
      </div>

      <div className="pl-progress" aria-hidden="true">
        <span className="pl-progress__bar" />
      </div>
    </div>
  );
}

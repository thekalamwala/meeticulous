// CalendarConnect — graduated from the host-lab Calendars prototype.
//
// Only Google is a real integration: connecting is an OAuth redirect
// (getGoogleAuthUrl), connected state rides on `user.google_calendar_connected`,
// and there is no disconnect endpoint yet — so a connected calendar points the
// host at Google/support to revoke, matching ProfileSetup. Apple and Outlook
// have no backend, so they show as "Coming soon".
import { useRef, useState } from 'react';
import { Lock, LockOpen } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { getGoogleAuthUrl } from '../../services/api';
import { cn } from '../dashboard/ui';

/* ── Provider marks (third-party integration logos) ───────────────────────── */
export const GoogleMark = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <path fill="#4285F4" d="M23.52 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.47a5.54 5.54 0 0 1-2.4 3.63v3h3.88c2.27-2.09 3.57-5.17 3.57-8.87z" />
    <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.76-2.11-6.7-4.94H1.3v3.1A11.99 11.99 0 0 0 12 24z" />
    <path fill="#FBBC05" d="M5.3 14.31a7.2 7.2 0 0 1 0-4.6V6.6H1.3a12 12 0 0 0 0 10.8l4-3.09z" />
    <path fill="#EA4335" d="M12 4.77c1.76 0 3.35.61 4.6 1.8l3.44-3.44A11.47 11.47 0 0 0 12 0 11.99 11.99 0 0 0 1.3 6.6l4 3.1C6.24 6.88 8.88 4.77 12 4.77z" />
  </svg>
);
const AppleMark = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <path fill="#1A1A1A" d="M17.05 12.54c-.03-2.72 2.22-4.02 2.32-4.08-1.27-1.85-3.24-2.1-3.94-2.13-1.68-.17-3.28.99-4.13.99-.85 0-2.16-.97-3.56-.94-1.83.03-3.52 1.06-4.46 2.7-1.9 3.3-.49 8.19 1.36 10.87.9 1.31 1.98 2.78 3.39 2.73 1.36-.05 1.87-.88 3.52-.88 1.64 0 2.11.88 3.55.85 1.47-.03 2.4-1.34 3.3-2.65 1.04-1.52 1.47-2.99 1.49-3.07-.03-.01-2.86-1.1-2.89-4.36zM14.4 4.54c.75-.91 1.25-2.17 1.11-3.43-1.08.04-2.38.72-3.15 1.63-.69.8-1.3 2.08-1.14 3.31 1.2.09 2.43-.61 3.18-1.51z" />
  </svg>
);
const OutlookMark = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <rect x="2.5" y="5" width="12.5" height="14" rx="2" fill="#0F6CBD" />
    <text x="8.75" y="15.5" textAnchor="middle" fontSize="9.5" fontWeight="700" fill="#fff" fontFamily="Arial, sans-serif">O</text>
    <path d="M15 9.5l6-1.4v7.8l-6-1.4z" fill="#0F6CBD" opacity="0.7" />
  </svg>
);
const MARK = { google: GoogleMark, apple: AppleMark, outlook: OutlookMark };
const providerMark = (key) => {
  const M = MARK[key];
  return M ? <M className="h-5 w-5" /> : null;
};

/* ── LockSlider — drag-to-slide lock. Grab the knob and slide past halfway.
 * Vertical: top = locked/connected, bottom = unlocked. A ref tracks the live
 * position so the decision on release is read synchronously. ─────────────── */
const LockSlider = ({ connected, onToggle, label, comingSoon = false, vertical = false }) => {
  const ref = useRef(null);
  const dragRef = useRef(null);
  const [frac, setFrac] = useState(null);
  const locked = connected && !comingSoon;

  const fracFrom = (e) => {
    const r = ref.current.getBoundingClientRect();
    const raw = vertical ? (e.clientY - r.top) / r.height : (e.clientX - r.left) / r.width;
    return Math.min(1, Math.max(0, raw));
  };
  const down = (e) => {
    if (comingSoon) return;
    try { ref.current.setPointerCapture(e.pointerId); } catch { /* synthetic */ }
    dragRef.current = fracFrom(e);
    setFrac(dragRef.current);
  };
  const move = (e) => { if (dragRef.current !== null) { dragRef.current = fracFrom(e); setFrac(dragRef.current); } };
  const up = () => {
    if (dragRef.current === null) return;
    const f = dragRef.current;
    dragRef.current = null;
    setFrac(null);
    const toLocked = vertical ? f < 0.5 : f > 0.5;
    if (toLocked !== locked) onToggle();
  };

  const showLock = comingSoon || (frac != null ? (vertical ? frac < 0.5 : frac > 0.5) : locked);
  const lit = showLock && !comingSoon;
  let knobStyle;
  if (vertical) {
    const top = frac != null ? `calc(${(frac * 100).toFixed(1)}% - 16px)` : locked ? '4px' : 'calc(100% - 36px)';
    knobStyle = { left: '50%', transform: 'translateX(-50%)', top, transition: frac != null ? 'none' : undefined };
  } else {
    const left = frac != null ? `calc(${(frac * 100).toFixed(1)}% - 16px)` : locked ? 'calc(100% - 36px)' : '4px';
    knobStyle = { top: '50%', transform: 'translateY(-50%)', left, transition: frac != null ? 'none' : undefined };
  }

  return (
    <button
      ref={ref}
      type="button"
      role="switch"
      aria-checked={connected}
      aria-label={label}
      disabled={comingSoon}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      className={cn(
        'relative shrink-0 touch-none select-none overflow-hidden rounded-full border-2 transition-colors',
        vertical ? 'w-11 self-stretch' : 'h-9 w-full',
        comingSoon ? 'cursor-not-allowed border-neutral-200 bg-neutral-100' : lit ? 'cursor-grab border-maroon bg-maroon' : 'cursor-grab border-neutral-300 bg-neutral-100',
      )}
    >
      {!vertical && (
        <span className={cn('pointer-events-none absolute top-1/2 -translate-y-1/2 text-[10px] font-bold uppercase tracking-wide', comingSoon ? 'right-4 text-ink/35' : lit ? 'left-4 text-white/85' : 'right-4 text-ink/45')}>
          {comingSoon ? 'Coming soon' : lit ? 'Connected' : 'Slide'}
        </span>
      )}
      <span className={cn('absolute grid h-8 w-8 place-items-center rounded-full shadow-[0_1px_3px_rgba(21,19,41,0.25)]', comingSoon ? 'bg-neutral-200' : 'bg-white')} style={knobStyle}>
        {showLock
          ? <Lock className={cn('h-4 w-4', comingSoon ? 'text-ink/35' : 'text-maroon')} strokeWidth={2.4} />
          : <LockOpen className="h-4 w-4 text-ink/45" strokeWidth={2.4} />}
      </span>
    </button>
  );
};

const BLURB = {
  google: 'Two-way sync. Your Google busy times block new bookings, and confirmed meetings get a Google Meet link automatically.',
  apple: 'Apple Calendar sync is on the way — connect it here soon.',
  outlook: 'Microsoft Outlook sync is on the way — connect your work calendar here soon.',
};

// Starts the Google OAuth redirect; returns to the Schedule page after consent.
export const connectGoogleCalendar = () => getGoogleAuthUrl('/dashboard/availability')
  .then(({ data }) => { window.location.href = data.url; })
  .catch(() => toast.error('Could not start Google sign-in. Please try again.'));
// No disconnect endpoint yet — point the host at Google/support (same as ProfileSetup).
export const googleDisconnectHint = () => toast('To disconnect, revoke access in your Google account settings or contact support.', { icon: 'ℹ️' });

export default function CalendarConnect() {
  const { user } = useAuth() || {};
  const googleConnected = !!user?.google_calendar_connected;

  const connectGoogle = connectGoogleCalendar;

  const providers = [
    { key: 'google', name: 'Google Calendar', real: true, connected: googleConnected, status: googleConnected ? (user?.email || 'Connected') : 'Not connected' },
    { key: 'apple', name: 'Apple Calendar', real: false, connected: false, status: 'Coming soon' },
    { key: 'outlook', name: 'Outlook Calendar', real: false, connected: false, status: 'Coming soon' },
  ];

  const onToggle = (p) => {
    if (!p.real) return;
    if (p.connected) googleDisconnectHint();
    else connectGoogle();
  };

  return (
    <div>
      {/* Mobile: tall bento cards with a vertical slide-to-connect lock. */}
      <div className="flex flex-col gap-3 sm:hidden">
        {providers.map((p) => (
          <div key={p.key} className={cn('flex min-h-[132px] items-stretch gap-3 rounded-3xl bg-white p-4 shadow-[0_1px_2px_rgba(43,10,20,0.04),0_12px_26px_-18px_rgba(43,10,20,0.16)]', !p.real && 'bg-white/70')}>
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-neutral-50', !p.real && 'grayscale')}>{providerMark(p.key)}</span>
                <p className={cn('min-w-0 flex-1 truncate text-[14px] font-extrabold', p.real ? 'text-ink' : 'text-ink/55')}>
                  {p.name}<span className={cn('ml-2 text-[11px] font-medium', p.real ? 'text-ink/45' : 'text-ink/40')}>{p.status}</span>
                </p>
              </div>
              <p className={cn('text-[11.5px] leading-relaxed', p.real ? 'text-ink/50' : 'text-ink/40')}>{BLURB[p.key]}</p>
            </div>
            <LockSlider vertical connected={p.connected} comingSoon={!p.real} onToggle={() => onToggle(p)} label={`${p.name} connection`} />
          </div>
        ))}
      </div>

      {/* Desktop: a de-boxed list. */}
      <div className="hidden overflow-hidden rounded-2xl border border-neutral-200/70 bg-white shadow-[0_1px_2px_rgba(43,10,20,0.03)] sm:block">
        <ul className="divide-y divide-neutral-200/50">
          {providers.map((p) => (
            <li key={p.key} className="flex items-center gap-3 px-4 py-3">
              <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-neutral-50', !p.real && 'grayscale')}>{providerMark(p.key)}</span>
              <span className="min-w-0 flex-1">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className={cn('truncate text-[12.5px] font-bold', p.real ? 'text-ink' : 'text-ink/55')}>{p.name}</span>
                  {p.connected && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-success-fg" />}
                </span>
                <span className={cn('mt-0.5 block truncate text-[11px] font-medium', p.real ? 'text-ink/50' : 'text-ink/40')}>{p.status}</span>
              </span>
              {!p.real ? (
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-neutral-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-ink/40">
                  <Lock className="h-3 w-3" strokeWidth={2.4} /> Soon
                </span>
              ) : p.connected ? (
                <button type="button" onClick={googleDisconnectHint} className="shrink-0 rounded-full border-2 border-success-fg/40 px-3 py-1.5 text-[11px] font-bold text-success-fg">
                  Connected ✓
                </button>
              ) : (
                <button type="button" onClick={connectGoogle} className="shrink-0 rounded-full bg-maroon px-4 py-1.5 text-[11px] font-bold text-white transition hover:bg-maroon-dark">
                  Connect
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

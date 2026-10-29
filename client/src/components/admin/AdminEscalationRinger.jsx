// Mounted once in AdminLayout — so ANY open admin dashboard reacts. Subscribes to
// the `support:admin` station channel and, on a new escalation, loops a ringtone
// (tring_tring.mp3), pops a persistent "Open" toast, and flashes the tab title.
// The ring keeps going until an admin clicks Open (or another escalation resets
// it) — no auto-stop. Audio only plays once the browser has unlocked it on a user
// gesture; otherwise the visual toast + title flash still fire, never a silent miss.
import { useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { getSupabase } from '../../services/supabaseClient';

const RING_SRC = '/sounds/tring_tring.mp3';

export default function AdminEscalationRinger() {
  const navigate = useNavigate();
  const audioRef = useRef(null);
  const titleTimer = useRef(null);
  const origTitle = useRef(null);

  // Autoplay policy: audio can only play after a user gesture. Prime the element
  // on the first interaction (play→pause) so it's unlocked by the time an
  // escalation arrives — an admin using the console has already clicked.
  useEffect(() => {
    const a = new Audio(RING_SRC);
    a.loop = true;
    a.preload = 'auto';
    audioRef.current = a;
    let unlocked = false;
    const unlock = () => {
      if (unlocked) return;
      unlocked = true;
      try {
        const p = a.play();
        if (p?.then) p.then(() => { a.pause(); a.currentTime = 0; }).catch(() => { /* stays locked */ });
      } catch { /* audio unavailable — visual only */ }
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      a.pause();
    };
  }, []);

  const stopRing = () => {
    const a = audioRef.current;
    if (a) { a.pause(); a.currentTime = 0; }
    if (titleTimer.current) { clearInterval(titleTimer.current); titleTimer.current = null; }
    if (origTitle.current != null) { document.title = origTitle.current; origTitle.current = null; }
  };

  const startRing = () => {
    stopRing();
    const a = audioRef.current;
    if (a) {
      try { a.currentTime = 0; const p = a.play(); if (p?.catch) p.catch(() => { /* locked */ }); }
      catch { /* audio unavailable — visual only */ }
    }
    // Flash the tab title so a backgrounded console still gets noticed.
    origTitle.current = document.title;
    let on = false;
    titleTimer.current = setInterval(() => {
      on = !on;
      document.title = on ? '🔴 Support needed' : (origTitle.current || 'Meeticulous');
    }, 1000);
  };

  useEffect(() => {
    let cancelled = false;
    let chan = null;
    (async () => {
      const sb = await getSupabase();
      if (cancelled) return;
      chan = sb
        .channel('support:admin')
        .on('broadcast', { event: 'escalation' }, ({ payload }) => {
          startRing();
          const ref = payload?.reference || 'a customer';
          const who = payload?.participant_type === 'host' ? 'Host' : 'Guest';
          toast((tt) => (
            <span className="flex items-center gap-3">
              <span>🚨 New escalation — <b>{ref}</b> ({who})</span>
              <button
                onClick={() => { stopRing(); toast.dismiss(tt.id); navigate('/admin/support/chat'); }}
                className="rounded bg-[#2E1065] px-2 py-1 text-xs font-semibold text-white">
                Open
              </button>
            </span>
          ), { duration: Infinity, id: `esc-${payload?.thread_id || ref}` });
        })
        .subscribe();
    })();
    return () => {
      cancelled = true;
      stopRing();
      if (chan) getSupabase().then((sb) => sb.removeChannel(chan)).catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  return null;
}

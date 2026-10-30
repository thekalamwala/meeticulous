import { useMemo, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { HostAvatar } from '../../components/common/HostAvatar';
import Button from '../../components/dashboard/ui/Button';
import { genSlots } from './demoData';

const STEPS = ['service', 'time', 'confirmed'];
const fmtPrice = (p) => (p === 0 ? 'Free' : `₹${p.toLocaleString('en-IN')}`);
const fmtTime = (t) => { const [h, m] = t.split(':').map(Number); const ap = h < 12 ? 'AM' : 'PM'; const hr = h % 12 || 12; return `${hr}:${String(m).padStart(2, '0')} ${ap}`; };

export default function BookingDemo({ host, onConfirmed }) {
  const reduce = useReducedMotion();
  const tc = host.accent_color || '#960D32';
  const [step, setStep] = useState('service');
  const [service, setService] = useState(null);
  const [date, setDate] = useState(null);       // ISO yyyy-mm-dd
  const [slot, setSlot] = useState(null);
  const [month, setMonth] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; });

  const days = useMemo(() => {
    const first = new Date(month.y, month.m, 1).getDay();
    const count = new Date(month.y, month.m + 1, 0).getDate();
    return [...Array(first).fill(null), ...Array.from({ length: count }, (_, i) => i + 1)];
  }, [month]);
  const todayISO = new Date().toISOString().slice(0, 10);
  const iso = (n) => `${month.y}-${String(month.m + 1).padStart(2, '0')}-${String(n).padStart(2, '0')}`;
  const selectable = (n) => n && iso(n) >= todayISO;
  const slots = date ? genSlots(date) : [];

  const reset = () => { setStep('service'); setService(null); setDate(null); setSlot(null); };
  const confirm = () => { setStep('confirmed'); if (!reduce) confetti({ particleCount: 90, spread: 70, origin: { y: 0.6 }, colors: [tc, '#FFB703', '#960D32'] }); onConfirmed?.(); };

  return (
    <div className="page-card p-5 sm:p-7" style={{ '--tc': tc }}>
      {/* header */}
      <div className="flex items-center gap-3 mb-5">
        <HostAvatar src={host.profile_image} name={host.name} themeColor={tc} size={44} shape="rounded" />
        <div><p className="font-heading font-bold leading-tight">{host.name}</p><p className="text-sm text-muted">Book a session</p></div>
      </div>
      {/* stepper */}
      <div className="flex items-center gap-2 mb-6" aria-hidden="true">
        {STEPS.map((s, i) => (
          <div key={s} className="flex-1 h-1.5 rounded-full" style={{ background: STEPS.indexOf(step) >= i ? tc : '#eee' }} />
        ))}
      </div>

      {step === 'service' && (
        <div className="grid gap-3">
          {host.services.map((sv) => (
            <button key={sv.id} onClick={() => { setService(sv); setStep('time'); }}
              className="page-card text-left p-4 hover:-translate-y-0.5 transition-transform flex justify-between items-center gap-4">
              <span><span className="font-heading font-semibold block">{sv.title}</span>
                <span className="text-sm text-muted">{sv.duration} min · {sv.short_description}</span></span>
              <span className="font-heading font-bold" style={{ color: tc }}>{fmtPrice(sv.price)}</span>
            </button>
          ))}
        </div>
      )}

      {step === 'time' && (
        <div>
          <button onClick={reset} className="text-sm text-muted mb-3">‹ {service?.title}</button>
          <div className="flex items-center justify-between mb-3">
            <button aria-label="prev-month" onClick={() => setMonth((m) => ({ y: m.m === 0 ? m.y - 1 : m.y, m: (m.m + 11) % 12 }))} className="btn btn--outline !p-2">‹</button>
            <span className="font-heading font-semibold">{new Date(month.y, month.m).toLocaleString('en-IN', { month: 'long', year: 'numeric' })}</span>
            <button aria-label="next-month" onClick={() => setMonth((m) => ({ y: m.m === 11 ? m.y + 1 : m.y, m: (m.m + 1) % 12 }))} className="btn btn--outline !p-2">›</button>
          </div>
          <div className="grid grid-cols-7 gap-1 mb-5">
            {days.map((n, i) => (
              <button key={i} disabled={!selectable(n)} aria-label={n ? `day-${n}` : 'empty'}
                onClick={() => { setDate(iso(n)); setSlot(null); }}
                className="aspect-square rounded-md text-sm disabled:opacity-25 disabled:cursor-default"
                style={date === iso(n) ? { background: tc, color: '#fff' } : {}}>
                {n || ''}
              </button>
            ))}
          </div>
          {date && (
            slots.length ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {slots.map((t) => (
                  <button key={t} aria-label={`slot-${t}`} onClick={() => setSlot(t)}
                    className="btn btn--outline" style={slot === t ? { background: tc, color: '#fff', borderColor: tc } : {}}>{fmtTime(t)}</button>
                ))}
              </div>
            ) : <p className="text-muted text-sm">No open times that day 🦥</p>
          )}
          {slot && (
            <div className="mt-6">
              <Button variant="primary" full onClick={confirm} aria-label="Confirm booking">Confirm booking</Button>
            </div>
          )}
        </div>
      )}

      {step === 'confirmed' && (
        <div className="text-center py-6">
          <div className="mx-auto mb-4 grid place-items-center h-14 w-14 rounded-full" style={{ background: `${tc}22` }}>
            <span style={{ color: tc, fontSize: 28 }}>✓</span>
          </div>
          <h3 className="font-heading text-2xl mb-1">You're booked!</h3>
          <p className="text-muted mb-1">{service?.title} with {host.name}</p>
          <p className="text-muted text-sm mb-6">{date && new Date(date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })} · {slot && fmtTime(slot)}</p>
          <Button variant="outline" onClick={reset}>Try again</Button>
        </div>
      )}
    </div>
  );
}

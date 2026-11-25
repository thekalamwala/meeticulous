// BookingRulesCard — graduated from the host-lab Rules prototype. Two branded
// cards (Booking rules · Daily limits) over the real Availability state. Only
// the controls that exist in production are shown: time zone + buffer, and the
// Pro booking caps (as −/+ steppers). All logic (Pro gate, dirty) stays in the
// parent via props.
import { Link } from 'react-router-dom';
import { Globe, Clock, Calendar, User, Lock, Minus, Plus, ChevronDown } from 'lucide-react';
import { cn } from '../dashboard/ui';

const GRAD = {
  booking: 'linear-gradient(135deg,#EAF3FF 0%,#DCEBFF 100%)',
  limits: 'linear-gradient(135deg,#F1ECFF 0%,#E5DCFF 100%)',
};
const CHEVRON = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238A87A0' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E\")";

const RuleSelect = ({ value, onChange, children }) => (
  <select
    value={value}
    onChange={onChange}
    className="w-full cursor-pointer appearance-none rounded-lg border border-neutral-200 bg-white px-2.5 py-2 pr-7 text-[11px] font-semibold text-ink outline-none transition focus:border-maroon"
    style={{ backgroundImage: CHEVRON, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.6rem center' }}
  >
    {children}
  </select>
);

const Field = ({ label, icon: Icon, children }) => (
  <label className="block min-w-0">
    <span className="mb-1.5 flex items-center gap-1.5 text-[11.5px] font-semibold text-ink/70">
      {Icon && <Icon className="h-4 w-4 shrink-0 text-ink/40" strokeWidth={2} />}
      {label}
    </span>
    {children}
  </label>
);

const Stepper = ({ value, onChange, label, disabled }) => {
  const isNull = value === '' || value == null;
  const n = isNull ? null : Number(value);
  const dec = () => { if (disabled) return; onChange(isNull ? '' : n <= 1 ? '' : String(n - 1)); };
  const inc = () => { if (disabled) return; onChange(isNull ? '1' : String(Math.min(999, n + 1))); };
  return (
    <div className={cn('flex items-center justify-between rounded-lg border border-[#F1DCC0] bg-[#FFFDF9] px-1 py-1', disabled && 'opacity-50')}>
      <button type="button" onClick={dec} disabled={disabled || isNull} aria-label={`Decrease ${label}`} className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-maroon transition hover:bg-blush disabled:opacity-30">
        <Minus className="h-4 w-4" strokeWidth={2.6} />
      </button>
      <span className="min-w-0 flex-1 text-center text-[13px] font-extrabold tabular-nums text-ink">{isNull ? '∞' : n}</span>
      <button type="button" onClick={inc} disabled={disabled} aria-label={`Increase ${label}`} className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-maroon transition hover:bg-blush disabled:opacity-30">
        <Plus className="h-4 w-4" strokeWidth={2.6} />
      </button>
    </div>
  );
};

const Card = ({ variant, title, subtitle, pro, mascot, children }) => (
  <section className="relative flex min-w-0 flex-col overflow-hidden rounded-[13px] border border-neutral-200 bg-white">
    <div className="relative flex h-[78px] items-start gap-[9px] p-3.5" style={{ background: GRAD[variant] }}>
      <div className="min-w-0 flex-1">
        <strong className="flex items-center whitespace-nowrap text-[14px] font-extrabold leading-tight text-ink">
          {title}
          {pro && <span className="ml-1.5 inline-grid h-[17px] place-items-center rounded-full px-[7px] text-[9px] font-extrabold tracking-wide" style={{ background: 'linear-gradient(135deg,#FFD978,#F4A72C)', color: '#6B4300' }}>PRO</span>}
        </strong>
        <span className="mt-[3px] block text-[10.5px] leading-snug text-ink/50">{subtitle}</span>
      </div>
      {mascot && <img src={mascot} alt="" aria-hidden="true" className="pointer-events-none h-[46px] w-[46px] shrink-0 object-contain" />}
    </div>
    <div className="flex-1 p-3.5">{children}</div>
  </section>
);

const TZ = [
  ['Asia/Kolkata', 'Asia/Kolkata (GMT +05:30)'],
  ['America/New_York', 'America/New_York (EST)'],
  ['America/Los_Angeles', 'America/Los_Angeles (PST)'],
  ['Europe/London', 'Europe/London (GMT)'],
  ['Europe/Berlin', 'Europe/Berlin (CET)'],
  ['Asia/Dubai', 'Asia/Dubai (GST)'],
  ['Asia/Singapore', 'Asia/Singapore (SGT)'],
];
const BUFFERS = [[0, 'No gap'], [5, '5 minutes'], [10, '10 minutes'], [15, '15 minutes'], [30, '30 minutes'], [60, '1 hour']];

export default function BookingRulesCard({ timezone, setTimezone, bufferMinutes, setBufferMinutes, caps, setCaps, isFree, onChange }) {
  const touch = () => onChange && onChange();
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Card variant="booking" title="Booking rules" subtitle="Your timezone and the gap between bookings." mascot="/hostlab-mascots/booking.png">
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <Field label="Time zone" icon={Globe}>
            <RuleSelect value={timezone} onChange={(e) => { setTimezone(e.target.value); touch(); }}>
              {TZ.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </RuleSelect>
          </Field>
          <Field label="Gap between bookings" icon={Clock}>
            <RuleSelect value={bufferMinutes} onChange={(e) => { setBufferMinutes(parseInt(e.target.value, 10)); touch(); }}>
              {BUFFERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </RuleSelect>
          </Field>
        </div>
      </Card>

      <Card variant="limits" title="Daily limits" pro subtitle="Protect your calendar from a good week." mascot="/hostlab-mascots/limits.png">
        <div className="grid grid-cols-3 gap-2.5">
          {[['cap_per_day', 'Per day', Calendar], ['cap_per_week', 'Per week', Calendar], ['cap_per_guest', 'Per guest', User]].map(([k, label, icon]) => (
            <Field key={k} label={label} icon={icon}>
              <Stepper value={caps[k]} onChange={(v) => { setCaps((c) => ({ ...c, [k]: v })); touch(); }} label={label} disabled={isFree} />
            </Field>
          ))}
        </div>
        {isFree ? (
          <p className="mt-[15px] flex items-center gap-1.5 border-t border-neutral-200/70 pt-3 text-[10.5px] leading-relaxed text-ink/55">
            <Lock className="h-3.5 w-3.5 shrink-0 text-ink/40" strokeWidth={2.2} />
            Booking caps are a Pro feature. <Link to="/dashboard/upgrade?src=booking_caps" className="font-semibold text-maroon underline">Upgrade</Link>
          </p>
        ) : (
          <p className="mt-[15px] border-t border-neutral-200/70 pt-3 text-[10.5px] leading-relaxed text-ink/55">
            Leave a cap at ∞ for no limit — a booking that would exceed it is turned away.
          </p>
        )}
      </Card>
    </div>
  );
}

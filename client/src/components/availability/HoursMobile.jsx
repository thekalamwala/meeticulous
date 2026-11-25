// HoursMobile — graduated from the host-lab Hours prototype. An app-style card
// per day (toggle + hours + collapse), boxed time pills, and add-a-slot. Driven
// entirely by the real Availability state/handlers passed in as props; renders
// only on mobile (the desktop list stays as-is).
import { useState } from 'react';
import { Clock, ChevronDown, Plus, Trash2 } from 'lucide-react';
import { cn } from '../dashboard/ui';

const pad = (n) => String(n).padStart(2, '0');
// 30-min grid, 24h "HH:MM" values with 12h labels — matches Availability's TIME_OPTIONS.
const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2);
  const m = (i % 2) * 30;
  return { value: `${pad(h)}:${pad(m)}`, label: `${h % 12 === 0 ? 12 : h % 12}:${pad(m)} ${h < 12 ? 'am' : 'pm'}` };
});
const minutesOf = (t) => { const [h, m] = String(t).split(':').map(Number); return h * 60 + m; };
const fmtHrs = (h) => `${Number.isInteger(h) ? h : h.toFixed(1)} ${h === 1 ? 'hour' : 'hours'}`;

const DAY_LABEL = { monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday', thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday' };

const Switch = ({ checked, onChange, label }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    onClick={onChange}
    className={cn('relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-maroon/40', checked ? 'bg-maroon' : 'bg-ink/15')}
  >
    <span className={cn('inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform', checked ? 'translate-x-[18px]' : 'translate-x-0.5')} />
  </button>
);

const TimePill = ({ value, onChange, label, bad }) => {
  const known = TIME_OPTIONS.some((o) => o.value === value);
  return (
    <div className={cn('relative flex min-w-0 flex-1 items-center gap-0.5 rounded-xl bg-neutral-100 px-1.5 py-2', bad && 'ring-2 ring-error-fg/60')}>
      <Clock className="h-3 w-3 shrink-0 text-ink/40" strokeWidth={2.2} />
      <select value={value} onChange={onChange} aria-label={label} className="min-w-0 flex-1 cursor-pointer appearance-none border-0 bg-transparent text-center text-[12px] font-bold text-ink outline-none">
        {!known && value && <option value={value}>{value}</option>}
        {TIME_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
      </select>
      <ChevronDown className="h-3 w-3 shrink-0 text-maroon" strokeWidth={2.6} />
    </div>
  );
};

export default function HoursMobile({ days, schedule, isDayOpen, toggleDay, addSlot, removeSlot, updateSlot, className = '' }) {
  const [collapsed, setCollapsed] = useState({});
  return (
    <div className={cn('flex flex-col gap-2.5', className)}>
      {days.map((day) => {
        const open = isDayOpen(day);
        const slots = schedule[day] || [];
        const shut = !!collapsed[day];
        const hrs = slots.reduce((n, sl) => n + Math.max(0, minutesOf(sl.end) - minutesOf(sl.start)), 0) / 60;
        return (
          <div key={day} className="overflow-hidden rounded-2xl bg-white shadow-[0_1px_2px_rgba(43,10,20,0.04),0_10px_24px_-18px_rgba(43,10,20,0.14)]">
            <div className="flex items-center gap-2.5 px-3.5 py-3">
              <Switch checked={open} onChange={() => toggleDay(day)} label={`${open ? 'Close' : 'Open'} ${day}`} />
              <span className={cn('text-[14px] font-extrabold', open ? 'text-ink' : 'text-ink/40')}>{DAY_LABEL[day] || day}</span>
              <span className={cn('ml-auto text-[11.5px] font-bold', open ? 'text-ink/50' : 'text-ink/35')}>
                {open ? fmtHrs(hrs) : 'Closed'}
              </span>
              {open && (
                <button type="button" onClick={() => setCollapsed((c) => ({ ...c, [day]: !c[day] }))} aria-label={`${shut ? 'Expand' : 'Collapse'} ${day}`} aria-expanded={!shut} className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-ink/40 transition hover:bg-blush hover:text-maroon">
                  <ChevronDown className={cn('h-4 w-4 transition-transform', shut && '-rotate-180')} strokeWidth={2.4} />
                </button>
              )}
            </div>

            {open && !shut && (
              <div className="flex flex-col gap-2 px-3.5 pb-3.5">
                {slots.map((sl, i) => {
                  const bad = minutesOf(sl.end) <= minutesOf(sl.start);
                  return (
                    <div key={i}>
                      <div className="flex items-center gap-1.5">
                        <TimePill value={sl.start} onChange={(e) => updateSlot(day, i, 'start', e.target.value)} label={`${day} slot ${i + 1} start`} />
                        <span className="shrink-0 text-[10.5px] font-bold text-ink/35">to</span>
                        <TimePill value={sl.end} onChange={(e) => updateSlot(day, i, 'end', e.target.value)} label={`${day} slot ${i + 1} end`} bad={bad} />
                        <button type="button" onClick={() => removeSlot(day, i)} aria-label={`Remove ${day} slot ${i + 1}`} className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-ink/35 transition hover:bg-error-bg hover:text-error-fg">
                          <Trash2 className="h-4 w-4" strokeWidth={2.2} />
                        </button>
                      </div>
                      {bad && <p className="mt-1 text-[10.5px] font-bold text-error-fg">End must be after start</p>}
                    </div>
                  );
                })}
                <button type="button" onClick={() => addSlot(day)} className="flex items-center justify-center gap-1.5 rounded-xl bg-blush py-2.5 text-[12px] font-bold text-maroon transition active:bg-pink">
                  <Plus className="h-4 w-4" strokeWidth={2.6} /> Add time slot
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

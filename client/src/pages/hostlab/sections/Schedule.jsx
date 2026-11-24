// Schedule — everything that decides when a guest can book, in one place.
//
// The live Availability page has weekly hours, blocked dates, timezone, buffer
// and Pro booking caps. Added here, all of it parity with Calendly/Cal.com:
//   • minimum notice (lead time) — the single most-requested missing control
//   • how far ahead bookings may be made (booking window)
//   • date-specific hours — a date with DIFFERENT hours, not only a full block
//     (the live page can only block a day outright)
//   • copy one day's hours to others, and a one-click "same every weekday"
//   • calendar connections with two-way busy-blocking, shown as state
//   • a live preview of the next bookable slots, so the host can see the effect
//     of a change without opening their own public page in another tab
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Calendar, CalendarPlus, CalendarX2, ChevronLeft, ChevronRight, Copy, Lock, LockOpen,
  Plus, Trash2, Clock, Eye,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Button, cn } from '../../../components/dashboard/ui';
import { LabSelect, SubPageHeader, Toggle, fmtDayFull, useSubPage } from '../labUi';
import mock from '../mockData';

const DAYS = [
  ['monday', 'Monday'], ['tuesday', 'Tuesday'], ['wednesday', 'Wednesday'],
  ['thursday', 'Thursday'], ['friday', 'Friday'], ['saturday', 'Saturday'], ['sunday', 'Sunday'],
];

const TIMES = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2);
  const m = (i % 2) * 30;
  const v = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  const label = `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
  return { v, label };
});
const pretty = (t) => TIMES.find((x) => x.v === t)?.label || t;

const minutesOf = (t) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

/* ── Surface + SectionLabel — the de-boxed shell ──────────────────────────
 * Premium desktop = one soft contained card. App-like mobile = no card
 * chrome at all: the group sits directly on the page, iOS-settings style,
 * under a small-caps label. One component, the breakpoint does the rest. */
const Surface = ({ children, className = '' }) => (
  <section className={cn('overflow-hidden rounded-2xl bg-white sm:border sm:border-neutral-200/70 sm:shadow-[0_1px_2px_rgba(43,10,20,0.03)]', className)}>
    {children}
  </section>
);

const SectionLabel = ({ children, action }) => (
  <div className="mb-2 flex items-center justify-between gap-2 px-0.5">
    <h2 className="text-[10px] font-extrabold uppercase tracking-[0.09em] text-ink/40">{children}</h2>
    {action}
  </div>
);

/* ── Hours ─────────────────────────────────────────────────────────────── */
const Hours = ({ schedule, setSchedule, dirty }) => {
  const [copyFrom, setCopyFrom] = useState(null);

  const addSlot = (day) =>
    setSchedule((s) => ({ ...s, [day]: [...s[day], { start: '09:00', end: '17:00' }] }));
  const removeSlot = (day, i) =>
    setSchedule((s) => ({ ...s, [day]: s[day].filter((_, j) => j !== i) }));
  const setSlot = (day, i, key, value) =>
    setSchedule((s) => ({ ...s, [day]: s[day].map((sl, j) => (j === i ? { ...sl, [key]: value } : sl)) }));
  const toggleDay = (day) =>
    setSchedule((s) => ({ ...s, [day]: s[day].length ? [] : [{ start: '09:00', end: '17:00' }] }));

  const copyTo = (from, targets) => {
    setSchedule((s) => {
      const next = { ...s };
      targets.forEach((t) => { next[t] = s[from].map((sl) => ({ ...sl })); });
      return next;
    });
    setCopyFrom(null);
    toast.success(`${from[0].toUpperCase() + from.slice(1)}'s hours copied to ${targets.length} days`);
  };

  // Untitled on purpose. The page heading above says "Hours" and carries the
  // week's total; a panel title here would be the same thing a third time,
  // inside 40px. The button and the stat moved up to that heading.
  return (
    <Surface>
      <ul className="divide-y divide-neutral-200/50">
        {DAYS.map(([key, label]) => {
          const slots = schedule[key];
          const open = slots.length > 0;
          return (
            <li key={key} className="px-2.5 py-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex w-[150px] shrink-0 items-center gap-1.5">
                  <Toggle checked={open} onChange={() => toggleDay(key)} label={`${label} open for bookings`} />
                  <span className={cn('text-[12px] font-bold', open ? 'text-ink' : 'text-ink/35')}>{label}</span>
                </div>

                {!open ? (
                  <span className="text-[11px] font-semibold text-ink/35">Closed</span>
                ) : (
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    {slots.map((sl, i) => {
                      const bad = minutesOf(sl.end) <= minutesOf(sl.start);
                      return (
                        <div key={i} className="flex flex-wrap items-center gap-1.5">
                          <LabSelect
                            value={sl.start}
                            onChange={(e) => setSlot(key, i, 'start', e.target.value)}
                            aria-label={`${label} slot ${i + 1} start`}
                            className="h-8 w-[116px]"
                          >
                            {TIMES.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}
                          </LabSelect>
                          <span className="text-[10.5px] font-bold text-ink/35">to</span>
                          <LabSelect
                            value={sl.end}
                            onChange={(e) => setSlot(key, i, 'end', e.target.value)}
                            aria-label={`${label} slot ${i + 1} end`}
                            className={cn('h-8 w-[116px]', bad && 'border-error-fg')}
                          >
                            {TIMES.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}
                          </LabSelect>
                          {bad && <span className="text-[10.5px] font-bold text-error-fg">End must be after start</span>}
                          <button
                            type="button"
                            onClick={() => removeSlot(key, i)}
                            aria-label={`Remove ${label} slot ${i + 1}`}
                            className="grid h-7 w-7 place-items-center rounded-full text-ink/35 transition hover:bg-error-bg hover:text-error-fg"
                          >
                            <Trash2 className="h-4 w-4" strokeWidth={2.2} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="ml-auto flex shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={() => addSlot(key)}
                    aria-label={`Add hours to ${label}`}
                    className="grid h-7 w-7 place-items-center rounded-full text-ink/45 transition hover:bg-blush hover:text-maroon"
                  >
                    <Plus className="h-4 w-4" strokeWidth={2.6} />
                  </button>
                  {open && (
                    <button
                      type="button"
                      onClick={() => setCopyFrom(copyFrom === key ? null : key)}
                      aria-label={`Copy ${label} hours to other days`}
                      aria-expanded={copyFrom === key}
                      className={cn('grid h-7 w-7 place-items-center rounded-full transition', copyFrom === key ? 'bg-maroon text-white' : 'text-ink/45 hover:bg-blush hover:text-maroon')}
                    >
                      <Copy className="h-4 w-4" strokeWidth={2.2} />
                    </button>
                  )}
                </div>
              </div>

              {copyFrom === key && (
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5 rounded-lg bg-blush p-2">
                  <span className="text-[10.5px] font-bold text-maroon">Copy {label} to</span>
                  {DAYS.filter(([k]) => k !== key).map(([k, l]) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => copyTo(key, [k])}
                      className="rounded-full bg-white px-2.5 py-1 text-[10.5px] font-bold text-maroon transition hover:bg-maroon hover:text-white"
                    >
                      {l.slice(0, 3)}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => copyTo(key, DAYS.filter(([k]) => k !== key).map(([k]) => k))}
                    className="rounded-full bg-maroon px-2.5 py-1 text-[10.5px] font-bold text-white"
                  >
                    All days
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {dirty && (
        <div className="flex items-center gap-2 border-t border-neutral-200/60 bg-marigold-100 px-2.5 py-1.5">
          <span className="text-[11px] font-bold text-marigold-800">Unsaved changes</span>
          <Button size="sm" className="ml-auto" onClick={() => toast.success('Hours saved')}>Save hours</Button>
        </div>
      )}
    </Surface>
  );
};

/* ── Rules + Specific dates — one page, three illustrated cards ───────────
 * Matches the founder-supplied mockup (Meeticulous-Rules.html) exactly: a
 * pastel-gradient header per card carrying a 3D mascot, over a white body,
 * and Specific dates folded in as the third card. The mockup palette
 * (pastel headers, magenta/gold accents) is deliberately OFF the maroon
 * brand — an explicit founder decision for this page only. Mascots are
 * served from client/public/hostlab-mascots/. */
const CARD_GRAD = {
  booking: 'linear-gradient(135deg,#EAF3FF 0%,#DCEBFF 100%)',
  limits: 'linear-gradient(135deg,#F1ECFF 0%,#E5DCFF 100%)',
  dates: 'linear-gradient(135deg,#EAF8EE 0%,#DDF3E4 100%)',
};
const SELECT_CHEVRON = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238A87A0' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E\")";

const RuleSelect = ({ className = '', children, ...props }) => (
  <select
    className={cn('w-full cursor-pointer appearance-none rounded-lg border border-neutral-200 bg-white px-2.5 py-2 pr-7 text-[11px] font-semibold text-ink outline-none transition focus:border-maroon', className)}
    style={{ backgroundImage: SELECT_CHEVRON, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.6rem center' }}
    {...props}
  >
    {children}
  </select>
);

const RuleField = ({ label, children, className = '' }) => (
  <label className={cn('block min-w-0', className)}>
    <span className="mb-1.5 block text-[9px] font-extrabold uppercase tracking-[0.7px] text-ink/45">{label}</span>
    {children}
  </label>
);

/* ── DatePicker — a brand-styled calendar popover ─────────────────────────
 * Replaces <input type="date">. The native picker's popup is drawn by the
 * browser and follows the OS/browser colour scheme (dark on a dark machine);
 * `color-scheme: light` on the element does NOT reliably force it light, so
 * the only way to keep the calendar on-brand and always light is to render
 * our own. Local date only, no timezone math. */
const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const toIso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const DatePicker = ({ value, onChange }) => {
  const [open, setOpen] = useState(false);
  const sel = value ? new Date(`${value}T00:00:00`) : null;
  const [view, setView] = useState(() => sel || new Date());
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const y = view.getFullYear();
  const m = view.getMonth();
  const lead = new Date(y, m, 1).getDay();
  const days = new Date(y, m + 1, 0).getDate();
  const todayIso = toIso(new Date());
  const cells = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  const label = sel ? sel.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Pick a date';

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between rounded-lg border border-neutral-200 bg-white px-2.5 py-2 text-[11px] font-semibold outline-none transition focus:border-maroon"
      >
        <span className={sel ? 'text-ink' : 'text-ink/40'}>{label}</span>
        <Calendar className="h-3.5 w-3.5 text-ink/40" strokeWidth={2.2} />
      </button>

      {open && (
        <div className="absolute left-0 top-[calc(100%+6px)] z-20 w-[236px] rounded-2xl border border-neutral-200 bg-white p-2.5 shadow-[0_8px_24px_-8px_rgba(43,10,20,0.18)]">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[11.5px] font-extrabold text-ink">{view.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
            <div className="flex gap-0.5">
              <button type="button" aria-label="Previous month" onClick={() => setView(new Date(y, m - 1, 1))} className="grid h-6 w-6 place-items-center rounded-full text-ink/50 transition hover:bg-blush hover:text-maroon">
                <ChevronLeft className="h-4 w-4" strokeWidth={2.4} />
              </button>
              <button type="button" aria-label="Next month" onClick={() => setView(new Date(y, m + 1, 1))} className="grid h-6 w-6 place-items-center rounded-full text-ink/50 transition hover:bg-blush hover:text-maroon">
                <ChevronRight className="h-4 w-4" strokeWidth={2.4} />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {WEEKDAYS.map((w) => <span key={w} className="grid h-6 place-items-center text-[9px] font-bold uppercase tracking-wide text-ink/35">{w}</span>)}
            {cells.map((d, i) => {
              if (d === null) return <span key={`e${i}`} />;
              const iso = toIso(new Date(y, m, d));
              const isSel = iso === value;
              const isToday = iso === todayIso;
              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => { onChange(iso); setOpen(false); }}
                  className={cn(
                    'grid h-7 place-items-center rounded-full text-[11px] font-semibold transition',
                    isSel ? 'bg-maroon text-white' : isToday ? 'text-maroon ring-1 ring-inset ring-maroon/40' : 'text-ink hover:bg-blush',
                  )}
                >
                  {d}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

const RuleCard = ({ variant, title, subtitle, pro, mascot, children }) => (
  <article className="relative flex min-h-[278px] min-w-0 flex-col overflow-hidden rounded-[13px] border border-neutral-200 bg-white">
    <div className="relative flex h-[78px] items-start gap-[9px] p-3.5" style={{ background: CARD_GRAD[variant] }}>
      <div className="min-w-0 flex-1">
        <strong className="flex items-center whitespace-nowrap text-[14px] font-extrabold leading-tight text-ink">
          {title}
          {pro && (
            <span className="ml-1.5 inline-grid h-[17px] place-items-center rounded-full px-[7px] text-[9px] font-extrabold tracking-wide" style={{ background: 'linear-gradient(135deg,#FFD978,#F4A72C)', color: '#6B4300' }}>
              PRO
            </span>
          )}
        </strong>
        <span className="mt-[3px] block text-[10.5px] leading-snug text-ink/50">{subtitle}</span>
      </div>
      <img src={mascot} alt="" aria-hidden="true" className="pointer-events-none h-[46px] w-[46px] shrink-0 object-contain" />
    </div>
    <div className="flex-1 p-3.5">{children}</div>
  </article>
);

const RulesCards = ({ rules, setRules, overrides, setOverrides, blocked, setBlocked, adding, setAdding }) => {
  const [form, setForm] = useState({ date: '', kind: 'hours', start: '10:00', end: '14:00', label: '' });

  const addDate = () => {
    if (!form.date) return;
    if (form.kind === 'block') {
      setBlocked((b) => [...b, form.date]);
      toast.success(`${fmtDayFull(form.date)} blocked`);
    } else {
      setOverrides((o) => [...o, { date: form.date, slots: [{ start: form.start, end: form.end }], label: form.label || 'Different hours' }]);
      toast.success(`${fmtDayFull(form.date)} set to different hours`);
    }
    setAdding(false);
    setForm({ date: '', kind: 'hours', start: '10:00', end: '14:00', label: '' });
  };

  const hasDates = overrides.length > 0 || blocked.length > 0;

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1.2fr]">
      {/* Booking rules */}
      <RuleCard variant="booking" title="Booking rules" subtitle="Set your booking preferences and scheduling requirements." mascot="/hostlab-mascots/booking.png">
        <div className="grid grid-cols-2 gap-x-3 gap-y-3.5">
          <RuleField label="Time zone">
            <RuleSelect value={rules.timezone} onChange={(e) => setRules((r) => ({ ...r, timezone: e.target.value }))}>
              {['Asia/Kolkata', 'Asia/Dubai', 'Europe/London', 'America/New_York', 'Asia/Singapore'].map((t) => <option key={t}>{t}</option>)}
            </RuleSelect>
          </RuleField>
          <RuleField label="Gap between bookings">
            <RuleSelect value={rules.buffer_minutes} onChange={(e) => setRules((r) => ({ ...r, buffer_minutes: +e.target.value }))}>
              {[0, 5, 10, 15, 20, 30, 45, 60].map((n) => <option key={n} value={n}>{n === 0 ? 'No gap' : `${n} minutes`}</option>)}
            </RuleSelect>
          </RuleField>
          <RuleField label="Minimum notice">
            <RuleSelect value={rules.min_notice_hours} onChange={(e) => setRules((r) => ({ ...r, min_notice_hours: +e.target.value }))}>
              {[0, 1, 2, 4, 8, 12, 24, 48].map((n) => <option key={n} value={n}>{n === 0 ? 'None' : n === 1 ? '1 hour' : `${n} hours`}</option>)}
            </RuleSelect>
          </RuleField>
          <RuleField label="How far ahead">
            <RuleSelect value={rules.booking_window_days} onChange={(e) => setRules((r) => ({ ...r, booking_window_days: +e.target.value }))}>
              {[7, 14, 30, 60, 90, 180, 365].map((n) => <option key={n} value={n}>{n} days</option>)}
            </RuleSelect>
          </RuleField>
        </div>
      </RuleCard>

      {/* Daily limits */}
      <RuleCard variant="limits" title="Daily limits" pro subtitle="Protect your calendar from a good week." mascot="/hostlab-mascots/limits.png">
        <div className="grid grid-cols-3 gap-2.5">
          {[['per_day', 'Per day'], ['per_week', 'Per week'], ['per_guest', 'Per guest']].map(([k, label]) => (
            <RuleField key={k} label={label}>
              <input
                type="number"
                min={1}
                inputMode="numeric"
                placeholder="∞"
                value={rules.caps[k] ?? ''}
                onChange={(e) => setRules((r) => ({ ...r, caps: { ...r.caps, [k]: e.target.value === '' ? null : +e.target.value } }))}
                aria-label={label}
                className="w-full rounded-lg border border-[#F1DCC0] bg-[#FFFDF9] px-2.5 py-2 text-[12px] font-bold text-ink outline-none transition focus:border-[#E0A857]"
              />
            </RuleField>
          ))}
        </div>
        <p className="mt-[15px] border-t border-neutral-200/70 pt-3 text-[10.5px] leading-relaxed text-ink/55">
          A booking that would break a limit is simply not offered — the guest never sees a slot they cannot have.
        </p>
      </RuleCard>

      {/* Specific dates — folded in from the old tab */}
      <RuleCard variant="dates" title="Specific dates" subtitle="One-offs that override the weekly pattern." mascot="/hostlab-mascots/dates.png">
        {adding ? (
          <div className="mb-2.5 flex flex-col gap-2 rounded-xl bg-cream p-2.5">
            <RuleField label="Date">
              <DatePicker value={form.date} onChange={(iso) => setForm((f) => ({ ...f, date: iso }))} />
            </RuleField>
            <RuleField label="What happens">
              <RuleSelect value={form.kind} onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value }))}>
                <option value="hours">Different hours</option>
                <option value="block">Not available at all</option>
              </RuleSelect>
            </RuleField>
            {form.kind === 'hours' && (
              <div className="grid grid-cols-2 gap-2">
                <RuleField label="From">
                  <RuleSelect value={form.start} onChange={(e) => setForm((f) => ({ ...f, start: e.target.value }))}>
                    {TIMES.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}
                  </RuleSelect>
                </RuleField>
                <RuleField label="To">
                  <RuleSelect value={form.end} onChange={(e) => setForm((f) => ({ ...f, end: e.target.value }))}>
                    {TIMES.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}
                  </RuleSelect>
                </RuleField>
              </div>
            )}
            <RuleField label="Note to yourself">
              <input value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} placeholder="Clinic visit, travelling…" className="w-full rounded-lg border border-neutral-200 bg-white px-2.5 py-2 text-[11px] font-semibold text-ink outline-none focus:border-maroon" />
            </RuleField>
            <div className="flex gap-1.5">
              <Button size="sm" onClick={addDate} disabled={!form.date}>Add date</Button>
              <Button size="sm" variant="outline" onClick={() => setAdding(false)}>Cancel</Button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setAdding(true)} className="mb-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-neutral-300 py-2 text-[10.5px] font-bold text-maroon transition hover:border-maroon/50 hover:bg-blush">
            <CalendarPlus className="h-3.5 w-3.5" strokeWidth={2.4} /> Add a date
          </button>
        )}

        {!hasDates ? (
          <p className="py-6 text-center text-[10.5px] font-medium text-ink/45">No one-offs yet.</p>
        ) : (
          <div className="flex flex-col">
            {overrides.map((o) => (
              <div key={o.date} className="flex items-center gap-[9px] border-b border-neutral-200/70 py-[9px] last:border-b-0">
                <span className="grid h-[29px] w-[29px] shrink-0 place-items-center rounded-full" style={{ background: '#FFF4D6', color: '#B7791F' }}>
                  <Clock className="h-[15px] w-[15px]" strokeWidth={1.9} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[11px] font-bold text-ink">{fmtDayFull(o.date)}</span>
                  <span className="mt-0.5 block truncate text-[10px] text-ink/50">
                    {o.slots.map((s) => `${pretty(s.start)} – ${pretty(s.end)}`).join(', ')} · {o.label}
                  </span>
                </span>
                <button type="button" onClick={() => { setOverrides((v) => v.filter((x) => x.date !== o.date)); toast.success('Date removed'); }} aria-label={`Remove ${fmtDayFull(o.date)}`} className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-ink/35 transition hover:bg-error-bg hover:text-error-fg">
                  <Trash2 className="h-4 w-4" strokeWidth={2.2} />
                </button>
              </div>
            ))}
            {blocked.map((d) => (
              <div key={d} className="flex items-center gap-[9px] border-b border-neutral-200/70 py-[9px] last:border-b-0">
                <span className="grid h-[29px] w-[29px] shrink-0 place-items-center rounded-full" style={{ background: '#FCE7EF', color: '#A50044' }}>
                  <CalendarX2 className="h-[15px] w-[15px]" strokeWidth={1.9} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[11px] font-bold text-ink">{fmtDayFull(d)}</span>
                  <span className="mt-0.5 block truncate text-[10px] text-ink/50">Not available at all</span>
                </span>
                <button type="button" onClick={() => { setBlocked((v) => v.filter((x) => x !== d)); toast.success('Date unblocked'); }} aria-label={`Unblock ${fmtDayFull(d)}`} className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-ink/35 transition hover:bg-error-bg hover:text-error-fg">
                  <Trash2 className="h-4 w-4" strokeWidth={2.2} />
                </button>
              </div>
            ))}
          </div>
        )}
      </RuleCard>
    </div>
  );
};

/* ── Calendars ─────────────────────────────────────────────────────────── */
/* Provider marks — third-party integration logos (same pattern as the kit's
 * MeetIcon / WhatsAppIcon), shown so the row reads as a real connection. */
const GoogleMark = ({ className }) => (
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
const providerMark = (name) => {
  if (name.includes('Google')) return <GoogleMark className="h-5 w-5" />;
  if (name.includes('Apple')) return <AppleMark className="h-5 w-5" />;
  if (name.includes('Outlook')) return <OutlookMark className="h-5 w-5" />;
  return <Calendar className="h-[18px] w-[18px] text-ink/45" strokeWidth={2.2} />;
};
const calBlurb = (name) => {
  if (name.includes('Google')) return 'Two-way sync. Your Google busy times block new bookings, and confirmed meetings land on your calendar automatically.';
  if (name.includes('Apple')) return 'Two-way sync. Your Apple Calendar busy times block new bookings, so a guest can never double-book you.';
  return 'Microsoft Outlook sync is on the way — you will be able to connect your work calendar here soon.';
};

/* LockSlider — a slide-to-connect control. Locked = connected (synced),
 * unlocked = not connected. Tapping toggles the connection. */
/* A real drag-to-slide lock. Grab the knob and slide it along the track;
 * release past halfway to connect / disconnect. (A tap on the far end counts
 * as a full slide.) Vertical: top = locked/connected, bottom = unlocked. */
const LockSlider = ({ connected, onToggle, label, comingSoon = false, vertical = false }) => {
  const ref = useRef(null);
  const dragRef = useRef(null); // live drag position, read synchronously on release
  const [frac, setFrac] = useState(null); // 0..1 along the track while dragging; null when idle
  const locked = connected && !comingSoon;

  const fracFrom = (e) => {
    const r = ref.current.getBoundingClientRect();
    const raw = vertical ? (e.clientY - r.top) / r.height : (e.clientX - r.left) / r.width;
    return Math.min(1, Math.max(0, raw));
  };
  const down = (e) => {
    if (comingSoon) return;
    try { ref.current.setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ }
    dragRef.current = fracFrom(e);
    setFrac(dragRef.current);
  };
  const move = (e) => {
    if (dragRef.current === null) return;
    dragRef.current = fracFrom(e);
    setFrac(dragRef.current);
  };
  const up = () => {
    if (dragRef.current === null) return;
    const f = dragRef.current;
    dragRef.current = null;
    setFrac(null);
    const draggedToLocked = vertical ? f < 0.5 : f > 0.5;
    if (draggedToLocked !== locked) onToggle();
  };

  const showLock = comingSoon || (frac != null ? (vertical ? frac < 0.5 : frac > 0.5) : locked);
  const lit = showLock && !comingSoon; // maroon (locked) look

  // knob offset along the track
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

const Calendars = () => {
  const [cals, setCals] = useState(mock.availability.calendars);
  const connect = (c) => { setCals((v) => v.map((x) => (x.id === c.id ? { ...x, status: 'connected', account: 'ananya@icloud.com' } : x))); toast.success(`${c.name} connected`); };
  const disconnect = (c) => { setCals((v) => v.map((x) => (x.id === c.id ? { ...x, status: 'available', account: null } : x))); toast.success(`${c.name} disconnected`); };

  return (
    <div>
      {/* Mobile: three tall cards that together fill the viewport, each with a
          vertical slide-to-connect lock on the right. Desktop: a de-boxed list. */}
      <div className="flex min-h-[calc(100dvh-13rem)] flex-col gap-3 sm:hidden">
        {cals.map((c) => {
          const connected = c.status === 'connected';
          return (
            <div key={c.id} className="flex flex-1 items-stretch gap-3 rounded-3xl bg-white p-4 shadow-[0_1px_2px_rgba(43,10,20,0.04),0_12px_26px_-18px_rgba(43,10,20,0.16)]">
              <div className="flex min-w-0 flex-1 flex-col gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-neutral-50">{providerMark(c.name)}</span>
                  <p className="min-w-0 flex-1 truncate text-[14px] font-extrabold text-ink">
                    {c.name}
                    <span className="ml-2 text-[11px] font-medium text-ink/45">{connected ? c.account : 'Not connected'}</span>
                  </p>
                </div>
                <p className="text-[11.5px] leading-relaxed text-ink/50">{calBlurb(c.name)}</p>
              </div>
              <LockSlider vertical connected={connected} onToggle={() => (connected ? disconnect(c) : connect(c))} label={`${c.name} connection`} />
            </div>
          );
        })}
        {/* Outlook — not yet available */}
        <div className="flex flex-1 items-stretch gap-3 rounded-3xl bg-white/70 p-4 shadow-[0_1px_2px_rgba(43,10,20,0.03)]">
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-neutral-50 grayscale">{providerMark('Outlook Calendar')}</span>
              <p className="min-w-0 flex-1 truncate text-[14px] font-extrabold text-ink/55">
                Outlook Calendar<span className="ml-2 text-[11px] font-medium text-ink/40">Coming soon</span>
              </p>
            </div>
            <p className="text-[11.5px] leading-relaxed text-ink/40">{calBlurb('Outlook Calendar')}</p>
          </div>
          <LockSlider vertical comingSoon label="Outlook Calendar — coming soon" />
        </div>
      </div>

      <Surface className="hidden sm:block">
        <ul className="divide-y divide-neutral-200/50">
          {cals.map((c) => {
            const connected = c.status === 'connected';
            return (
              <li key={c.id} className="flex items-center gap-3 px-4 py-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-neutral-50">
                  {providerMark(c.name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="truncate text-[12.5px] font-bold text-ink">{c.name}</span>
                    {connected && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-success-fg" />}
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] font-medium text-ink/50">
                    {connected ? c.account : 'Not connected'}
                  </span>
                </span>
                {connected ? (
                  <div className="flex shrink-0 items-center gap-2.5">
                    <Toggle checked onChange={() => toast.success('Two-way sync is required while connected')} label="Two-way sync" />
                    <button type="button" onClick={() => disconnect(c)} className="text-[11px] font-bold text-ink/45 transition hover:text-maroon">Disconnect</button>
                  </div>
                ) : (
                  <Button size="sm" className="shrink-0" onClick={() => connect(c)}>Connect</Button>
                )}
              </li>
            );
          })}
          {/* Outlook — not yet available */}
          <li className="flex items-center gap-3 px-4 py-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-neutral-50 grayscale">{providerMark('Outlook Calendar')}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12.5px] font-bold text-ink/55">Outlook Calendar</span>
              <span className="mt-0.5 block truncate text-[11px] font-medium text-ink/40">Coming soon</span>
            </span>
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-neutral-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-ink/40">
              <Lock className="h-3 w-3" strokeWidth={2.4} /> Soon
            </span>
          </li>
        </ul>
      </Surface>

      <p className="mt-2.5 flex items-center gap-1.5 px-0.5 text-[10.5px] font-medium text-ink/40">
        <Lock className="h-3.5 w-3.5 shrink-0" strokeWidth={2.2} /> Only busy/free times are read — never event details.
      </p>
    </div>
  );
};

/* ── Preview — the host sees the effect of their own rules ─────────────── */
const Preview = ({ schedule, rules }) => {
  const slots = useMemo(() => {
    const out = [];
    const now = new Date();
    const earliest = new Date(now.getTime() + rules.min_notice_hours * 3_600_000);
    const dur = 30;
    for (let d = 0; d < 10 && out.length < 12; d += 1) {
      const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + d);
      const dayKey = date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
      if (mock.availability.blocked_dates.includes(date.toISOString().slice(0, 10))) continue;
      const windows = schedule[dayKey] || [];
      const taken = mock.bookings
        .filter((b) => new Date(b.scheduled_at).toDateString() === date.toDateString() && b.status !== 'cancelled')
        .map((b) => minutesOf(new Date(b.scheduled_at).toTimeString().slice(0, 5)));
      windows.forEach(({ start, end }) => {
        for (let m = minutesOf(start); m + dur <= minutesOf(end) && out.length < 12; m += dur + rules.buffer_minutes) {
          const at = new Date(date.getFullYear(), date.getMonth(), date.getDate(), Math.floor(m / 60), m % 60);
          if (at < earliest) continue;
          if (taken.some((t) => Math.abs(t - m) < dur)) continue;
          out.push({ at, key: `${d}-${m}` });
        }
      });
    }
    return out;
  }, [schedule, rules]);

  const grouped = useMemo(() => {
    const g = {};
    slots.forEach((s) => {
      const k = s.at.toDateString();
      (g[k] = g[k] || []).push(s);
    });
    return Object.entries(g);
  }, [slots]);

  return (
    <div>
      <SectionLabel
        action={(
          <button type="button" onClick={() => toast.success('Opens your public booking page in a new tab')} className="inline-flex items-center gap-1 text-[10.5px] font-bold text-maroon transition hover:text-maroon-dark">
            <Eye className="h-3.5 w-3.5" strokeWidth={2.4} /> Live page
          </button>
        )}
      >
        What a guest sees
      </SectionLabel>
      <Surface className="p-3 sm:p-4">
        {grouped.length === 0 ? (
          <p className="py-6 text-center text-[11.5px] font-semibold text-ink/45">No slots bookable in the next 10 days.</p>
        ) : (
          <div className="flex flex-col gap-2.5">
            {grouped.map(([day, items]) => (
              <div key={day}>
                <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-ink/40">
                  {new Date(day).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {items.map((s) => (
                    <span key={s.key} className="rounded-full bg-marigold-100 px-2.5 py-1 text-[10.5px] font-bold text-marigold-800">
                      {s.at.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true }).replace(' ', '')}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Surface>
      <p className="mt-2 px-0.5 text-[10px] font-medium text-ink/40">{rules.timezone} · guests see their own zone</p>
    </div>
  );
};

/* ── Page ──────────────────────────────────────────────────────────────── */
const Schedule = () => {
  const page = useSubPage('schedule');
  const [schedule, setScheduleRaw] = useState(mock.availability.weekly_schedule);
  const [rules, setRules] = useState({
    timezone: mock.availability.timezone,
    buffer_minutes: mock.availability.buffer_minutes,
    min_notice_hours: mock.availability.min_notice_hours,
    booking_window_days: mock.availability.booking_window_days,
    caps: mock.availability.caps,
  });
  const [overrides, setOverrides] = useState(mock.availability.date_overrides);
  const [blocked, setBlocked] = useState(mock.availability.blocked_dates);
  const [dirty, setDirty] = useState(false);
  const [addingDate, setAddingDate] = useState(false);
  const setSchedule = (fn) => { setScheduleRaw(fn); setDirty(true); };

  const totalHours = useMemo(
    () => Object.values(schedule).flat().reduce((n, sl) => n + (minutesOf(sl.end) - minutesOf(sl.start)), 0) / 60,
    [schedule],
  );

  // Each sub-page is a page, so it gets one heading and that heading carries
  // the page's action. Panels underneath are unnamed where there is only one
  // of them — "Specific dates" over a panel called "Specific dates" was the
  // same sentence twice, 30px apart.
  const sameEveryWeekday = () => {
    setSchedule((s) => {
      const next = { ...s };
      ['tuesday', 'wednesday', 'thursday', 'friday'].forEach((d) => {
        next[d] = s.monday.map((sl) => ({ ...sl }));
      });
      return next;
    });
    toast.success("Monday's hours copied to the rest of the week");
  };

  const headerAction = page.slug === 'hours' ? (
    <Button size="sm" variant="outline" onClick={sameEveryWeekday}>
      <Copy className="h-4 w-4" strokeWidth={2.4} /> Same every weekday
    </Button>
  ) : null;

  return (
    <div className="flex flex-col gap-4">
      <SubPageHeader page={page} action={headerAction}>
        {page.slug === 'hours'
          ? `${totalHours.toFixed(1)} bookable hours a week · ${mock.availability.timezone}`
          : undefined}
      </SubPageHeader>

      {page.slug === 'rules' ? (
        // Full-width three-card layout per the mockup; no preview rail here.
        <RulesCards
          rules={rules}
          setRules={setRules}
          overrides={overrides}
          setOverrides={setOverrides}
          blocked={blocked}
          setBlocked={setBlocked}
          adding={addingDate}
          setAdding={setAddingDate}
        />
      ) : page.slug === 'calendars' ? (
        <Calendars />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr] lg:gap-7">
          <div className="flex min-w-0 flex-col gap-5">
            <Hours schedule={schedule} setSchedule={setSchedule} dirty={dirty} />
          </div>
          <div className="min-w-0">
            <Preview schedule={schedule} rules={rules} />
          </div>
        </div>
      )}
    </div>
  );
};

export default Schedule;

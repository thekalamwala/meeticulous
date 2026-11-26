// Schedule (/dashboard/availability) — Kept redesign (2026-11-25).
//
// Weekly hours, the week at a glance, booking rules in plain words, days off and
// Google Calendar on one screen (Calendly / Cal.com Availability). Presentation
// only: state, validation and the save payload come from useAvailabilityEditor,
// the same hook the legacy page uses, so nothing about what is saved changes.
//
// App feel (founder, 2026-11-25): settings-style rows on every screen size; a tap
// opens a bottom sheet on a phone (drag down to close) and a centred dialog on
// desktop. One layout, so phone and desktop never look like two dashboards.
// Motion follows Emil Kowalski's rules: ease-out under 300ms, press = scale 0.97,
// nothing animates from zero, reduced motion is respected.
//
// The backend stores weekly windows, a timezone, a buffer, full-day blocks and
// Pro caps — nothing else — so the page shows exactly those (founder call,
// 2026-11-25: no "coming soon" controls for date-specific hours or notice).
// Marigold is reserved for open slots: only the week grid uses it.
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion, useDragControls, useReducedMotion } from 'framer-motion';
import { Calendar, CalendarClock, CalendarPlus, CalendarRange, ChevronLeft, ChevronRight, Clock, ExternalLink, Globe, Lock, Minus, Plus, Trash2, User } from 'lucide-react';
import MeetDropdown from '../components/ui/MeetDropdown';
import { useAuth } from '../context/AuthContext';
import { isFreePlan } from '../utils/themeUtils';
import { ErrorState, Skeleton } from '../components/dashboard/ui';
import { InsightBand, PageHeading, Panel, StatusPill, cn } from '../components/dashboard/ui/v2';
import useAvailabilityEditor, { DAYS } from '../components/availability/useAvailabilityEditor';
import { BUFFERS, TZ } from '../components/availability/BookingRulesCard';
import { GoogleMark, connectGoogleCalendar, googleDisconnectHint } from '../components/availability/CalendarConnect';
import { SHORT, fmtClock, fmtHours, minutesOf, monthCells, weekGrid, weekSummary, windowsLabel } from '../components/availability/scheduleSummary';

const DAY_NAME = { monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday', thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday' };
const pad = (n) => String(n).padStart(2, '0');
// 30-minute preset grid, stored as 24h "HH:MM". A legacy off-grid value (an old
// <input type=time> save like "09:15") gets its own option so it never shows blank.
const TIMES = Array.from({ length: 48 }, (_, i) => `${pad(Math.floor(i / 2))}:${pad((i % 2) * 30)}`);

const tzName = (tz) => (TZ.find(([v]) => v === tz)?.[1] || tz).replace(/ \(.*\)$/, '');
const todayIso = () => {
  const n = new Date();
  return `${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}`;
};
// "2026-12-25" → "Fri, 25 Dec" (local date, no UTC shift); adds the year when it isn't this one.
const fmtDate = (iso) => {
  const dt = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(dt.getTime())) return iso;
  const opts = { weekday: 'short', day: 'numeric', month: 'short' };
  if (dt.getFullYear() !== new Date().getFullYear()) opts.year = 'numeric';
  return dt.toLocaleDateString('en-IN', opts);
};
const badWindow = (w) => minutesOf(w.end) <= minutesOf(w.start);

/* ── Controls — Kept: inputs 48px / 16px radius / 16px text on a phone (no iOS
 * zoom); buttons 12px rectangles; hover only tints; press scales to 0.97. ── */
const pressable = 'transition active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100';
const ring = 'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose';
const CHEVRON = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%23960D32' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E\")";
const TimeSelect = ({ value, bad = false, className = '', ...p }) => (
  <select value={value} {...p}
    className={cn('h-12 cursor-pointer appearance-none rounded-[16px] border bg-white px-3.5 pr-9 text-[16px] font-medium tabular-nums text-ink outline-none transition hover:bg-pink-50 focus-visible:border-maroon focus-visible:ring-[3px] focus-visible:ring-rose/40 sm:text-[15px]',
      bad ? 'border-error-fg' : 'border-neutral-200', className)}
    style={{ backgroundImage: CHEVRON, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.85rem center' }}>
    {!TIMES.includes(value) && value && <option value={value}>{fmtClock(value)}</option>}
    {TIMES.map((t) => <option key={t} value={t}>{fmtClock(t)}</option>)}
  </select>
);
const btn = cn('inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-[12px] px-5 text-[15px] font-semibold disabled:cursor-not-allowed disabled:opacity-45', pressable, ring);
const btnPrimary = cn(btn, 'bg-maroon text-white hover:bg-maroon-dark');
const btnSoft = cn(btn, 'bg-blush text-maroon hover:bg-pink-100');
const linkBtn = cn('inline-flex items-center gap-1 rounded-[10px] px-2 py-1.5 text-[13.5px] font-semibold text-maroon hover:bg-pink-100', pressable, ring);
const iconBtn = cn('grid h-12 w-12 shrink-0 place-items-center rounded-[12px] text-faint hover:bg-pink-50 hover:text-error-fg', pressable, ring);
// A list row: edge to edge inside its card, so its hover/press fill is square (Kept).
const rowBase = 'flex min-h-[64px] w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-pink-50 active:bg-pink-50 sm:px-6';

const bandBtn = cn('inline-flex h-11 items-center gap-2 rounded-[12px] px-5 text-[14px] font-semibold focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-pink', pressable);
const bandPrimary = cn(bandBtn, 'bg-white text-maroon hover:bg-pink-100');
const bandGhost = cn(bandBtn, 'bg-maroon-700 text-white ring-2 ring-inset ring-white/35 hover:ring-white/60');
const serif = 'font-serif font-normal italic text-pink';

// Day switch, 44×24 with a 20px knob that stays inside the track. (The shared v2
// Toggle's knob runs 2px past its bordered track and clips into a crescent.)
const DaySwitch = ({ checked, onChange, label }) => (
  <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={onChange}
    className={cn('relative h-6 w-11 shrink-0 rounded-full transition-colors', ring,
      checked ? 'bg-maroon hover:bg-maroon-dark' : 'bg-neutral-300 hover:bg-neutral-400')}>
    <span aria-hidden="true" className={cn('absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-[0_1px_2px_rgba(43,10,20,0.25)] transition-transform duration-200 ease-out motion-reduce:transition-none',
      checked && 'translate-x-5')} />
  </button>
);

/* ── Sheet — bottom sheet on a phone (drag the handle down to close), centred
 * dialog from lg. Same pattern as the tab bar's More sheet. ─────────────── */
const EASE = [0.32, 0.72, 0, 1]; // iOS sheet curve (Vaul)
const DESKTOP_Q = '(min-width: 1024px)';
const useIsDesktop = () => {
  const [is, setIs] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.(DESKTOP_Q).matches);
  useEffect(() => {
    const m = window.matchMedia?.(DESKTOP_Q);
    if (!m) return undefined;
    const on = () => setIs(m.matches);
    m.addEventListener?.('change', on);
    return () => m.removeEventListener?.('change', on);
  }, []);
  return is;
};
const Sheet = ({ open, onClose, title, children, footer }) => {
  const ref = useRef(null);
  const drag = useDragControls();
  const desktop = useIsDesktop();
  const reduce = useReducedMotion();
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const t = setTimeout(() => ref.current?.focus(), 60);
    return () => { clearTimeout(t); document.body.style.overflow = prev; document.removeEventListener('keydown', onKey); };
  }, [open, onClose]);
  const from = reduce ? { opacity: 0 } : desktop ? { opacity: 0, scale: 0.96, y: 8 } : { y: '100%' };
  const to = reduce ? { opacity: 1 } : desktop ? { opacity: 1, scale: 1, y: 0 } : { y: 0 };
  return createPortal(
    <AnimatePresence>
      {open && (
        <div key="sheet" className="dash-v2 fixed inset-0 z-[100] flex items-end justify-center lg:items-center lg:p-6">
          <motion.div className="absolute inset-0 bg-ink/40" aria-hidden="true" onClick={onClose}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} />
          <motion.div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title}
            initial={from} animate={to} exit={from} transition={{ duration: desktop ? 0.2 : 0.32, ease: EASE }}
            drag={desktop || reduce ? false : 'y'} dragListener={false} dragControls={drag}
            dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, i) => { if (i.offset.y > 100 || i.velocity.y > 500) onClose(); }}
            className="relative flex max-h-[88dvh] w-full max-w-[520px] flex-col rounded-t-[28px] bg-white outline-none lg:rounded-[32px]">
            {/* The handle + title are the drag area; the body scrolls and its pickers stay tappable. */}
            <div className="shrink-0 cursor-grab touch-none px-5 pb-2 pt-2 active:cursor-grabbing lg:cursor-auto lg:px-6 lg:pt-6"
              onPointerDown={(e) => { if (!desktop) drag.start(e); }}>
              <div aria-hidden="true" className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-neutral-300 lg:hidden" />
              <h2 className="mb-0 font-display text-[20px] font-bold tracking-[-0.02em] text-ink">{title}</h2>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-4 pt-2 lg:px-6">{children}</div>
            {footer && <div className="shrink-0 px-5 pb-[max(16px,env(safe-area-inset-bottom))] pt-2 lg:px-6 lg:pb-6">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
};

/* ── Band — the week in one sentence, from the live editor state. ───────── */
const ScheduleBand = ({ ed, username }) => {
  const { days, minutes, label, shared } = weekSummary(ed.schedule);
  const tz = tzName(ed.timezone);
  const upcoming = ed.blockedDates.filter((d) => d >= todayIso()).length;
  if (!days.length) {
    const openWeekdays = () => DAYS.slice(0, 5).forEach((d) => { if (!ed.isDayOpen(d)) ed.toggleDay(d); });
    return (
      <InsightBand mascot="blue" compact className="sm:py-6" eyebrow="Your schedule"
        title={<>Guests can&apos;t book you yet. <em className={serif}>Let&apos;s open your week.</em></>}
        sub="Turn on the days you work below, or start with weekdays, 9 am to 5 pm, and adjust."
        actions={<button type="button" className={bandPrimary} onClick={openWeekdays}><Plus className="h-4 w-4" strokeWidth={2.4} /> Open Mon–Fri, 9 to 5</button>} />
    );
  }
  const sub = [
    shared ? `${shared}, ${tz} time.` : `Hours vary by day, ${tz} time.`,
    ed.bufferMinutes ? `${fmtHours(ed.bufferMinutes)} between bookings.` : 'Bookings can run back to back.',
    upcoming ? `${upcoming} ${upcoming === 1 ? 'day' : 'days'} off coming up.` : null,
  ].filter(Boolean).join(' ');
  return (
    <InsightBand mascot="blue" compact className="sm:py-6" eyebrow="Your schedule"
      title={<>You&apos;re open {fmtHours(minutes)} a week, <span className="whitespace-nowrap">{label}.</span></>}
      sub={sub}
      actions={username && (
        <a href={`/${username}`} target="_blank" rel="noreferrer" className={bandGhost}>
          See your page <ExternalLink className="h-4 w-4" strokeWidth={2.4} />
        </a>
      )} />
  );
};

/* ── Weekly hours — a settings row per day; the sheet edits it. ───────── */
const DayRow = ({ day, ed, onOpen }) => {
  const open = ed.isDayOpen(day);
  const slots = ed.schedule[day] || [];
  const bad = slots.some(badWindow);
  return (
    <li className="flex items-center">
      {/* The switch sits outside the row button: flip a day without opening it. */}
      <span className="pl-5 sm:pl-6"><DaySwitch checked={open} onChange={() => ed.toggleDay(day)} label={`${open ? 'Close' : 'Open'} ${DAY_NAME[day]}`} /></span>
      <button type="button" onClick={() => onOpen(day)} aria-label={`Edit ${DAY_NAME[day]} hours`} className={cn(rowBase, 'pl-3 sm:pl-4', ring, 'focus-visible:ring-inset')}>
        <span className="min-w-0 flex-1">
          <span className={cn('block text-[15px] font-semibold', open ? 'text-ink' : 'text-faint')}>{DAY_NAME[day]}</span>
          <span className={cn('mt-0.5 block truncate text-[13px]', bad ? 'font-medium text-error-fg' : 'text-muted')}>
            {!open ? 'Closed' : bad ? 'Check the times: one ends before it starts' : windowsLabel(slots)}
          </span>
        </span>
        <ChevronRight className="h-5 w-5 shrink-0 text-faint" strokeWidth={2} aria-hidden="true" />
      </button>
    </li>
  );
};

const DaySheet = ({ day, ed, onClose }) => {
  const [copyTo, setCopyTo] = useState([]);
  useEffect(() => { setCopyTo([]); }, [day]);
  // Keep the last day while the sheet animates out, so its content doesn't blank mid-exit.
  const last = useRef(day);
  if (day) last.current = day;
  const d = day || last.current;
  const open = d ? ed.isDayOpen(d) : false;
  const slots = (d && ed.schedule[d]) || [];
  return (
    <Sheet open={!!day} onClose={onClose} title={d ? DAY_NAME[d] : ''}
      footer={<button type="button" className={cn(btnPrimary, 'w-full')} onClick={onClose}>Done</button>}>
      {d && (
        <div className="flex flex-col gap-5">
          <div className="flex min-h-[48px] items-center justify-between gap-3 rounded-[16px] bg-cream px-4">
            <span className="text-[15px] font-semibold text-ink">{open ? 'Open for bookings' : 'Closed all day'}</span>
            <DaySwitch checked={open} onChange={() => ed.toggleDay(d)} label={`${open ? 'Close' : 'Open'} ${DAY_NAME[d]} all day`} />
          </div>

          {open && (
            <div className="flex flex-col gap-2">
              {slots.map((w, i) => (
                <div key={i}>
                  <div className="flex items-center gap-2">
                    <TimeSelect value={w.start} onChange={(e) => ed.updateSlot(d, i, 'start', e.target.value)}
                      aria-label={`${DAY_NAME[d]} window ${i + 1} starts`} className="min-w-0 flex-1" />
                    <span className="shrink-0 text-[13px] text-faint">to</span>
                    <TimeSelect value={w.end} bad={badWindow(w)} onChange={(e) => ed.updateSlot(d, i, 'end', e.target.value)}
                      aria-label={`${DAY_NAME[d]} window ${i + 1} ends`} aria-invalid={badWindow(w) || undefined} className="min-w-0 flex-1" />
                    <button type="button" className={iconBtn} onClick={() => ed.removeSlot(d, i)} aria-label={`Remove ${DAY_NAME[d]} window ${i + 1}`}>
                      <Trash2 className="h-[18px] w-[18px]" strokeWidth={2} />
                    </button>
                  </div>
                  {badWindow(w) && <p className="mb-0 mt-1.5 text-[12.5px] font-medium text-error-fg">The end time must be after the start time.</p>}
                </div>
              ))}
              <div><button type="button" className={linkBtn} onClick={() => ed.addSlot(d)}><Plus className="h-4 w-4" strokeWidth={2.4} /> Add hours</button></div>
            </div>
          )}

          {open && (
            <div>
              <p className="mb-2 text-[13px] font-medium text-muted">Copy these hours to</p>
              <div className="flex gap-1.5">
                {DAYS.map((x) => {
                  const self = x === d;
                  const on = copyTo.includes(x);
                  return (
                    <button key={x} type="button" disabled={self} aria-pressed={on} aria-label={`Copy to ${DAY_NAME[x]}`}
                      onClick={() => setCopyTo((c) => (on ? c.filter((y) => y !== x) : [...c, x]))}
                      className={cn('grid h-11 min-w-0 flex-1 place-items-center rounded-[12px] text-[14px] font-semibold', pressable, ring,
                        self ? 'bg-maroon-100 text-maroon/60' : on ? 'bg-maroon text-white' : 'bg-neutral-100 text-ink hover:bg-pink-50')}>
                      {SHORT[x].slice(0, 1)}
                    </button>
                  );
                })}
              </div>
              <button type="button" className={cn(btnSoft, 'mt-3 w-full')} disabled={!copyTo.length}
                onClick={() => { ed.copyDayTo(d, copyTo); setCopyTo([]); }}>
                {copyTo.length ? `Copy to ${copyTo.length} ${copyTo.length === 1 ? 'day' : 'days'}` : 'Pick days to copy to'}
              </button>
            </div>
          )}
        </div>
      )}
    </Sheet>
  );
};

const WeeklyHours = ({ ed }) => {
  const [editing, setEditing] = useState(null);
  return (
    <Panel title="Weekly hours" flush subtitle={`When guests can book you each week, in ${tzName(ed.timezone)} time.`}>
      <ul className="mb-0 divide-y divide-neutral-200/70 p-0">
        {DAYS.map((d) => <DayRow key={d} day={d} ed={ed} onOpen={setEditing} />)}
      </ul>
      <DaySheet day={editing} ed={ed} onClose={() => setEditing(null)} />
    </Panel>
  );
};

/* ── Your week — the shape of the week; open half-hours in marigold. ──── */
const WeekGrid = ({ schedule }) => {
  const { rows, open } = weekGrid(schedule);
  const { label, minutes } = weekSummary(schedule);
  const todayKey = DAYS[(new Date().getDay() + 6) % 7];
  return (
    <Panel title="Your week" subtitle="Open time in gold. It updates as you edit.">
      <div role="img" aria-label={minutes ? `Open ${fmtHours(minutes)} a week, ${label}.` : 'No open hours yet.'}
        className="grid grid-cols-[2.75rem_repeat(7,minmax(0,1fr))] gap-x-1 gap-y-[3px]">
        <span />
        {DAYS.map((d) => (
          <span key={d} className={cn('pb-1 text-center text-[12px]', d === todayKey ? 'font-bold text-maroon' : 'font-medium text-faint')}>{SHORT[d]}</span>
        ))}
        {rows.map((t, r) => [
          <span key={`l${t}`} className="-mt-[7px] h-3 text-[12px] leading-none text-faint">{t % 60 === 0 ? fmtClock(`${pad(t / 60)}:00`).replace(' ', ' ') : ''}</span>,
          ...DAYS.map((d) => (
            <span key={`${d}${t}`} className={cn('h-3 rounded-[4px] transition-colors duration-200', open[d][r] ? 'bg-marigold' : 'bg-neutral-100')} />
          )),
        ])}
      </div>
      <div className="mt-4 flex items-center gap-4 text-[12.5px] text-muted">
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-[4px] bg-marigold" /> Open</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-[4px] bg-neutral-100" /> Closed</span>
      </div>
    </Panel>
  );
};

/* ── Booking rules + limits — two Kept cards with the branded MeetDropdown
 * (founder call, 2026-11-25), not the OS menu. White, borderless, no gradient
 * headers and no mascots (one per screen: the band's). Each control carries its
 * rule in plain words underneath. Only what the backend saves is shown. ─── */
// The dropdown's list hangs below the card, so these cards must not clip it.
const unclipped = '!overflow-visible';
// Kept inputs: 48px, 16px radius, 16px text on a phone (no iOS zoom).
const ddKept = '[&_.mt-dd__trigger]:h-12 [&_.mt-dd__trigger]:rounded-[16px] [&_.mt-dd__trigger]:text-[16px] sm:[&_.mt-dd__trigger]:text-[15px]';
const Field = ({ icon: Icon, label, hint, children }) => (
  <div className="min-w-0">
    <p className="mb-2 flex items-center gap-1.5 text-[13.5px] font-semibold text-ink">
      {Icon && <Icon className="h-4 w-4 shrink-0 text-faint" strokeWidth={2} aria-hidden="true" />}{label}
    </p>
    {children}
    {hint && <p className="mb-0 mt-2 text-[13px] text-muted">{hint}</p>}
  </div>
);

const BookingRules = ({ ed }) => {
  const touch = () => ed.setDirty(true);
  const buffer = ed.bufferMinutes;
  return (
    <Panel title="Booking rules" subtitle="Where your hours live and the breathing room between bookings." className={unclipped}>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field icon={Globe} label="Time zone" hint="Guests see your times in their own time zone.">
          <MeetDropdown value={ed.timezone} ariaLabel="Time zone" searchable className={ddKept}
            options={TZ.map(([value, label]) => ({ value, label: label.replace(/ \(.*\)$/, ''), sublabel: (label.match(/\((.*)\)/) || [])[1] }))}
            onChange={(v) => { ed.setTimezone(v); touch(); }} />
        </Field>
        <Field icon={Clock} label="Gap between bookings"
          hint={buffer ? `A ${buffer < 60 ? `${buffer}-minute` : `${buffer / 60}-hour`} break after every booking.` : 'Bookings can run back to back.'}>
          <MeetDropdown value={buffer} ariaLabel="Gap between bookings" className={ddKept}
            options={BUFFERS.map(([value, label]) => ({ value, label }))}
            onChange={(v) => { ed.setBufferMinutes(Number(v)); touch(); }} />
        </Field>
      </div>
    </Panel>
  );
};

const Stepper = ({ value, onChange, label, disabled }) => {
  const none = value === '' || value == null;
  const n = none ? null : Number(value);
  const step = cn('grid h-10 w-10 shrink-0 place-items-center rounded-[12px] text-maroon hover:bg-pink-50 disabled:text-neutral-300 disabled:hover:bg-transparent', pressable, ring);
  return (
    <div className="flex h-12 w-[9.5rem] shrink-0 items-center justify-between rounded-[16px] bg-neutral-100 px-1 sm:w-full">
      <button type="button" disabled={disabled || none} aria-label={`Fewer ${label}`} onClick={() => onChange(n <= 1 ? '' : String(n - 1))} className={step}>
        <Minus className="h-4 w-4" strokeWidth={2.6} />
      </button>
      <span className="min-w-0 text-center text-[16px] font-bold tabular-nums text-ink" aria-live="polite" aria-label={`${label}: ${none ? 'no limit' : n}`}>{none ? '∞' : n}</span>
      <button type="button" disabled={disabled} aria-label={`More ${label}`} onClick={() => onChange(none ? '1' : String(Math.min(999, n + 1)))} className={step}>
        <Plus className="h-4 w-4" strokeWidth={2.6} />
      </button>
    </div>
  );
};

const CAPS = [
  ['cap_per_day', 'Per day', Calendar, 'bookings a day'],
  ['cap_per_week', 'Per week', CalendarRange, 'bookings a week'],
  ['cap_per_guest', 'Per guest', User, 'bookings per guest'],
];
// "At most 6 a day and 24 a week. Each guest can hold 2 at a time." — the caps in one sentence.
const capsSentence = (caps) => {
  const has = (k) => caps[k] !== '' && caps[k] != null;
  const parts = [has('cap_per_day') && `${caps.cap_per_day} a day`, has('cap_per_week') && `${caps.cap_per_week} a week`].filter(Boolean);
  const out = [];
  if (parts.length) out.push(`At most ${parts.join(' and ')}.`);
  if (has('cap_per_guest')) out.push(`Each guest can hold ${caps.cap_per_guest} at a time.`);
  return out.length ? out.join(' ') : 'No limits: every open slot can be booked. ∞ means no limit.';
};

const BookingLimits = ({ ed, isFree }) => (
  <Panel title={<span className="inline-flex items-center gap-2">Booking limits <StatusPill status="pro" icon={Lock}>Pro</StatusPill></span>}
    subtitle="Protect your calendar from a good week.">
    {/* A phone gets a row per limit (label left, stepper right); from sm, three columns. */}
    <div className="grid gap-3 sm:grid-cols-3">
      {CAPS.map(([k, label, Icon, words]) => (
        <div key={k} className="flex items-center justify-between gap-3 sm:block">
          <p className="mb-0 flex items-center gap-1.5 text-[13.5px] font-semibold text-ink sm:mb-2">
            <Icon className="h-4 w-4 shrink-0 text-faint" strokeWidth={2} aria-hidden="true" />{label}
          </p>
          <Stepper value={isFree ? '' : ed.caps[k]} label={words} disabled={isFree}
            onChange={(nv) => { ed.setCaps((c) => ({ ...c, [k]: nv })); ed.setDirty(true); }} />
        </div>
      ))}
    </div>
    <div className="mt-5 border-t border-neutral-200/70 pt-4 text-[13px] text-muted">
      {isFree
        ? <p className="mb-0">Limits are a Pro feature. <Link to="/dashboard/upgrade?src=booking_caps" className="font-semibold text-maroon underline-offset-2 hover:underline">See Pro</Link></p>
        : <p className="mb-0">{capsSentence(ed.caps)} A booking that would break a limit is simply not offered.</p>}
    </div>
  </Panel>
);

/* ── Days off — full days guests can never book. "Add days off" opens a Kept
 * month calendar in the sheet (not the browser's own picker): tap dates to
 * toggle them, several at once. Past dates can't be picked. ─────────────── */
const MONTH_FMT = { month: 'long', year: 'numeric' };
const DayOffCalendar = ({ ed }) => {
  const now = new Date();
  const today = todayIso();
  const [view, setView] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const cells = monthCells(view.y, view.m);
  const atStart = view.y === now.getFullYear() && view.m === now.getMonth();
  const shift = (n) => setView(({ y, m }) => {
    const dt = new Date(y, m + n, 1);
    return { y: dt.getFullYear(), m: dt.getMonth() };
  });
  const navBtn = cn('grid h-10 w-10 place-items-center rounded-[12px] text-maroon hover:bg-pink-50 disabled:text-neutral-300 disabled:hover:bg-transparent', pressable, ring);
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="mb-0 font-display text-[18px] font-bold tracking-[-0.02em] text-ink" aria-live="polite">
          {new Date(view.y, view.m, 1).toLocaleDateString('en-IN', MONTH_FMT)}
        </p>
        <div className="flex gap-1">
          <button type="button" className={navBtn} disabled={atStart} onClick={() => shift(-1)} aria-label="Previous month"><ChevronLeft className="h-5 w-5" strokeWidth={2.4} /></button>
          <button type="button" className={navBtn} onClick={() => shift(1)} aria-label="Next month"><ChevronRight className="h-5 w-5" strokeWidth={2.4} /></button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1" role="group" aria-label="Pick days off">
        {DAYS.map((d) => <span key={d} className="pb-1 text-center text-[12px] font-medium text-faint">{SHORT[d]}</span>)}
        {cells.map((iso, i) => {
          if (!iso) return <span key={`b${i}`} />;
          const past = iso < today;
          const off = ed.blockedDates.includes(iso);
          const isToday = iso === today;
          return (
            <button key={iso} type="button" disabled={past} aria-pressed={off}
              aria-label={`${fmtDate(iso)}${off ? ', day off' : ''}`}
              onClick={() => (off ? ed.unblockDate(iso) : ed.blockDate(iso))}
              className={cn('grid aspect-square min-h-[40px] place-items-center rounded-[12px] text-[15px] font-semibold tabular-nums', pressable, ring,
                past ? 'cursor-not-allowed text-neutral-300'
                  : off ? 'bg-maroon text-white hover:bg-maroon-dark'
                    : cn('text-ink hover:bg-pink-50', isToday && 'ring-2 ring-inset ring-maroon/35'))}>
              {Number(iso.slice(8))}
            </button>
          );
        })}
      </div>
      <div className="mt-4 flex items-center gap-4 text-[12.5px] text-muted">
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-[4px] bg-maroon" /> Day off</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-[4px] ring-2 ring-inset ring-maroon/35" /> Today</span>
      </div>
    </div>
  );
};

const DaysOff = ({ ed }) => {
  const today = todayIso();
  const [picking, setPicking] = useState(false);
  const upcoming = ed.blockedDates.filter((d) => d >= today).length;
  return (
    <Panel title="Days off" flush subtitle="No one can book these dates, whatever your weekly hours say.">
      <ul className="mb-0 divide-y divide-neutral-200/70 p-0">
        {ed.blockedDates.map((d) => {
          const past = d < today;
          return (
            <li key={d} className="flex min-h-[64px] items-center gap-3 py-2 pl-5 pr-3 sm:pl-6 sm:pr-4">
              <span className={cn('flex-1 text-[15px] font-semibold', past ? 'text-faint' : 'text-ink')}>{fmtDate(d)}</span>
              {past && <StatusPill status="past">Past</StatusPill>}
              <button type="button" className={iconBtn} onClick={() => ed.unblockDate(d)} aria-label={`Unblock ${fmtDate(d)}`}>
                <Trash2 className="h-[18px] w-[18px]" strokeWidth={2} />
              </button>
            </li>
          );
        })}
        <li>
          <button type="button" onClick={() => setPicking(true)} className={cn(rowBase, 'text-maroon', ring, 'focus-visible:ring-inset')}>
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] bg-blush"><CalendarPlus className="h-5 w-5" strokeWidth={2.2} /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-semibold">Add days off</span>
              {!ed.blockedDates.length && <span className="mt-0.5 block text-[13px] text-faint">No days off planned yet.</span>}
            </span>
            <ChevronRight className="h-5 w-5 shrink-0 text-faint" strokeWidth={2} aria-hidden="true" />
          </button>
        </li>
      </ul>
      <Sheet open={picking} onClose={() => setPicking(false)} title="Days off"
        footer={(
          <button type="button" className={cn(btnPrimary, 'w-full')} onClick={() => setPicking(false)}>
            {upcoming ? `Done · ${upcoming} ${upcoming === 1 ? 'day' : 'days'} off` : 'Done'}
          </button>
        )}>
        <DayOffCalendar ed={ed} />
      </Sheet>
    </Panel>
  );
};

/* ── Google Calendar — the one real calendar integration. ─────────────── */
const CalendarCard = ({ user }) => {
  const connected = !!user?.google_calendar_connected;
  return (
    <Panel title="Calendars" flush>
      <button type="button" onClick={connected ? googleDisconnectHint : connectGoogleCalendar}
        className={cn(rowBase, ring, 'focus-visible:ring-inset')}>
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] bg-cream"><GoogleMark className="h-5 w-5" /></span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2 text-[15px] font-semibold text-ink">
            Google Calendar <StatusPill status={connected ? 'active' : 'pending'}>{connected ? 'Connected' : 'Not connected'}</StatusPill>
          </span>
          <span className="mt-0.5 block text-[13px] text-faint">
            {connected ? 'Busy times block bookings. Bookings get a Meet link.' : 'Connect so busy times block bookings and bookings get a Meet link.'}
          </span>
        </span>
        {connected
          ? <ChevronRight className="h-5 w-5 shrink-0 text-faint" strokeWidth={2} aria-hidden="true" />
          : <span className="shrink-0 rounded-[10px] bg-maroon px-3 py-2 text-[13.5px] font-semibold text-white">Connect</span>}
      </button>
      <p className="mb-0 border-t border-neutral-200/70 px-5 py-3 text-[12.5px] text-faint sm:px-6">Apple and Outlook calendars are coming soon.</p>
    </Panel>
  );
};

const AvailabilityV2 = () => {
  const ed = useAvailabilityEditor();
  const { user } = useAuth() || {};
  const isFree = isFreePlan(user?.plan);
  const reduce = useReducedMotion();

  // Unsaved edits: the browser asks before a reload or tab close drops them.
  useEffect(() => {
    if (!ed.dirty) return undefined;
    const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [ed.dirty]);

  const heading = <PageHeading title="Schedule" sub="When guests can book you, and the rules that keep your week sane." />;

  if (ed.status === 'error') {
    return (
      <div className="flex flex-col gap-6">
        {heading}
        <div className="rounded-[24px] bg-white">
          <ErrorState icon={CalendarClock} title="We couldn't load your schedule."
            message="Your hours are safe. This is a problem showing them. Try again." onRetry={ed.fetchAvailability} />
        </div>
      </div>
    );
  }

  // Wait for the data: the defaults (every day closed) before it lands would be a false state.
  const loading = ed.status === 'loading';
  const sk = (h) => <Skeleton className={cn(h, 'rounded-[24px]')} />;

  return (
    <form onSubmit={(e) => { e.preventDefault(); ed.save(); }} className="flex flex-col gap-6">
      {heading}
      {loading ? sk('h-[200px]') : <ScheduleBand ed={ed} username={user?.username} />}

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:gap-6">
        <div className="flex min-w-0 flex-col gap-4 lg:gap-6">
          {loading ? sk('h-[520px]') : <WeeklyHours ed={ed} />}
          {loading ? sk('h-[220px]') : <BookingRules ed={ed} />}
          {loading ? sk('h-[220px]') : <BookingLimits ed={ed} isFree={isFree} />}
        </div>
        <div className="flex min-w-0 flex-col gap-4 lg:gap-6">
          {loading ? sk('h-[300px]') : <WeekGrid schedule={ed.schedule} />}
          {loading ? sk('h-[180px]') : <DaysOff ed={ed} />}
          {loading ? sk('h-[140px]') : <CalendarCard user={user} />}
        </div>
      </div>

      {/* The save bar appears only when there is something to save, sliding up like an
          app's. Not the shared StickyActionBar: that one sits 4rem up (the old 64px tab
          bar), so under Kept's 77px tab bar (shown below lg) it slid underneath. The
          negative bottom margin eats the layout's bottom padding (pb-28 / lg:pb-12) down
          to the tab bar, so at the end of the page it still lands on it, not above a gap.
          ponytail: 77px = KeptTabBar's rendered height; read it from a CSS var if that bar changes. */}
      <AnimatePresence>
        {!loading && ed.dirty && (
          <motion.div key="save-bar"
            initial={reduce ? { opacity: 0 } : { y: '100%', opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={reduce ? { opacity: 0 } : { y: '100%', opacity: 0 }}
            transition={{ duration: 0.24, ease: EASE }}
            className="sticky bottom-[calc(77px+env(safe-area-inset-bottom,0px))] z-30 -mx-4 mb-[calc(77px_+_env(safe-area-inset-bottom,0px)_-_7rem)] border-t border-neutral-200 bg-white px-4 py-3 sm:-mx-6 sm:px-6 lg:bottom-0 lg:-mx-8 lg:mb-[-3rem] lg:px-8">
            <div className="flex w-full items-center gap-2">
              <p className="mb-0 mr-auto flex items-center gap-2 text-[13.5px] font-semibold text-ink" aria-live="polite">
                <span className="h-2 w-2 shrink-0 rounded-full bg-maroon" aria-hidden="true" /> Unsaved changes
              </p>
              <button type="button" className={btnSoft} disabled={ed.loading} onClick={ed.reset}>Discard</button>
              <button type="submit" className={btnPrimary} disabled={ed.loading}>{ed.loading ? 'Saving…' : 'Save'}</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </form>
  );
};

export default AvailabilityV2;

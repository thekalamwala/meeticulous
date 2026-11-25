// Schedule (/dashboard/availability) — Kept redesign (2026-11-25).
//
// Weekly hours, the week at a glance, booking rules in plain words, days off and
// Google Calendar on one screen (Calendly / Cal.com Availability). Presentation
// only: state, validation and the save payload come from useAvailabilityEditor,
// the same hook the legacy page uses, so nothing about what is saved changes.
//
// The backend stores weekly windows, a timezone, a buffer, full-day blocks and
// Pro caps — nothing else — so the page shows exactly those (founder call,
// 2026-11-25: no "coming soon" controls for date-specific hours or notice).
// Marigold is reserved for open slots: only the week grid uses it.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, ExternalLink, Lock, Minus, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { isFreePlan } from '../utils/themeUtils';
import { ErrorState, Skeleton, StickyActionBar } from '../components/dashboard/ui';
import { InsightBand, PageHeading, Panel, StatusPill, Toggle, cn } from '../components/dashboard/ui/v2';
import useAvailabilityEditor, { DAYS } from '../components/availability/useAvailabilityEditor';
import { BUFFERS, TZ } from '../components/availability/BookingRulesCard';
import { GoogleMark, connectGoogleCalendar, googleDisconnectHint } from '../components/availability/CalendarConnect';
import { SHORT, dayMinutes, fmtClock, fmtHours, minutesOf, weekGrid, weekSummary } from '../components/availability/scheduleSummary';

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

/* ── Controls — Kept: inputs 48px / 16px radius / 16px text on a phone (no iOS
 * zoom); buttons 12px rectangles; hover only tints. ─────────────────────── */
const CHEVRON = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%23960D32' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E\")";
const field = 'h-12 rounded-[16px] border border-neutral-200 bg-white px-3.5 text-[16px] text-ink outline-none transition hover:bg-pink-50 focus-visible:border-maroon focus-visible:ring-[3px] focus-visible:ring-rose/40 sm:text-[15px]';
const NativeSelect = ({ className = '', bad = false, children, ...p }) => (
  <select {...p}
    className={cn(field, 'cursor-pointer appearance-none pr-9 font-medium tabular-nums', bad && 'border-error-fg', className)}
    style={{ backgroundImage: CHEVRON, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.85rem center' }}>
    {children}
  </select>
);
const TimeSelect = ({ value, ...p }) => (
  <NativeSelect value={value} {...p}>
    {!TIMES.includes(value) && value && <option value={value}>{fmtClock(value)}</option>}
    {TIMES.map((t) => <option key={t} value={t}>{fmtClock(t)}</option>)}
  </NativeSelect>
);
const btn = 'inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-[12px] px-5 text-[15px] font-semibold transition focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose disabled:cursor-not-allowed disabled:opacity-45';
const btnPrimary = cn(btn, 'bg-maroon text-white hover:bg-maroon-dark');
const btnSoft = cn(btn, 'bg-blush text-maroon hover:bg-pink-100');
const linkBtn = 'inline-flex items-center gap-1 rounded-[10px] px-2 py-1.5 text-[13.5px] font-semibold text-maroon transition hover:bg-pink-100 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose';
const iconBtn = 'grid h-12 w-12 shrink-0 place-items-center rounded-[12px] text-faint transition hover:bg-pink-50 hover:text-error-fg focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose';

const bandBtn = 'inline-flex h-11 items-center gap-2 rounded-[12px] px-5 text-[14px] font-semibold transition focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-pink';
const bandPrimary = cn(bandBtn, 'bg-white text-maroon hover:bg-pink-100');
const bandGhost = cn(bandBtn, 'bg-maroon-700 text-white ring-2 ring-inset ring-white/35 hover:ring-white/60');
const serif = 'font-serif font-normal italic text-pink';

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

/* ── Weekly hours — one row per day: switch, name, windows. ───────────── */
const DayRow = ({ day, ed }) => {
  const open = ed.isDayOpen(day);
  const slots = ed.schedule[day] || [];
  return (
    <div className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:gap-4 sm:px-6">
      <div className="flex h-12 items-center gap-3 sm:w-[10.5rem] sm:shrink-0">
        <Toggle checked={open} onChange={() => ed.toggleDay(day)} label={`${open ? 'Close' : 'Open'} ${DAY_NAME[day]}`} />
        <span className={cn('text-[15px] font-semibold', open ? 'text-ink' : 'text-faint')}>{DAY_NAME[day]}</span>
        {/* The day's total sits on the right on a phone; on desktop the windows say it. */}
        <span className="ml-auto text-[13px] text-faint sm:hidden">{open ? fmtHours(dayMinutes(slots)) : 'Closed'}</span>
      </div>
      {open ? (
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          {slots.map((w, i) => {
            const bad = minutesOf(w.end) <= minutesOf(w.start);
            return (
              <div key={i}>
                <div className="flex items-center gap-2">
                  <TimeSelect value={w.start} onChange={(e) => ed.updateSlot(day, i, 'start', e.target.value)}
                    aria-label={`${DAY_NAME[day]} window ${i + 1} starts`} className="min-w-0 flex-1 sm:max-w-[9.5rem]" />
                  <span className="shrink-0 text-[13px] text-faint">to</span>
                  <TimeSelect value={w.end} bad={bad} onChange={(e) => ed.updateSlot(day, i, 'end', e.target.value)}
                    aria-label={`${DAY_NAME[day]} window ${i + 1} ends`} aria-invalid={bad || undefined} className="min-w-0 flex-1 sm:max-w-[9.5rem]" />
                  <button type="button" className={iconBtn} onClick={() => ed.removeSlot(day, i)} aria-label={`Remove ${DAY_NAME[day]} window ${i + 1}`}>
                    <Trash2 className="h-[18px] w-[18px]" strokeWidth={2} />
                  </button>
                </div>
                {bad && <p className="mb-0 mt-1.5 text-[12.5px] font-medium text-error-fg">The end time must be after the start time.</p>}
              </div>
            );
          })}
          <div><button type="button" className={linkBtn} onClick={() => ed.addSlot(day)}><Plus className="h-4 w-4" strokeWidth={2.4} /> Add hours</button></div>
        </div>
      ) : (
        <p className="mb-0 hidden h-12 items-center text-[14px] text-faint sm:flex">Closed</p>
      )}
    </div>
  );
};

const WeeklyHours = ({ ed }) => (
  <Panel title="Weekly hours" flush bodyClassName="divide-y divide-neutral-200/70"
    subtitle={`When guests can book you each week, in ${tzName(ed.timezone)} time.`}
    action={(
      <NativeSelect value="" aria-label="Copy Monday's hours to other days" className="w-full sm:w-auto"
        onChange={(e) => { if (e.target.value) ed.applyMondayTo(e.target.value); e.target.value = ''; }}>
        <option value="">Copy Monday to…</option>
        <option value="weekdays">Weekdays (Mon–Fri)</option>
        <option value="weekend">Weekend (Sat–Sun)</option>
        <option value="all">Every day</option>
      </NativeSelect>
    )}>
    {DAYS.map((d) => <DayRow key={d} day={d} ed={ed} />)}
  </Panel>
);

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
            <span key={`${d}${t}`} className={cn('h-3 rounded-[4px]', open[d][r] ? 'bg-marigold' : 'bg-neutral-100')} />
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

/* ── Booking rules — each rule says what it does in a sentence. ───────── */
const Rule = ({ title, note, children }) => (
  <div className="flex flex-col gap-3 px-5 py-4 sm:px-6">
    <div className="min-w-0">
      <p className="mb-0 text-[15px] font-semibold text-ink">{title}</p>
      {note && <p className="mb-0 mt-0.5 text-[13px] text-faint">{note}</p>}
    </div>
    {children}
  </div>
);

const Stepper = ({ value, onChange, label }) => {
  const none = value === '' || value == null;
  const n = none ? null : Number(value);
  return (
    <div className="flex h-12 w-full items-center justify-between rounded-[16px] border border-neutral-200 bg-white px-1 sm:w-[11rem]">
      <button type="button" disabled={none} aria-label={`Fewer ${label}`} onClick={() => onChange(n <= 1 ? '' : String(n - 1))}
        className="grid h-10 w-10 place-items-center rounded-[12px] text-maroon transition hover:bg-pink-50 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose disabled:opacity-30">
        <Minus className="h-4 w-4" strokeWidth={2.6} />
      </button>
      <span className="text-[15px] font-semibold tabular-nums text-ink" aria-live="polite">{none ? 'No limit' : n}</span>
      <button type="button" aria-label={`More ${label}`} onClick={() => onChange(none ? '1' : String(Math.min(999, n + 1)))}
        className="grid h-10 w-10 place-items-center rounded-[12px] text-maroon transition hover:bg-pink-50 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose">
        <Plus className="h-4 w-4" strokeWidth={2.6} />
      </button>
    </div>
  );
};

const CAPS = [
  ['cap_per_day', 'bookings a day', (n) => `At most ${n} ${n === 1 ? 'booking' : 'bookings'} a day`, 'No limit on bookings a day'],
  ['cap_per_week', 'bookings a week', (n) => `At most ${n} ${n === 1 ? 'booking' : 'bookings'} a week`, 'No limit on bookings a week'],
  ['cap_per_guest', 'bookings per guest', (n) => `Each guest can hold ${n} ${n === 1 ? 'booking' : 'bookings'} at a time`, 'Guests can book as often as they like'],
];

const BookingRules = ({ ed, isFree }) => {
  const touch = () => ed.setDirty(true);
  return (
    <Panel title="Booking rules" flush bodyClassName="divide-y divide-neutral-200/70">
      <Rule title={`Your hours are in ${tzName(ed.timezone)} time`} note="Guests see times converted to their own time zone.">
        <NativeSelect value={ed.timezone} aria-label="Time zone" onChange={(e) => { ed.setTimezone(e.target.value); touch(); }}>
          {TZ.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </NativeSelect>
      </Rule>
      <Rule title={ed.bufferMinutes ? `A ${ed.bufferMinutes < 60 ? `${ed.bufferMinutes}-minute` : `${ed.bufferMinutes / 60}-hour`} break after every booking` : 'Bookings can run back to back'}
        note="Time kept free after each booking before the next can start.">
        <NativeSelect value={ed.bufferMinutes} aria-label="Gap between bookings" onChange={(e) => { ed.setBufferMinutes(parseInt(e.target.value, 10)); touch(); }}>
          {BUFFERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </NativeSelect>
      </Rule>
      {isFree ? (
        <Rule title={<span className="inline-flex items-center gap-2">Booking limits <StatusPill status="pro" icon={Lock}>Pro</StatusPill></span>}
          note="Cap bookings per day, per week or per guest, so a good week never turns into a hard one.">
          <div><Link to="/dashboard/upgrade?src=booking_caps" className={linkBtn}>See Pro</Link></div>
        </Rule>
      ) : CAPS.map(([k, label, on, off]) => {
        const v = ed.caps[k];
        return (
          <Rule key={k} title={v === '' || v == null ? off : on(Number(v))}>
            <Stepper value={v} label={label} onChange={(nv) => { ed.setCaps((c) => ({ ...c, [k]: nv })); touch(); }} />
          </Rule>
        );
      })}
    </Panel>
  );
};

/* ── Days off — full days guests can never book. ─────────────────────── */
const DaysOff = ({ ed }) => {
  const [date, setDate] = useState('');
  const today = todayIso();
  return (
    <Panel title="Days off" subtitle="Holidays and time away. No one can book these dates, whatever your weekly hours say.">
      <div className="flex gap-2">
        <input type="date" value={date} min={today} onChange={(e) => setDate(e.target.value)} aria-label="Date to block"
          className={cn(field, 'min-w-0 flex-1')} />
        <button type="button" className={btnSoft} disabled={!date} onClick={() => { if (ed.blockDate(date)) setDate(''); }}>
          <Plus className="h-4 w-4" strokeWidth={2.4} /> Block day
        </button>
      </div>
      {ed.blockedDates.length === 0 ? (
        <p className="mb-0 mt-4 text-[14px] text-faint">No days off planned.</p>
      ) : (
        <ul className="-mx-5 mb-0 mt-3 divide-y divide-neutral-200/70 sm:-mx-6">
          {ed.blockedDates.map((d) => {
            const past = d < today;
            return (
              <li key={d} className="flex items-center gap-3 px-5 py-1.5 sm:px-6">
                <span className={cn('flex-1 text-[15px] font-medium', past ? 'text-faint' : 'text-ink')}>{fmtDate(d)}</span>
                {past && <StatusPill status="past">Past</StatusPill>}
                <button type="button" className={iconBtn} onClick={() => ed.unblockDate(d)} aria-label={`Unblock ${fmtDate(d)}`}>
                  <Trash2 className="h-[18px] w-[18px]" strokeWidth={2} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
};

/* ── Google Calendar — the one real calendar integration. ─────────────── */
const CalendarCard = ({ user }) => {
  const connected = !!user?.google_calendar_connected;
  return (
    <Panel title="Google Calendar">
      <div className="flex items-start gap-3">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[12px] bg-cream"><GoogleMark className="h-6 w-6" /></span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill status={connected ? 'active' : 'pending'}>{connected ? 'Connected' : 'Not connected'}</StatusPill>
            {connected && user?.email && <span className="truncate text-[13px] text-faint">{user.email}</span>}
          </div>
          <p className="mb-0 mt-1.5 text-[14px] text-muted">
            {connected
              ? 'Busy times in Google block new bookings, and confirmed bookings get a Google Meet link.'
              : 'Connect it so busy times in Google block new bookings, and confirmed bookings get a Google Meet link.'}
          </p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        {connected
          ? <button type="button" className={linkBtn} onClick={googleDisconnectHint}>How to disconnect</button>
          : <button type="button" className={btnPrimary} onClick={connectGoogleCalendar}><CalendarClock className="h-4 w-4" strokeWidth={2.4} /> Connect Google Calendar</button>}
        <span className="text-[12.5px] text-faint">Apple and Outlook calendars are coming soon.</span>
      </div>
    </Panel>
  );
};

const AvailabilityV2 = () => {
  const ed = useAvailabilityEditor();
  const { user } = useAuth() || {};
  const isFree = isFreePlan(user?.plan);

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
        {loading ? sk('h-[640px]') : <WeeklyHours ed={ed} />}
        <div className="flex min-w-0 flex-col gap-4 lg:gap-6">
          {loading ? sk('h-[300px]') : <WeekGrid schedule={ed.schedule} />}
          {loading ? sk('h-[280px]') : <BookingRules ed={ed} isFree={isFree} />}
          {loading ? sk('h-[200px]') : <DaysOff ed={ed} />}
          {loading ? sk('h-[180px]') : <CalendarCard user={user} />}
        </div>
      </div>

      {!loading && (
        <StickyActionBar className="mt-0">
          <div className="flex w-full items-center gap-2">
            <p className={cn('mb-0 mr-auto flex items-center gap-2 text-[13.5px]', ed.dirty ? 'font-semibold text-ink' : 'text-faint')} aria-live="polite">
              {ed.dirty && <span className="h-2 w-2 shrink-0 rounded-full bg-maroon" aria-hidden="true" />}
              {ed.dirty ? 'Unsaved changes' : 'No unsaved changes'}
            </p>
            <button type="button" className={btnSoft} disabled={!ed.dirty || ed.loading} onClick={ed.reset}>Discard</button>
            <button type="submit" className={btnPrimary} disabled={!ed.dirty || ed.loading}>{ed.loading ? 'Saving…' : 'Save'}</button>
          </div>
        </StickyActionBar>
      )}
    </form>
  );
};

export default AvailabilityV2;

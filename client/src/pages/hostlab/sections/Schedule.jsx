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
import { useMemo, useState } from 'react';
import {
  Calendar, CalendarPlus, CalendarX2, CheckCircle2, Copy, Globe, Link2, Lock,
  Plus, Trash2, Clock, Eye,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Button, Tabs, cn } from '../../../components/dashboard/ui';
import { Field, LabInput, LabSelect, Panel, Toggle, fmtDayFull, useUrlTab } from '../labUi';
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

  const totalHours = useMemo(
    () => Object.values(schedule).flat().reduce((n, sl) => n + (minutesOf(sl.end) - minutesOf(sl.start)), 0) / 60,
    [schedule],
  );

  return (
    <Panel
      title="Weekly hours"
      subtitle={`${totalHours.toFixed(1)} bookable hours a week · ${mock.availability.timezone}`}
      action={(
        <Button
          size="sm"
          variant="outline"
          onClick={() => copyTo('monday', ['tuesday', 'wednesday', 'thursday', 'friday'])}
        >
          <Copy className="h-4 w-4" strokeWidth={2.4} /> Same every weekday
        </Button>
      )}
      flush
    >
      <ul className="divide-y-2 divide-neutral-200">
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
        <div className="flex items-center gap-2 border-t-2 border-neutral-200 bg-marigold-100 px-2.5 py-1.5">
          <span className="text-[11px] font-bold text-marigold-800">Unsaved changes</span>
          <Button size="sm" className="ml-auto" onClick={() => toast.success('Hours saved')}>Save hours</Button>
        </div>
      )}
    </Panel>
  );
};

/* ── Rules ─────────────────────────────────────────────────────────────── */
const Rules = ({ rules, setRules }) => (
  <div className="grid gap-2.5 lg:grid-cols-2">
    <Panel title="Booking rules" subtitle="The guard rails on every slot you offer">
      <div className="grid gap-2 sm:grid-cols-2">
        <Field label="Time zone" hint="Guests always see their own local time.">
          <LabSelect value={rules.timezone} onChange={(e) => setRules((r) => ({ ...r, timezone: e.target.value }))}>
            {['Asia/Kolkata', 'Asia/Dubai', 'Europe/London', 'America/New_York', 'Asia/Singapore'].map((t) => <option key={t}>{t}</option>)}
          </LabSelect>
        </Field>
        <Field label="Gap between bookings" hint="Breathing room, travel, notes.">
          <LabSelect value={rules.buffer_minutes} onChange={(e) => setRules((r) => ({ ...r, buffer_minutes: +e.target.value }))}>
            {[0, 5, 10, 15, 20, 30, 45, 60].map((n) => <option key={n} value={n}>{n === 0 ? 'No gap' : `${n} minutes`}</option>)}
          </LabSelect>
        </Field>
        <Field label="Minimum notice" hint="New. Stops a booking landing 10 minutes from now.">
          <LabSelect value={rules.min_notice_hours} onChange={(e) => setRules((r) => ({ ...r, min_notice_hours: +e.target.value }))}>
            {[0, 1, 2, 4, 8, 12, 24, 48].map((n) => <option key={n} value={n}>{n === 0 ? 'None' : n === 1 ? '1 hour' : `${n} hours`}</option>)}
          </LabSelect>
        </Field>
        <Field label="How far ahead" hint="New. Keeps your far future free.">
          <LabSelect value={rules.booking_window_days} onChange={(e) => setRules((r) => ({ ...r, booking_window_days: +e.target.value }))}>
            {[7, 14, 30, 60, 90, 180, 365].map((n) => <option key={n} value={n}>{n} days</option>)}
          </LabSelect>
        </Field>
      </div>
    </Panel>

    <Panel
      title="Daily limits"
      subtitle="Protect your calendar from a good week"
      action={<span className="rounded-full bg-marigold px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-ink">Pro</span>}
    >
      <div className="grid gap-2 sm:grid-cols-3">
        {[
          ['per_day', 'Per day'],
          ['per_week', 'Per week'],
          ['per_guest', 'Per guest'],
        ].map(([k, label]) => (
          <Field key={k} label={label}>
            <LabInput
              type="number"
              min={1}
              inputMode="numeric"
              placeholder="No limit"
              value={rules.caps[k] ?? ''}
              onChange={(e) => setRules((r) => ({ ...r, caps: { ...r.caps, [k]: e.target.value === '' ? null : +e.target.value } }))}
            />
          </Field>
        ))}
      </div>
      <p className="mt-2.5 text-[10.5px] font-medium text-ink/50">
        A booking that would break a limit is simply not offered — the guest never sees a slot they cannot have.
      </p>
    </Panel>
  </div>
);

/* ── Dates ─────────────────────────────────────────────────────────────── */
const Dates = ({ overrides, setOverrides, blocked, setBlocked }) => {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ date: '', kind: 'hours', start: '10:00', end: '14:00', label: '' });

  const add = () => {
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

  return (
    <Panel
      title="Specific dates"
      subtitle="One-offs that override the weekly pattern"
      action={<Button size="sm" onClick={() => setAdding((v) => !v)}><CalendarPlus className="h-4 w-4" strokeWidth={2.4} /> Add a date</Button>}
      flush
    >
      {adding && (
        <div className="border-b-2 border-neutral-200 bg-cream p-2.5">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Date">
              <LabInput type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
            </Field>
            <Field label="What happens">
              <LabSelect value={form.kind} onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value }))}>
                <option value="hours">Different hours</option>
                <option value="block">Not available at all</option>
              </LabSelect>
            </Field>
            {form.kind === 'hours' && (
              <>
                <Field label="From">
                  <LabSelect value={form.start} onChange={(e) => setForm((f) => ({ ...f, start: e.target.value }))}>
                    {TIMES.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}
                  </LabSelect>
                </Field>
                <Field label="To">
                  <LabSelect value={form.end} onChange={(e) => setForm((f) => ({ ...f, end: e.target.value }))}>
                    {TIMES.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}
                  </LabSelect>
                </Field>
              </>
            )}
            <Field label="Note to yourself" className={form.kind === 'block' ? 'sm:col-span-2' : 'lg:col-span-4'}>
              <LabInput value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} placeholder="Clinic visit, travelling, public holiday…" />
            </Field>
          </div>
          <div className="mt-2.5 flex gap-1.5">
            <Button size="sm" onClick={add} disabled={!form.date}>Add date</Button>
            <Button size="sm" variant="outline" onClick={() => setAdding(false)}>Cancel</Button>
            {!form.date && <span className="self-center text-[10.5px] font-semibold text-warning-fg">Pick a date first.</span>}
          </div>
        </div>
      )}

      {overrides.length === 0 && blocked.length === 0 ? (
        <div className="flex flex-col items-center gap-1.5 px-2.5 py-10 text-center">
          <Calendar className="h-6 w-6 text-maroon/30" strokeWidth={1.8} />
          <p className="text-[12px] font-bold text-ink">No one-offs set</p>
          <p className="max-w-sm text-[11px] font-medium text-ink/55">Add a date when you are away, or when you work different hours than usual.</p>
        </div>
      ) : (
        <ul className="divide-y-2 divide-neutral-200">
          {overrides.map((o) => (
            <li key={o.date} className="flex items-center gap-2 px-2.5 py-1.5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-marigold-100 text-marigold-800">
                <Clock className="h-4 w-4" strokeWidth={2.4} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[12px] font-bold text-ink">{fmtDayFull(o.date)}</span>
                <span className="block text-[11px] font-medium text-ink/55">
                  {o.slots.map((s) => `${pretty(s.start)} – ${pretty(s.end)}`).join(', ')} · {o.label}
                </span>
              </span>
              <button
                type="button"
                onClick={() => { setOverrides((v) => v.filter((x) => x.date !== o.date)); toast.success('Date removed'); }}
                aria-label={`Remove ${fmtDayFull(o.date)}`}
                className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-ink/35 transition hover:bg-error-bg hover:text-error-fg"
              >
                <Trash2 className="h-4 w-4" strokeWidth={2.2} />
              </button>
            </li>
          ))}
          {blocked.map((d) => (
            <li key={d} className="flex items-center gap-2 px-2.5 py-1.5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-neutral-100 text-ink/50">
                <CalendarX2 className="h-4 w-4" strokeWidth={2.4} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[12px] font-bold text-ink">{fmtDayFull(d)}</span>
                <span className="block text-[11px] font-medium text-ink/55">Not available at all</span>
              </span>
              <button
                type="button"
                onClick={() => { setBlocked((v) => v.filter((x) => x !== d)); toast.success('Date unblocked'); }}
                aria-label={`Unblock ${fmtDayFull(d)}`}
                className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-ink/35 transition hover:bg-error-bg hover:text-error-fg"
              >
                <Trash2 className="h-4 w-4" strokeWidth={2.2} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
};

/* ── Calendars ─────────────────────────────────────────────────────────── */
const Calendars = () => {
  const [cals, setCals] = useState(mock.availability.calendars);
  return (
    <Panel title="Connected calendars" subtitle="Busy time elsewhere should close the slot here" flush>
      <ul className="divide-y-2 divide-neutral-200">
        {cals.map((c) => (
          <li key={c.id} className="flex flex-wrap items-center gap-2 px-2.5 py-2">
            <span className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-lg', c.status === 'connected' ? 'bg-success-bg text-success-fg' : 'bg-neutral-100 text-ink/45')}>
              {c.status === 'connected' ? <CheckCircle2 className="h-4 w-4" strokeWidth={2.4} /> : <Link2 className="h-4 w-4" strokeWidth={2.4} />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[12px] font-bold text-ink">{c.name}</span>
              <span className="block text-[11px] font-medium text-ink/55">
                {c.status === 'connected' ? `${c.account} · two-way, busy time blocks your slots` : 'Not connected'}
              </span>
            </span>
            {c.status === 'connected' ? (
              <div className="flex items-center gap-1.5">
                <Toggle checked onChange={() => toast.success('Two-way sync is required while connected')} label="Two-way sync" />
                <Button size="sm" variant="outline" onClick={() => { setCals((v) => v.map((x) => (x.id === c.id ? { ...x, status: 'available', account: null } : x))); toast.success(`${c.name} disconnected`); }}>
                  Disconnect
                </Button>
              </div>
            ) : (
              <Button size="sm" onClick={() => { setCals((v) => v.map((x) => (x.id === c.id ? { ...x, status: 'connected', account: 'ananya@icloud.com' } : x))); toast.success(`${c.name} connected`); }}>
                Connect
              </Button>
            )}
          </li>
        ))}
      </ul>
      <div className="flex items-start gap-1.5 border-t-2 border-neutral-200 bg-cream p-2.5">
        <Lock className="mt-0.5 h-4 w-4 shrink-0 text-ink/40" strokeWidth={2.2} />
        <p className="text-[11px] font-medium text-ink/60">
          Meeticulous reads only the busy/free times on a connected calendar. It never reads event titles, guests or notes.
        </p>
      </div>
    </Panel>
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
    <Panel
      title="What a guest sees right now"
      subtitle={`Next bookable 30-minute slots, after your ${rules.min_notice_hours}h notice and ${rules.buffer_minutes}m gap`}
      action={<Button size="sm" variant="ghost" onClick={() => toast.success('Opens your public booking page in a new tab')}><Eye className="h-4 w-4" strokeWidth={2.4} /> Open live page</Button>}
    >
      {grouped.length === 0 ? (
        <p className="py-6 text-center text-[11.5px] font-semibold text-ink/45">
          No slots are bookable in the next 10 days. Open some hours, or loosen the notice rule.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {grouped.map(([day, items]) => (
            <div key={day}>
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-ink/45">
                {new Date(day).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {items.map((s) => (
                  <span key={s.key} className="rounded-lg border-2 border-marigold-300 bg-marigold-100 px-2.5 py-1 text-[10.5px] font-bold text-marigold-800">
                    {s.at.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true }).replace(' ', '')}
                  </span>
                ))}
              </div>
            </div>
          ))}
          <p className="flex items-center gap-1.5 text-[10.5px] font-medium text-ink/45">
            <Globe className="h-3.5 w-3.5" strokeWidth={2.2} /> Shown in {rules.timezone}. Guests see their own zone.
          </p>
        </div>
      )}
    </Panel>
  );
};

/* ── Page ──────────────────────────────────────────────────────────────── */
const Schedule = () => {
  const [tab, setTab, TABS] = useUrlTab('schedule');
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
  const setSchedule = (fn) => { setScheduleRaw(fn); setDirty(true); };

  return (
    <div className="flex flex-col gap-2.5">
      <header>
        <h1 className="mb-0 font-display text-[17px] font-extrabold tracking-[-0.03em] text-maroon sm:text-[18px]">Schedule</h1>
        <p className="mt-0.5 text-[12px] font-medium text-ink/55">When guests can book you, and the rules around it.</p>
      </header>

      <Tabs tabs={TABS} value={tab} onChange={setTab} />

      <div className="grid gap-2.5 lg:grid-cols-[1.5fr_1fr]">
        <div className="flex min-w-0 flex-col gap-2.5">
          {tab === 'hours' && <Hours schedule={schedule} setSchedule={setSchedule} dirty={dirty} />}
          {tab === 'rules' && <Rules rules={rules} setRules={setRules} />}
          {tab === 'dates' && <Dates overrides={overrides} setOverrides={setOverrides} blocked={blocked} setBlocked={setBlocked} />}
          {tab === 'calendars' && <Calendars />}
        </div>
        <div className="min-w-0">
          <Preview schedule={schedule} rules={rules} />
        </div>
      </div>
    </div>
  );
};

export default Schedule;

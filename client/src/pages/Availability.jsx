import { useState, useEffect } from "react";
import { Plus, Trash2, MoreHorizontal, Globe, Clock, Settings } from "lucide-react";
import {
  setAvailability as saveAvailability,
  getAvailability,
} from "../services/api";
import BackButton from "../components/common/BackButton";
import toast from "react-hot-toast";
import {
  PageHeader, Card, Button, FormField, Select, Input, StickyActionBar,
  ContextMenu, cn,
} from "../components/dashboard/ui";

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const DEFAULT_SCHEDULE = DAYS.reduce((acc, day) => { acc[day] = []; return acc; }, {});

// 30-min preset grid, stored as 24h "HH:MM", displayed 12h. Old records saved via
// <input type=time> may hold off-grid values — TimeSelect injects a fallback option
// so a legacy "09:15" still shows instead of rendering blank.
const pad = (n) => String(n).padStart(2, "0");
const to12h = (h, m) => `${h % 12 === 0 ? 12 : h % 12}:${pad(m)} ${h < 12 ? "AM" : "PM"}`;
const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2), m = (i % 2) * 30;
  return { value: `${pad(h)}:${pad(m)}`, label: to12h(h, m) };
});

const TimeSelect = ({ value, onChange }) => {
  const known = TIME_OPTIONS.some((o) => o.value === value);
  return (
    <Select value={value} onChange={onChange}>
      {!known && value && <option value={value}>{value}</option>}
      {TIME_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </Select>
  );
};

const Availability = () => {
  const [schedule, setSchedule] = useState(DEFAULT_SCHEDULE);
  const [timezone, setTimezone] = useState("Asia/Kolkata");
  const [bufferMinutes, setBufferMinutes] = useState(0);
  const [blockedDates, setBlockedDates] = useState([]); // "YYYY-MM-DD" strings
  const [newBlockedDate, setNewBlockedDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [dirty, setDirty] = useState(false);

  const fetchAvailability = async () => {
    try {
      const { data } = await getAvailability();
      if (data) {
        setSchedule(data.weekly_schedule || DEFAULT_SCHEDULE);
        setTimezone(data.timezone || "Asia/Kolkata");
        setBufferMinutes(data.buffer_minutes || 0);
        setBlockedDates(Array.isArray(data.blocked_dates) ? data.blocked_dates : []);
      }
    } catch { /* no record yet — start with defaults */ }
  };

  useEffect(() => { fetchAvailability(); }, []);

  const addSlot = (day) => {
    setSchedule((s) => ({ ...s, [day]: [...(s[day] || []), { start: "09:00", end: "17:00" }] }));
    setDirty(true);
  };
  const removeSlot = (day, idx) => {
    setSchedule((s) => ({ ...s, [day]: s[day].filter((_, i) => i !== idx) }));
    setDirty(true);
  };
  const updateSlot = (day, idx, field, val) => {
    setSchedule((s) => {
      const updated = [...s[day]];
      updated[idx] = { ...updated[idx], [field]: val };
      return { ...s, [day]: updated };
    });
    setDirty(true);
  };
  // A day is "open" when it has ≥1 slot; toggling on seeds a default 9–5 window,
  // toggling off clears the day (empty slot array = unavailable in the save model).
  const isDayOpen = (day) => (schedule[day]?.length || 0) > 0;
  const toggleDay = (day) => {
    setSchedule((s) => ({ ...s, [day]: s[day]?.length ? [] : [{ start: "09:00", end: "17:00" }] }));
    setDirty(true);
  };
  // "Apply Monday's hours to…" — copy Monday's windows onto a scope of days.
  const applyMondayTo = (scope) => {
    const src = schedule.monday || [];
    if (!src.length) { toast.error("Set Monday's hours first"); return; }
    const targets = scope === "weekdays" ? DAYS.slice(0, 5) : scope === "weekend" ? DAYS.slice(5) : DAYS;
    setSchedule((s) => {
      const next = { ...s };
      targets.forEach((d) => { next[d] = src.map((w) => ({ ...w })); });
      return next;
    });
    toast.success("Applied Monday's hours");
    setDirty(true);
  };

  // Mirror server validation (P1-10): each window needs end > start, no overlaps on
  // a day. HH:MM strings compare lexically, so string comparison is correct.
  const validateSchedule = () => {
    for (const day of DAYS) {
      const windows = schedule[day] || [];
      const ranges = [];
      for (const w of windows) {
        if (!w.start || !w.end) return `Fill in both times on ${day}.`;
        if (w.end <= w.start) return `On ${day}, the end time must be after the start time.`;
        ranges.push([w.start, w.end]);
      }
      ranges.sort((a, b) => (a[0] < b[0] ? -1 : 1));
      for (let i = 1; i < ranges.length; i++) {
        if (ranges[i][0] < ranges[i - 1][1]) return `Overlapping time windows on ${day}.`;
      }
    }
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const scheduleErr = validateSchedule();
    if (scheduleErr) { toast.error(scheduleErr); return; }
    setLoading(true);
    try {
      await saveAvailability({
        weekly_schedule: schedule,
        timezone,
        buffer_minutes: bufferMinutes,
        blocked_dates: blockedDates,
      });
      toast.success("Availability saved!");
      setDirty(false);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save");
    } finally {
      setLoading(false);
    }
  };

  const scrollToSettings = () => {
    document.getElementById("schedule-settings")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const rowMenu = (day, idx) => [
    { label: "Add slot", icon: Plus, onSelect: () => addSlot(day) },
    { label: "Remove slot", icon: Trash2, danger: true, onSelect: () => removeSlot(day, idx) },
    { label: "Mark unavailable", onSelect: () => isDayOpen(day) && toggleDay(day) },
  ];

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-4xl">
      <BackButton hasUnsavedChanges={dirty} />
      <PageHeader title="Set Your Availability" subtitle="Define when guests can book time with you." />

      {/* Weekly schedule */}
      <Card className="mb-5">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Weekly schedule</h2>
            <p className="text-xs text-gray-400">Set the days and times you are available for bookings.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
            <span className="inline-flex items-center gap-1"><Globe className="h-3.5 w-3.5" /> {timezone}</span>
            {bufferMinutes > 0 && <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {bufferMinutes} min buffer</span>}
            <Button type="button" variant="secondary" size="sm" onClick={scrollToSettings}>
              <Settings className="h-3.5 w-3.5" /> Schedule settings
            </Button>
          </div>
        </div>

        {/* Column headers (sm+) */}
        <div className="hidden border-b border-gray-100 pb-2 text-xs font-medium text-gray-400 sm:grid sm:grid-cols-[8rem_9rem_1fr_2.5rem]">
          <span>Day</span><span>Availability</span><span>Time slots</span><span />
        </div>

        <div className="divide-y divide-gray-100">
          {DAYS.map((day) => {
            const open = isDayOpen(day);
            const slots = open ? schedule[day] : [null]; // one row even when closed
            return slots.map((slot, i) => (
              <div
                key={`${day}-${i}`}
                className="grid grid-cols-1 items-center gap-2 py-3 sm:grid-cols-[8rem_9rem_1fr_2.5rem]"
              >
                {/* Day name — only on first row of the day */}
                <span className="font-medium capitalize text-gray-900">{i === 0 ? day : ""}</span>

                {/* Availability toggle — only first row */}
                {i === 0 ? (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={open}
                      aria-label={`${open ? "Close" : "Open"} ${day}`}
                      onClick={() => toggleDay(day)}
                      className={cn(
                        "relative inline-flex h-[22px] min-h-0 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40",
                        open ? "bg-primary" : "bg-gray-200",
                      )}
                    >
                      <span className={cn("inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform", open ? "translate-x-[22px]" : "translate-x-[2px]")} />
                    </button>
                    <span className={cn("text-sm", open ? "text-gray-700" : "text-gray-400")}>{open ? "Available" : "Unavailable"}</span>
                  </div>
                ) : <span className="hidden sm:block" />}

                {/* Time slots */}
                {open ? (
                  <div className="grid items-center gap-2 sm:grid-cols-[1fr_auto_1fr]">
                    <TimeSelect value={slot.start} onChange={(e) => updateSlot(day, i, "start", e.target.value)} />
                    <span className="hidden text-center text-gray-400 sm:block">–</span>
                    <TimeSelect value={slot.end} onChange={(e) => updateSlot(day, i, "end", e.target.value)} />
                  </div>
                ) : <span className="text-sm text-gray-400">Closed</span>}

                {/* Row menu */}
                {open ? (
                  <ContextMenu
                    openOnClick
                    title={`${day} slot`}
                    items={rowMenu(day, i)}
                    trigger={
                      <button type="button" aria-label={`${day} slot options`} className="justify-self-end rounded-lg p-2 text-gray-400 hover:bg-gray-50 hover:text-gray-600">
                        <MoreHorizontal className="h-5 w-5" />
                      </button>
                    }
                  />
                ) : <span />}
              </div>
            ));
          })}
        </div>

        {/* Apply Monday's hours to… */}
        <div className="mt-4 flex justify-end border-t border-gray-100 pt-4">
          <Select
            value=""
            onChange={(e) => { if (e.target.value) applyMondayTo(e.target.value); e.target.value = ""; }}
            className="w-auto"
            aria-label="Apply Monday's hours to a group of days"
          >
            <option value="">Apply Monday's hours to…</option>
            <option value="all">All days</option>
            <option value="weekdays">Weekdays (Mon–Fri)</option>
            <option value="weekend">Weekend (Sat–Sun)</option>
          </Select>
        </div>
      </Card>

      {/* Blocked dates — full days guests can never book */}
      <Card className="mb-5">
        <h2 className="mb-1 text-base font-semibold text-gray-900">Blocked dates</h2>
        <p className="mb-3 text-xs text-gray-400">Holidays, time off — these dates show no slots regardless of your weekly schedule.</p>
        <div className="mb-3 flex gap-2">
          <Input
            type="date"
            className="flex-1"
            min={new Date().toISOString().slice(0, 10)}
            value={newBlockedDate}
            onChange={(e) => setNewBlockedDate(e.target.value)}
          />
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              if (!newBlockedDate) return;
              if (blockedDates.includes(newBlockedDate)) { toast.error("Date already blocked"); return; }
              setBlockedDates([...blockedDates, newBlockedDate].sort());
              setNewBlockedDate("");
              setDirty(true);
            }}
          >
            <Plus className="h-3.5 w-3.5" /> Block date
          </Button>
        </div>
        {blockedDates.length === 0 ? (
          <p className="text-sm text-gray-400">No blocked dates</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {blockedDates.map((d) => (
              <span key={d} className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-xs text-red-700">
                {d}
                <button
                  type="button"
                  onClick={() => { setBlockedDates(blockedDates.filter((x) => x !== d)); setDirty(true); }}
                  className="font-bold text-red-400 hover:text-red-600"
                  aria-label={`Unblock ${d}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </Card>

      {/* Schedule settings — timezone + buffer */}
      <Card id="schedule-settings" className="mb-5">
        <h2 className="mb-1 text-base font-semibold text-gray-900">Schedule settings</h2>
        <p className="mb-4 text-xs text-gray-400">Update your timezone and buffer between bookings.</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Time zone" htmlFor="av-tz" className="mb-0">
            <Select id="av-tz" value={timezone} onChange={(e) => { setTimezone(e.target.value); setDirty(true); }}>
              <option value="Asia/Kolkata">Asia/Kolkata (GMT +05:30)</option>
              <option value="America/New_York">America/New_York (EST)</option>
              <option value="America/Los_Angeles">America/Los_Angeles (PST)</option>
              <option value="Europe/London">Europe/London (GMT)</option>
              <option value="Europe/Berlin">Europe/Berlin (CET)</option>
              <option value="Asia/Dubai">Asia/Dubai (GST)</option>
              <option value="Asia/Singapore">Asia/Singapore (SGT)</option>
            </Select>
          </FormField>
          <FormField label="Buffer between bookings" htmlFor="av-buffer" className="mb-0">
            <Select id="av-buffer" value={bufferMinutes} onChange={(e) => { setBufferMinutes(parseInt(e.target.value)); setDirty(true); }}>
              <option value={0}>No buffer</option>
              <option value={5}>5 minutes</option>
              <option value={10}>10 minutes</option>
              <option value={15}>15 minutes</option>
              <option value={30}>30 minutes</option>
              <option value={60}>1 hour</option>
            </Select>
          </FormField>
        </div>
        <p className="mt-2 text-xs text-gray-400">A buffer is the gap between the end of one booking and the start of the next.</p>
      </Card>

      <StickyActionBar>
        {dirty && <span className="mr-auto text-sm text-gray-500">You have unsaved changes</span>}
        <Button
          type="button"
          variant="secondary"
          disabled={loading}
          onClick={() => { fetchAvailability(); setDirty(false); }}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? "Saving..." : "Save availability"}
        </Button>
      </StickyActionBar>
    </form>
  );
};

export default Availability;

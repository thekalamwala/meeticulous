// useAvailabilityEditor — the availability editor's state, handlers, validation and
// save, shared by the legacy page (Availability.jsx) and the Kept page
// (AvailabilityV2.jsx) so both save exactly the same payload the same way.
// Moved verbatim out of Availability.jsx; the only addition is `status`
// ('loading' | 'ready' | 'error'), which the legacy page ignores.
import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { setAvailability as saveAvailability, getAvailability } from "../../services/api";

export const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

// Time off entries in blocked_dates: a legacy "YYYY-MM-DD" string (whole day) or
// { date, reason?, from?, to? } (server: utils/timeOff). dateOf reads either.
export const dateOf = (e) => (typeof e === "string" ? e.slice(0, 10) : String(e?.date || ""));
const DEFAULT_SCHEDULE = DAYS.reduce((acc, day) => { acc[day] = []; return acc; }, {});

// Mirror server validation (P1-10): each window needs end > start, no overlaps on
// a day. HH:MM strings compare lexically, so string comparison is correct.
export const validateSchedule = (schedule) => {
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

export default function useAvailabilityEditor() {
  const [schedule, setSchedule] = useState(DEFAULT_SCHEDULE);
  const [timezone, setTimezone] = useState("Asia/Kolkata");
  const [bufferMinutes, setBufferMinutes] = useState(0);
  const [blockedDates, setBlockedDates] = useState([]); // "YYYY-MM-DD" strings
  // Booking caps (Pro). "" = no cap; stored as null on save.
  const [caps, setCaps] = useState({ cap_per_day: "", cap_per_week: "", cap_per_guest: "" });
  const [loading, setLoading] = useState(false); // saving
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState("loading");

  const fetchAvailability = useCallback(async () => {
    setStatus("loading");
    try {
      const { data } = await getAvailability();
      if (data) {
        setSchedule(data.weekly_schedule || DEFAULT_SCHEDULE);
        setTimezone(data.timezone || "Asia/Kolkata");
        setBufferMinutes(data.buffer_minutes || 0);
        setBlockedDates(Array.isArray(data.blocked_dates) ? data.blocked_dates : []);
        setCaps({
          cap_per_day: data.cap_per_day ?? "",
          cap_per_week: data.cap_per_week ?? "",
          cap_per_guest: data.cap_per_guest ?? "",
        });
      }
      setStatus("ready");
    } catch {
      // The server answers null (200) when there is no record yet, so a throw is a
      // real failure. The legacy page still opens on defaults; Kept shows an error.
      setStatus("error");
    }
  }, []);

  useEffect(() => { fetchAvailability(); }, [fetchAvailability]);

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

  // Copy one day's windows onto chosen days (Kept day sheet). Local edit only, like applyMondayTo.
  const copyDayTo = (src, targets) => {
    const windows = schedule[src] || [];
    setSchedule((s) => {
      const next = { ...s };
      targets.forEach((d) => { next[d] = windows.map((w) => ({ ...w })); });
      return next;
    });
    setDirty(true);
  };

  const byDate = (a, b) => (dateOf(a) < dateOf(b) ? -1 : dateOf(a) > dateOf(b) ? 1 : 0);
  const blockDate = (date) => {
    if (!date) return false;
    if (blockedDates.some((e) => dateOf(e) === date)) { toast.error("Date already blocked"); return false; }
    setBlockedDates([...blockedDates, date].sort(byDate));
    setDirty(true);
    return true;
  };
  const unblockDate = (date) => { setBlockedDates((list) => list.filter((x) => dateOf(x) !== date)); setDirty(true); };
  // Add or replace the one time-off entry for a date (Kept editor). A whole day
  // with no reason stays a plain date string, so older readers still see it.
  const setTimeOff = ({ date, from, to, reason }) => {
    const note = (reason || "").trim();
    const entry = !from && !to && !note ? date : { date, ...(note && { reason: note }), ...(from && to && { from, to }) };
    setBlockedDates((list) => [...list.filter((x) => dateOf(x) !== date), entry].sort(byDate));
    setDirty(true);
  };

  const save = async () => {
    const scheduleErr = validateSchedule(schedule);
    if (scheduleErr) { toast.error(scheduleErr); return; }
    setLoading(true);
    try {
      await saveAvailability({
        weekly_schedule: schedule,
        timezone,
        buffer_minutes: bufferMinutes,
        blocked_dates: blockedDates,
        // "" → null (no cap). Server re-gates to Pro and ignores a free host's values.
        cap_per_day: caps.cap_per_day === "" ? null : Number(caps.cap_per_day),
        cap_per_week: caps.cap_per_week === "" ? null : Number(caps.cap_per_week),
        cap_per_guest: caps.cap_per_guest === "" ? null : Number(caps.cap_per_guest),
      });
      toast.success("Availability saved!");
      setDirty(false);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => { fetchAvailability(); setDirty(false); };

  return {
    schedule, timezone, setTimezone, bufferMinutes, setBufferMinutes, blockedDates, caps, setCaps,
    loading, dirty, setDirty, status,
    addSlot, removeSlot, updateSlot, isDayOpen, toggleDay, applyMondayTo, copyDayTo, blockDate, unblockDate, setTimeOff,
    save, reset, fetchAvailability,
  };
}

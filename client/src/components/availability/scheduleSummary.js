// Pure helpers that turn a weekly_schedule ({ monday: [{start,end}], … }, 24h
// "HH:MM") into the plain words and the week grid the Kept Schedule page shows.
// Read-only: nothing here changes what is saved.
import { DAYS } from './useAvailabilityEditor';

export const SHORT = { monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu', friday: 'Fri', saturday: 'Sat', sunday: 'Sun' };

export const minutesOf = (t) => {
  const [h, m] = String(t || '').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

// "09:00" → "9 am", "13:30" → "1:30 pm", "00:00" → "12 am".
export const fmtClock = (t) => {
  const mins = minutesOf(t);
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}${m ? `:${String(m).padStart(2, '0')}` : ''} ${h < 12 ? 'am' : 'pm'}`;
};

export const dayMinutes = (windows = []) =>
  windows.reduce((n, w) => n + Math.max(0, minutesOf(w.end) - minutesOf(w.start)), 0);

// 480 → "8 hours", 60 → "1 hour", 450 → "7.5 hours", 30 → "30 minutes".
export const fmtHours = (mins) => {
  if (mins < 60) return `${mins} ${mins === 1 ? 'minute' : 'minutes'}`;
  const h = Math.round((mins / 60) * 10) / 10;
  return `${h} ${h === 1 ? 'hour' : 'hours'}`;
};

export const openDays = (schedule) => DAYS.filter((d) => (schedule?.[d]?.length || 0) > 0);

// ['monday','tuesday','wednesday','friday'] → "Mon–Wed and Fri". All seven → "every day".
export const daysLabel = (days) => {
  if (days.length === 7) return 'every day';
  const idx = days.map((d) => DAYS.indexOf(d)).sort((a, b) => a - b);
  const runs = [];
  idx.forEach((i) => {
    const last = runs[runs.length - 1];
    if (last && i === last[1] + 1) last[1] = i; else runs.push([i, i]);
  });
  const parts = runs.flatMap(([a, b]) => {
    if (a === b) return [SHORT[DAYS[a]]];
    if (b === a + 1) return [SHORT[DAYS[a]], SHORT[DAYS[b]]];
    return [`${SHORT[DAYS[a]]}–${SHORT[DAYS[b]]}`];
  });
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts[0] || '';
};

// A day's windows for a list row: "10 am – 1 pm, 3 pm – 6 pm".
export const windowsLabel = (windows = []) => windows.map((w) => `${fmtClock(w.start)} – ${fmtClock(w.end)}`).join(', ');

// The same single window on every open day → "10 am – 6 pm"; otherwise null.
export const sharedHours = (schedule) => {
  const days = openDays(schedule);
  if (!days.length) return null;
  const sig = (d) => schedule[d].map((w) => `${w.start}-${w.end}`).join(',');
  const first = sig(days[0]);
  if (schedule[days[0]].length !== 1 || !days.every((d) => sig(d) === first)) return null;
  const w = schedule[days[0]][0];
  return `${fmtClock(w.start)} – ${fmtClock(w.end)}`;
};

export const weekSummary = (schedule) => {
  const days = openDays(schedule);
  const minutes = days.reduce((n, d) => n + dayMinutes(schedule[d]), 0);
  return { days, minutes, label: daysLabel(days), shared: sharedHours(schedule) };
};

// The week grid: 30-minute rows from the earliest opening hour to the latest
// closing hour across the week (9 am – 6 pm when nothing is open yet). A cell is
// open when a window covers its whole half hour.
export const STEP = 30;
export const weekGrid = (schedule) => {
  const all = DAYS.flatMap((d) => schedule?.[d] || []).filter((w) => minutesOf(w.end) > minutesOf(w.start));
  let from = 9 * 60;
  let to = 18 * 60;
  if (all.length) {
    from = Math.floor(Math.min(...all.map((w) => minutesOf(w.start))) / 60) * 60;
    to = Math.ceil(Math.max(...all.map((w) => minutesOf(w.end))) / 60) * 60;
  }
  const rows = [];
  for (let t = from; t < to; t += STEP) rows.push(t);
  const open = DAYS.reduce((acc, d) => {
    const ws = schedule?.[d] || [];
    acc[d] = rows.map((t) => ws.some((w) => minutesOf(w.start) <= t && minutesOf(w.end) >= t + STEP));
    return acc;
  }, {});
  return { rows, open };
};

// A month for the days-off calendar, Monday first like the week grid: leading
// nulls pad the first week, then one "YYYY-MM-DD" per day. month is 0-based.
export const monthCells = (year, month) => {
  const lead = (new Date(year, month, 1).getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  const p = (n) => String(n).padStart(2, '0');
  return [
    ...Array(lead).fill(null),
    ...Array.from({ length: days }, (_, i) => `${year}-${p(month + 1)}-${p(i + 1)}`),
  ];
};

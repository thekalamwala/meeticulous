/**
 * timeOff.js — a host's time off, stored in availability.blocked_dates (JSONB).
 *
 * An entry is either the legacy plain date string (a whole day off) or an object:
 *   { date: "YYYY-MM-DD", reason?: string, from?: "HH:MM", to?: "HH:MM" }
 * No from/to = the whole day. from+to = only that part of the day (host wall
 * clock, the availability row's timezone). No migration: the column is JSONB and
 * old string entries keep working everywhere.
 *
 * `reason` is PRIVATE to the host (founder call, 2026-11-26). Every public payload
 * that ships the availability row must pass it through publicAvailability().
 */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const MAX_ENTRIES = 500;
const MAX_REASON = 120;

const toMin = (t) => { const [h, m] = String(t).split(':').map(Number); return h * 60 + m; };

// Any stored entry → { date, from, to, reason } (from/to null = whole day).
const normalizeTimeOff = (entry) => {
  if (typeof entry === 'string') return { date: entry.slice(0, 10), from: null, to: null, reason: '' };
  if (!entry || typeof entry !== 'object') return null;
  return {
    date: String(entry.date || '').slice(0, 10),
    from: entry.from || null,
    to: entry.to || null,
    reason: typeof entry.reason === 'string' ? entry.reason : '',
  };
};

const entriesOn = (list, dateStr) =>
  (Array.isArray(list) ? list : []).map(normalizeTimeOff).filter((e) => e && e.date === dateStr);

// The whole day is off (legacy strings and objects without from/to).
const isFullDayOff = (list, dateStr) => entriesOn(list, dateStr).some((e) => !e.from || !e.to);

// Part-day blocks on a date, as wall-clock { from, to } "HH:MM" pairs.
const partDayOff = (list, dateStr) =>
  entriesOn(list, dateStr).filter((e) => e.from && e.to).map(({ from, to }) => ({ from, to }));

/**
 * Validate + sanitize a blocked_dates payload from the host editor.
 * @returns {{ value: Array }} | {{ error: string }}
 * Plain date strings pass through; objects keep only date/reason/from/to, with the
 * reason trimmed, stripped of control characters and capped.
 */
const sanitizeTimeOff = (list) => {
  if (list == null) return { value: list };
  if (!Array.isArray(list)) return { error: 'blocked_dates must be a list of dates.' };
  if (list.length > MAX_ENTRIES) return { error: `You can save at most ${MAX_ENTRIES} days off.` };
  const value = [];
  for (const raw of list) {
    if (typeof raw === 'string') {
      if (!DATE_RE.test(raw)) return { error: `"${raw.slice(0, 20)}" is not a date (use YYYY-MM-DD).` };
      value.push(raw);
      continue;
    }
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { error: 'Invalid day off.' };
    const date = String(raw.date || '');
    if (!DATE_RE.test(date)) return { error: 'Each day off needs a date (YYYY-MM-DD).' };
    const hasFrom = raw.from != null && raw.from !== '';
    const hasTo = raw.to != null && raw.to !== '';
    if (hasFrom !== hasTo) return { error: `Time off on ${date} needs both a start and an end time.` };
    const out = { date };
    if (hasFrom) {
      if (!TIME_RE.test(String(raw.from)) || !TIME_RE.test(String(raw.to)))
        return { error: `Use HH:MM 24-hour times for time off on ${date}.` };
      if (toMin(raw.to) <= toMin(raw.from)) return { error: `On ${date}, time off must end after it starts.` };
      out.from = String(raw.from);
      out.to = String(raw.to);
    }
    if (raw.reason != null) {
      if (typeof raw.reason !== 'string') return { error: 'A reason must be text.' };
      // eslint-disable-next-line no-control-regex
      const reason = raw.reason.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, MAX_REASON);
      if (reason) out.reason = reason;
    }
    value.push(out);
  }
  return { value };
};

// What guests may see: whole days off as plain date strings (so the booking
// calendar can grey them out). Reasons and part-day blocks never leave the
// server; part-day blocks are enforced by computeSlots / validateSlot.
const publicAvailability = (row) => {
  if (!row || typeof row !== 'object') return row;
  const list = Array.isArray(row.blocked_dates) ? row.blocked_dates : [];
  const days = [...new Set(list.map(normalizeTimeOff).filter((e) => e && (!e.from || !e.to) && DATE_RE.test(e.date)).map((e) => e.date))];
  return { ...row, blocked_dates: days };
};

module.exports = { normalizeTimeOff, isFullDayOff, partDayOff, sanitizeTimeOff, publicAvailability, MAX_REASON };

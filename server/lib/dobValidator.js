'use strict';
/**
 * dobValidator.js — pure date-of-birth validation for birthday greetings (v3.138).
 *
 * Accepts a `YYYY-MM-DD` string; rejects junk, impossible dates (2026-02-30), future
 * dates, and absurd ages. An empty/null value is allowed and means "clear my DOB".
 *
 * @returns {{ ok:true, value:string|null }} | {{ ok:false, error:string }}
 */
const MIN_AGE = 13;
const MAX_AGE = 120;

function parseDob(input, now = Date.now()) {
  if (input === null || input === undefined || String(input).trim() === '') {
    return { ok: true, value: null }; // clearing is fine
  }
  const s = String(input).trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return { ok: false, error: 'Use the date format YYYY-MM-DD.' };

  const d = new Date(`${s}T00:00:00Z`);
  // round-trip guard: rejects 2026-02-30 / 2026-13-01 (JS would roll these over).
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s) {
    return { ok: false, error: 'That isn’t a real date.' };
  }

  const ageMs = now - d.getTime();
  if (ageMs < 0) return { ok: false, error: 'Date of birth can’t be in the future.' };
  const years = ageMs / (365.25 * 864e5);
  if (years < MIN_AGE) return { ok: false, error: `You must be at least ${MIN_AGE} years old.` };
  if (years > MAX_AGE) return { ok: false, error: 'Please enter a valid date of birth.' };

  return { ok: true, value: s };
}

module.exports = { parseDob, MIN_AGE, MAX_AGE };

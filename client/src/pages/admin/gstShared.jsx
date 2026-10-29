// gstShared.jsx — shared bits for the /admin/gst pages: INR/number formatting,
// the IST-aware period picker, and a CSV blob download helper. Mirrors the local
// `inr` convention used by the other admin finance pages (no shared money util).
import React from 'react';

export const inr = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(n) || 0);

export const num = (n) => new Intl.NumberFormat('en-IN').format(Number(n) || 0);

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Current Indian fiscal year start (IST), Apr–Mar.
function currentFy() {
  const d = new Date(Date.now() + 330 * 60000); // shift into IST wall clock
  const m = d.getUTCMonth() + 1;
  const y = d.getUTCFullYear();
  const fyStart = m >= 4 ? y : y - 1;
  return { fyStart, fy2: String(fyStart % 100).padStart(2, '0'), calMonth: m };
}

export function defaultPeriod() {
  const { fy2, calMonth } = currentFy();
  return { mode: 'month', fy: fy2, month: calMonth, quarter: Math.floor(((calMonth + 8) % 12) / 3) + 1 };
}

// Turn the picker value into API query params.
export function periodParams(v) {
  const p = { fy: v.fy };
  if (v.mode === 'month') p.month = v.month;
  if (v.mode === 'quarter') p.quarter = v.quarter;
  return p;
}

const fyLabel = (fy2) => `FY 20${fy2}-${String((Number(fy2) + 1) % 100).padStart(2, '0')}`;

/**
 * PeriodFilter — FY + Month/Quarter/Year selector. `value` is
 * { mode, fy, month, quarter }; `onChange` gets the next value.
 */
export function PeriodFilter({ value, onChange }) {
  const { fyStart } = currentFy();
  const fyOptions = [0, 1, 2].map((back) => {
    const s = fyStart - back;
    return { fy2: String(s % 100).padStart(2, '0'), label: fyLabel(String(s % 100).padStart(2, '0')) };
  });
  const set = (patch) => onChange({ ...value, ...patch });

  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1 text-[11px] uppercase tracking-wide adm-t3">
        Financial year
        <select className="fb-input text-sm" value={value.fy} onChange={(e) => set({ fy: e.target.value })}>
          {fyOptions.map((o) => <option key={o.fy2} value={o.fy2}>{o.label}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-[11px] uppercase tracking-wide adm-t3">
        Period
        <select className="fb-input text-sm" value={value.mode} onChange={(e) => set({ mode: e.target.value })}>
          <option value="month">Month</option>
          <option value="quarter">Quarter</option>
          <option value="annual">Full year</option>
        </select>
      </label>
      {value.mode === 'month' && (
        <label className="flex flex-col gap-1 text-[11px] uppercase tracking-wide adm-t3">
          Month
          <select className="fb-input text-sm" value={value.month} onChange={(e) => set({ month: Number(e.target.value) })}>
            {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
        </label>
      )}
      {value.mode === 'quarter' && (
        <label className="flex flex-col gap-1 text-[11px] uppercase tracking-wide adm-t3">
          Quarter
          <select className="fb-input text-sm" value={value.quarter} onChange={(e) => set({ quarter: Number(e.target.value) })}>
            <option value={1}>Q1 (Apr–Jun)</option>
            <option value={2}>Q2 (Jul–Sep)</option>
            <option value={3}>Q3 (Oct–Dec)</option>
            <option value={4}>Q4 (Jan–Mar)</option>
          </select>
        </label>
      )}
    </div>
  );
}

// Trigger a browser download from an axios blob response.
export function downloadBlob(res, filename) {
  const url = URL.createObjectURL(new Blob([res.data]));
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

// Friendly label for the invoice source stream.
export const SOURCE_LABEL = { booking: 'Booking fee', subscription: 'Subscription', commission: 'Commission' };

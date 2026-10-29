// client/src/components/admin/seo/seoShared.jsx
// Shared score visuals + formatters for the SEO control center. Colours come from the
// admin tokens (--adm-ok / --adm-warn / --adm-danger); bands are consistent everywhere.
import Ic from '../Ic';
import { IC } from '../adminNav';

export const scoreTone = (n) => (n == null ? 'neutral' : n >= 80 ? 'ok' : n >= 55 ? 'warn' : 'danger');
const TONE_VAR = { ok: 'var(--adm-ok)', warn: 'var(--adm-warn)', danger: 'var(--adm-danger)', neutral: 'var(--adm-t3, #9ca3af)' };
export const toneColor = (tone) => TONE_VAR[tone] || TONE_VAR.neutral;

export const fmtNum = (n) => (n == null ? '—' : n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n));
export const fmtPct = (n) => (n == null ? '—' : `${(n * 100).toFixed(1)}%`);
export const fmtPos = (n) => (n == null ? '—' : n.toFixed(1));
export const EVIDENCE_LABEL = { official: 'Official', proxy: 'Proxy signal', industry: 'Industry evidence', heuristic: 'Heuristic' };

// Compact score chip for dense tables — coloured tint + number, instantly scannable.
export function ScoreChip({ value, capped }) {
  if (value == null) return <span className="adm-t3 text-[13px]">—</span>;
  const c = toneColor(scoreTone(value));
  return (
    <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[12.5px] font-semibold tabular-nums"
      style={{ color: c, background: `color-mix(in srgb, ${c} 12%, transparent)` }}
      title={capped ? 'Score capped by a hard issue' : undefined}>
      {value}{capped ? <span aria-hidden style={{ opacity: 0.7 }}>▾</span> : null}
    </span>
  );
}

// Larger ring for the drawer header.
export function ScoreDonut({ value, label, size = 60 }) {
  const c = toneColor(scoreTone(value));
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value ?? 0)) / 100;
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={5} className="adm-t3" style={{ opacity: 0.18 }} />
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={c} strokeWidth={5} strokeLinecap="round"
            strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)} />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-[15px] font-bold tabular-nums" style={{ color: c }}>{value ?? '—'}</span>
      </div>
      {label && <span className="text-[11px] font-semibold adm-t3 uppercase tracking-wide">{label}</span>}
    </div>
  );
}

// A horizontal bar for a single dimension's sub-score (drawer breakdown).
export function ScoreBar({ value }) {
  const c = toneColor(scoreTone(value));
  return (
    <span className="inline-block h-1.5 rounded-full w-16 align-middle" style={{ background: `color-mix(in srgb, ${c} 18%, transparent)` }}>
      <span className="block h-full rounded-full" style={{ width: `${Math.max(4, value)}%`, background: c }} />
    </span>
  );
}

// Delta indicator. goodUp: is a positive change good? (clicks yes; position change is
// pre-signed so positive already = improved).
export function Delta({ value, goodUp = true, suffix = '' }) {
  if (value == null || value === 0) return <span className="adm-t3 text-[11px]">—</span>;
  const up = value > 0;
  const good = goodUp ? up : !up;
  const c = good ? 'var(--adm-ok)' : 'var(--adm-danger)';
  return (
    <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold tabular-nums" style={{ color: c }}>
      <Ic d={up ? IC.trendUp : IC.trendDn} size={11} />{Math.abs(value)}{suffix}
    </span>
  );
}

export function SectionTitle({ icon, children, right }) {
  return (
    <div className="flex items-center justify-between mb-2 mt-5 first:mt-0">
      <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider adm-t3">
        {icon && <Ic d={IC[icon]} size={13} />}{children}
      </div>
      {right}
    </div>
  );
}

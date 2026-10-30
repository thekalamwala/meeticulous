// Small Cold Calling building blocks on the admin tokens (adm-*), so they follow
// the admin light/dark theme. Shapes follow the Cold Calling mockups
// (https://claude.ai/artifact/TZ4MH6vEMDvs6Zg5Zr2Joh). dashboard/ui's Tabs /
// SegmentedControl are host-side (fixed gray palette) and don't theme in admin.
import Ic from '../../../components/admin/Ic';
import { IC } from '../../../components/admin/adminNav';

export const HEADING = { fontFamily: "'Plus Jakarta Sans',Poppins,sans-serif" };

/** options: [{ value, label, count? }] */
export function Chips({ options, value, onChange, label }) {
  return (
    <div role="tablist" aria-label={label} className="inline-flex flex-wrap gap-0.5 p-1 rounded-xl adm-chip">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button key={o.value} type="button" role="tab" aria-selected={on} onClick={() => onChange(o.value)}
            className={`!min-h-0 px-3 py-1.5 rounded-lg text-[12.5px] font-semibold transition-colors ${on ? 'adm-card adm-t1 shadow-sm' : 'adm-t3 hover:adm-t1'}`}>
            {o.label}{o.count != null && <span className="ml-1 adm-t3 font-medium">{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** tabs: [{ value, label }] */
export function TabBar({ tabs, value, onChange }) {
  return (
    <div role="tablist" className="flex flex-wrap gap-5 border-b adm-border">
      {tabs.map((t) => {
        const on = t.value === value;
        return (
          <button key={t.value} type="button" role="tab" aria-selected={on} onClick={() => onChange(t.value)}
            className={`!min-h-0 -mb-px py-2 text-[13px] font-semibold border-b-2 transition-colors ${on ? 'border-[#960D32] text-[#960D32]' : 'border-transparent adm-t3 hover:adm-t1'}`}>
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

export function SectionTitle({ children, right }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-3">
      <h2 className="text-[15px] font-bold adm-t1" style={HEADING}>{children}</h2>
      {right}
    </div>
  );
}

// KPI card from the mockups: soft orange icon tile, big value, label, optional delta.
export function Kpi({ icon, value, label, sub, delta, tone = 'orange' }) {
  const tile = {
    orange: 'bg-[#960D32]/10 text-[#960D32]', red: 'bg-red-500/10 text-red-600', green: 'bg-emerald-500/10 text-emerald-600',
    blue: 'bg-blue-500/10 text-blue-600', gray: 'adm-chip adm-t2', amber: 'bg-amber-500/10 text-amber-600',
  }[tone];
  return (
    <div className="adm-card rounded-2xl px-4 py-3.5 flex items-center gap-3 min-w-0">
      <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${tile}`}><Ic d={IC[icon] || IC.grid} size={18} /></span>
      <div className="min-w-0">
        <div className="text-[22px] leading-6 font-extrabold adm-t1" style={HEADING}>{value}</div>
        <div className="text-[12.5px] adm-t2 truncate">{label}</div>
        {(delta || sub) && <div className="text-[11px] mt-0.5 truncate">{delta && <span className={delta.startsWith('↓') ? 'text-red-600 font-semibold' : 'text-emerald-600 font-semibold'}>{delta} </span>}<span className="adm-t3">{sub}</span></div>}
      </div>
    </div>
  );
}

// The "Today 12 / 60 · Connected · Interested · Signed up" strip from the mockups.
export function TodayStrip({ today, totals, compact = false }) {
  if (!today) return null;
  const rate = today.calls ? Math.round((today.connected / today.calls) * 100) : 0;
  const cells = [
    ['Today', <>{today.calls} <span className="adm-t3 font-medium">/ {today.target}</span></>],
    ['Connected', <>{today.connected}{today.calls ? <span className="adm-t3 font-medium"> ({rate}%)</span> : null}</>],
    ['Interested', today.interested],
    ['Signed up', totals?.signedUp ?? 0],
  ];
  return (
    <div className={`flex items-center gap-4 rounded-xl border adm-border ${compact ? 'px-3 py-1.5' : 'px-4 py-2'}`}>
      {cells.map(([l, v]) => (
        <div key={l} className="leading-tight"><div className="text-[11px] adm-t3">{l}</div><div className="text-[14px] font-bold adm-t1" style={HEADING}>{v}</div></div>
      ))}
    </div>
  );
}

export function Bar({ value, color = '#960D32' }) {
  return <div className="h-2 rounded-full adm-chip overflow-hidden"><div className="h-2 rounded-full" style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }} /></div>;
}

export const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
export const delta = (now, before) => {
  if (now == null || before == null || (!now && !before)) return null;
  if (!before) return `↑ ${now}`;
  const d = Math.round(((now - before) / before) * 100);
  return `${d >= 0 ? '↑' : '↓'} ${Math.abs(d)}%`;
};

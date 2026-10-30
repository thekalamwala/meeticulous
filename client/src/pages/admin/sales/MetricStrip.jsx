import { rupees, SMART_VIEWS } from './salesConstants';

// Merged stat + filter bar. Each smart-view chip doubles as a metric (label +
// live count) AND the filter — one row replaces the old metric-card grid + the
// separate pill row. Conv. rate and pipeline value ride along on the right as
// read-only readouts (no filter).
export default function MetricStrip({ stats, active, onPick, loading }) {
  const s = stats || {};

  // Live count per smart-view key (null = no meaningful count, e.g. "Has value").
  const countFor = (key) => {
    switch (key) {
      case 'all': return s.total ?? 0;
      case 'new': return s.byStatus?.new ?? 0;
      case 'needs_followup': return s.followUpsDueToday ?? 0;
      case 'overdue': return s.followUpsOverdue ?? 0;
      case 'contacted': return s.byStatus?.contacted ?? 0;
      case 'qualified': return s.byStatus?.qualified ?? 0;
      case 'won': return s.paidCustomers ?? s.byStatus?.paid ?? 0;
      default: return null;
    }
  };
  const toneFor = (key, n) => {
    if (key === 'overdue' && n > 0) return 'text-red-500';
    if (key === 'needs_followup' && n > 0) return 'text-amber-600';
    if (key === 'won') return 'text-emerald-600';
    return 'adm-t1';
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5 mb-3">
      {SMART_VIEWS.map((v) => {
        const isActive = active === v.key;
        const n = countFor(v.key);
        return (
          <button key={v.key} type="button" onClick={() => onPick(v.key)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[12px] transition
              ${isActive ? 'bg-[#960D32] text-white border-[#960D32]' : 'adm-card border-gray-200 hover:border-[#960D32]/60'}`}>
            <span className={isActive ? 'font-semibold' : 'adm-t2'}>{v.label}</span>
            {n != null && (
              <span className={`text-[11px] font-bold tabular-nums ${isActive ? 'text-white' : toneFor(v.key, n)}`}>
                {loading ? '·' : n}
              </span>
            )}
          </button>
        );
      })}

      {/* Read-only readouts */}
      <div className="ml-auto flex items-center gap-4 pl-3 border-l border-gray-200">
        <Readout label="Conv." value={loading ? '·' : `${s.conversionRate ?? 0}%`} />
        <Readout label="Pipeline" value={loading ? '·' : rupees(s.pipelineValuePaise)} />
      </div>
    </div>
  );
}

function Readout({ label, value }) {
  return (
    <span className="inline-flex items-baseline gap-1.5 text-[12px] whitespace-nowrap">
      <span className="adm-t3 uppercase tracking-wide text-[10px] font-semibold">{label}</span>
      <span className="font-bold adm-t1 tabular-nums">{value}</span>
    </span>
  );
}

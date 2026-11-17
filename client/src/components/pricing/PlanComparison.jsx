import { Fragment } from 'react';
import { Check, Info } from 'lucide-react';
import { PLAN_COLUMNS, PLAN_MATRIX } from '../../data/plans';

// ponytail: the public Pricing page (pages/Pricing.jsx) has its own near-identical
// matrix renderer with intl/USD/fee-only variants. This is the plain INR Free-vs-Pro
// table for the in-dashboard upgrade page — kept separate to avoid touching (and
// risking) the untested public page. Unify behind this component if that changes.

const Cell = ({ value }) => {
  if (value === true) return <Check size={16} className="mx-auto text-primary" aria-label="Included" />;
  if (value === false) return <span className="text-ink/25" aria-label="Not included">—</span>;
  if (value && typeof value === 'object' && value.tip) {
    return (
      <span
        title={value.tip}
        className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/5 px-2.5 py-0.5 text-xs font-semibold text-primary"
      >
        {value.v || 'Limited'}
        <Info size={11} aria-hidden="true" />
      </span>
    );
  }
  return <span className="text-sm text-ink/70">{value}</span>;
};

/** Free vs Pro feature matrix for the dashboard upgrade page. */
export default function PlanComparison({ columns = PLAN_COLUMNS, matrix = PLAN_MATRIX }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] border-collapse text-left">
        <thead>
          <tr className="border-b border-maroon/15">
            <th className="py-2.5 pl-3 pr-4 text-sm font-semibold text-ink/50">Compare plans</th>
            {columns.map((c) => (
              <th key={c.key} className="px-3 py-2.5 text-center text-sm font-bold text-ink">
                {c.name}
                {c.recommended && (
                  <span className="ml-1.5 align-middle text-[10px] font-bold uppercase tracking-wide text-primary">★</span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.map((section) => (
            <Fragment key={section.group}>
              <tr className="bg-blush/40">
                <td colSpan={columns.length + 1} className="px-3 py-2 text-xs font-bold uppercase tracking-wide text-primary">
                  {section.group}
                </td>
              </tr>
              {section.rows.map((row) => (
                <tr key={`${section.group}-${row.label}`} className="border-b border-maroon/10">
                  <td className="py-2.5 pl-3 pr-4 text-sm text-ink/70">{row.label}</td>
                  {columns.map((c) => (
                    <td key={c.key} className="px-3 py-2.5 text-center"><Cell value={row[c.key]} /></td>
                  ))}
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// client/src/components/admin/ui/StatCard.jsx
import { Link } from 'react-router-dom';
import Ic from '../Ic';
import { IC } from '../adminNav';

// Only wrap in a Link when there is somewhere to go. Previously this fell back to
// `to="#"`, so cards with no destination still rendered as links — pointer cursor,
// hover lift, and a click that just dirtied the URL with a bare '#'.
const Shell = ({ to, className, children }) => (to
  ? <Link to={to} className={`${className} hover:shadow-sm group block`}>{children}</Link>
  : <div className={className}>{children}</div>
);

/**
 * @param compact  Small heading above an icon+value on one line. For metadata
 *                 rows (plan, renewal, counts) where the full card's 36px icon
 *                 tile and text-2xl value cost more height than they earn.
 */
const StatCard = ({ label, value, sub, icon, iconColor, change, to, compact = false }) => {
  if (compact) {
    return (
      <Shell to={to} className="adm-card rounded-xl px-3.5 py-2.5 transition-all">
        <p className="text-[10px] font-semibold adm-t3 uppercase tracking-wide mb-1">{label}</p>
        <div className="flex items-center gap-2">
          {icon && (
            <span className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 ${iconColor || 'bg-gray-400'}`}>
              <Ic d={IC[icon]} size={13} className="text-white" />
            </span>
          )}
          <span className="text-[15px] font-bold adm-t1 tracking-tight truncate">{value}</span>
          {change !== undefined && (
            <span className={`adm-badge ${change >= 0 ? 'adm-badge-ok' : 'adm-badge-danger'} ml-auto`}>
              <Ic d={change >= 0 ? IC.trendUp : IC.trendDn} size={10} />
              {Math.abs(change)}%
            </span>
          )}
        </div>
        {sub && <p className="text-[10px] adm-t3 mt-0.5 truncate">{sub}</p>}
      </Shell>
    );
  }
  return (
    <Shell to={to} className="adm-card rounded-2xl p-5 transition-all">
      <p className="text-[11px] font-medium adm-t3 uppercase tracking-wide mb-3">{label}</p>
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${iconColor || 'bg-gray-400'}`}>
          <Ic d={IC[icon]} size={16} className="text-white" />
        </div>
        <p className="text-2xl font-bold adm-t1 tracking-tight">{value}</p>
        {change !== undefined && (
          <span className={`adm-badge ml-auto ${change >= 0 ? 'adm-badge-ok' : 'adm-badge-danger'}`}>
            <Ic d={change >= 0 ? IC.trendUp : IC.trendDn} size={10} />
            {Math.abs(change)}%
          </span>
        )}
      </div>
      {sub && <p className="text-[11px] adm-t3 mt-2">{sub}</p>}
    </Shell>
  );
};
export default StatCard;

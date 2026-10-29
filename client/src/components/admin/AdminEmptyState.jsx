// Shared empty state for admin stub pages
const Ic = ({ d, size = 24, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className={`flex-shrink-0 ${className}`}>
    {(Array.isArray(d) ? d : [d]).map((p, i) => <path key={i} d={p} />)}
  </svg>
);

const IC = {
  zap:      'M13 2L3 14h9l-1 8 10-12h-9l1-8z',
  plus:     ['M12 5v14','M5 12h14'],
  lock:     ['M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z','M8 11V7a4 4 0 118 0v4'],
  arrow:    'M5 12h14m-7-7l7 7-7 7',
};

const AdminEmptyState = ({
  icon,
  iconBg    = 'bg-[var(--adm-hover)]',
  iconColor = 'adm-t3',
  title,
  description,
  ctaLabel,
  ctaHref,
  ctaOnClick,
  badge,         // e.g. "Coming Soon"
  badgeColor = 'bg-gray-800 text-gray-400',
  children,
}) => (
  <div className="adm-card rounded-2xl">
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      {badge && (
        <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full mb-5 ${badgeColor}`}>
          <Ic d={IC.lock} size={10} />
          {badge}
        </span>
      )}
      <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-5 ${iconBg}`}>
        {icon && <Ic d={icon} size={26} className={iconColor} />}
      </div>
      <h2 className="text-base font-bold adm-t1 mb-2">{title}</h2>
      <p className="text-sm adm-t3 max-w-md leading-relaxed mb-6">{description}</p>
      {children}
      {ctaLabel && (ctaHref ? (
        <a href={ctaHref}
          className="btn inline-flex items-center gap-2 px-5 py-2.5 bg-[#0079C1] text-white text-sm font-semibold hover:bg-[#005E99] transition-colors shadow-sm">
          <Ic d={IC.plus} size={14} />
          {ctaLabel}
        </a>
      ) : (
        <button onClick={ctaOnClick}
          className="btn inline-flex items-center gap-2 px-5 py-2.5 bg-[#0079C1] text-white text-sm font-semibold hover:bg-[#005E99] transition-colors shadow-sm">
          <Ic d={IC.plus} size={14} />
          {ctaLabel}
        </button>
      ))}
    </div>
  </div>
);

export default AdminEmptyState;

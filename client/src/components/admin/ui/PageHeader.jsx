// client/src/components/admin/ui/PageHeader.jsx
// Standard admin page header — kills per-page title drift (text-xl vs text-2xl).
const PageHeader = ({ title, subtitle, actions }) => (
  <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
    <div className="min-w-0">
      <h1 className="text-[22px] leading-7 font-bold adm-t1 tracking-tight">{title}</h1>
      {subtitle && <p className="text-[13px] adm-t3 mt-1">{subtitle}</p>}
    </div>
    {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
  </div>
);
export default PageHeader;

import { useParams, Link } from 'react-router-dom';
import LeadPanel from './LeadPanel';

// Deep-link / full-page view. The same LeadPanel also renders inside the
// right-side drawer on the Leads list.
export default function SalesLeadDetail() {
  const { id } = useParams();
  return (
    <div className="p-4 sm:p-6 max-w-4xl">
      <Link to="/admin/sales/leads" className="text-[12px] text-[#2E1065] font-semibold">← All leads</Link>
      <div className="mt-3"><LeadPanel leadId={id} /></div>
    </div>
  );
}

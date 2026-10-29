import AdminEmptyState from '../../components/admin/AdminEmptyState';
import { PageHeader } from '../../components/admin/ui';
const ICON = ['M12 22a10 10 0 100-20 10 10 0 000 20z','M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3','M12 17h.01'];
const AdminFAQ = () => (
  <div>
    <PageHeader title="FAQ" subtitle="Frequently asked questions management" />
    <AdminEmptyState icon={ICON} iconBg="bg-cyan-50" iconColor="text-cyan-600"
      title="FAQ Manager" description="Create and organise FAQs that appear on your platform's help pages. Group by category, drag to reorder, publish/unpublish." ctaLabel="Add FAQ" ctaOnClick={() => {}} />
  </div>
);
export default AdminFAQ;

import AdminEmptyState from '../../components/admin/AdminEmptyState';
import { PageHeader } from '../../components/admin/ui';
const ICON = ['M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z','M22 6l-10 7L2 6'];
const AdminNewsletter = () => (
  <div>
    <PageHeader title="Newsletter" subtitle="Broadcast emails to your subscriber list" />
    <AdminEmptyState icon={ICON} iconBg="bg-orange-50" iconColor="text-orange-500"
      title="Newsletter" description="Compose and send newsletters to all subscribers. Build campaigns, manage subscriber lists, and track open rates." ctaLabel="Compose Newsletter" ctaOnClick={() => {}} />
  </div>
);
export default AdminNewsletter;

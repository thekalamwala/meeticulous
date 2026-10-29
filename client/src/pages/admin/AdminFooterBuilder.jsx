import AdminEmptyState from '../../components/admin/AdminEmptyState';
import { PageHeader } from '../../components/admin/ui';
const ICON = ['M3 3h7v7H3z','M14 3h7v7h-7z','M14 14h7v7h-7z','M3 14h7v7H3z'];
const AdminFooterBuilder = () => (
  <div>
    <PageHeader title="Footer Builder" subtitle="Manage footer columns and links" />
    <AdminEmptyState icon={ICON} iconBg="bg-gray-100" iconColor="text-gray-500"
      title="Footer Builder" description="Configure footer columns, social links, legal pages, and copyright text. Supports multi-column layouts and custom HTML blocks." />
  </div>
);
export default AdminFooterBuilder;

import AdminEmptyState from '../../components/admin/AdminEmptyState';
import { PageHeader } from '../../components/admin/ui';
const ICON = ['M4 6h16','M4 12h8','M4 18h16'];
const AdminMenuBuilder = () => (
  <div>
    <PageHeader title="Menu Builder" subtitle="Configure navigation menus" />
    <AdminEmptyState icon={ICON} iconBg="bg-indigo-50" iconColor="text-indigo-600"
      title="Menu Builder" description="Drag-and-drop builder for the site's header and footer navigation. Add links, dropdowns, and custom labels without writing code." />
  </div>
);
export default AdminMenuBuilder;

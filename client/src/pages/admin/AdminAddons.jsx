import AdminEmptyState from '../../components/admin/AdminEmptyState';
import { PageHeader } from '../../components/admin/ui';
const ICON = ['M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z','M3.27 6.96L12 12.01l8.73-5.05','M12 22.08V12'];
const AdminAddons = () => (
  <div>
    <PageHeader title="Addons" subtitle="Platform add-on features and integrations" />
    <AdminEmptyState icon={ICON} iconBg="bg-pink-50" iconColor="text-pink-500"
      title="Addons" description="Manage optional platform add-ons that providers can purchase or enable — extra booking slots, custom branding, priority listing, and more." />
  </div>
);
export default AdminAddons;

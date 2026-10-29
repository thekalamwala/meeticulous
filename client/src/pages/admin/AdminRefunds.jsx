import AdminEmptyState from '../../components/admin/AdminEmptyState';
import { PageHeader } from '../../components/admin/ui';
const ICON = ['M1 4v6h6','M23 20v-6h-6','M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15'];
const AdminRefunds = () => (
  <div>
    <PageHeader title="Refunds" subtitle="Manage and process refund requests" />
    <AdminEmptyState icon={ICON} iconBg="bg-red-50" iconColor="text-red-500"
      title="Refund Management" description="Cancelled bookings with refund requests will appear here. Approve or reject refunds and track Razorpay refund statuses." />
  </div>
);
export default AdminRefunds;

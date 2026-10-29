import AdminEmptyState from '../../components/admin/AdminEmptyState';
import { PageHeader } from '../../components/admin/ui';
const ICON = ['M12 1v22','M17 5H9.5a3.5 3.5 0 100 7h5a3.5 3.5 0 110 7H6'];
const AdminTransactions = () => (
  <div>
    <PageHeader title="Transactions" subtitle="Full platform transaction ledger" />
    <AdminEmptyState icon={ICON} iconBg="bg-emerald-50" iconColor="text-emerald-600"
      title="Transaction Ledger" description="Every payment, refund, and platform fee will be recorded here in a searchable, filterable table. Connect Razorpay webhooks to auto-populate." />
  </div>
);
export default AdminTransactions;

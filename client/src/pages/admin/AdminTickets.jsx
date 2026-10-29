import AdminEmptyState from '../../components/admin/AdminEmptyState';
import { PageHeader } from '../../components/admin/ui';
const ICON = 'M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v10z';
const AdminTickets = () => (
  <div>
    <PageHeader title="Support Tickets" subtitle="Respond to user support requests" />
    <AdminEmptyState icon={ICON} iconBg="bg-teal-50" iconColor="text-teal-600"
      title="Support Tickets" description="User-submitted support tickets will appear here. Assign, respond, escalate, and close tickets. Integrate with email for thread-based replies." />
  </div>
);
export default AdminTickets;

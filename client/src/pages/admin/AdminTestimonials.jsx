import AdminEmptyState from '../../components/admin/AdminEmptyState';
import { PageHeader } from '../../components/admin/ui';
const ICON = 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z';
const AdminTestimonials = () => (
  <div>
    <PageHeader title="Testimonials" subtitle="Curate social proof for the homepage" />
    <AdminEmptyState icon={ICON} iconBg="bg-yellow-50" iconColor="text-yellow-500"
      title="Testimonials" description="Manually add or pull top reviews to showcase on your homepage and marketing pages. Approve, feature, or remove testimonials." ctaLabel="Add Testimonial" ctaOnClick={() => {}} />
  </div>
);
export default AdminTestimonials;

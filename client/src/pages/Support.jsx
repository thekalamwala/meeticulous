import { Link } from 'react-router-dom';
import useDocumentMeta from '../hooks/useDocumentMeta';
import Seo from '../components/common/Seo';
import { ogCard } from '../config/ogImages';
import { SITE_URL } from '../utils/seo';

/**
 * /support — placeholder landing for the AiSensy support link. Intentionally
 * blank: just "Coming soon" so the deep-link resolves to a real page instead of
 * falling through to the /:profileSlug catch-all ("Creator not found").
 */
const Support = () => {
  useDocumentMeta({ title: 'Support | Meeticulous' });
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-6">
      <Seo
        title="Support — Meeticulous"
        description="Contact Meeticulous support for help with bookings, payments, rescheduling, and becoming a host. We're here to help."
        image={ogCard('support')}
        canonical={`${SITE_URL}/support`}
      />
      <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary mb-3">Support</p>
      <h1 className="text-4xl sm:text-5xl font-bold text-ink mb-5">Coming soon</h1>
      <Link to="/" className="text-primary hover:underline text-sm">Go home</Link>
    </div>
  );
};

export default Support;

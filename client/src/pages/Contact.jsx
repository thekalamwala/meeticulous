import { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import useDocumentMeta from '../hooks/useDocumentMeta';
import Seo from '../components/common/Seo';
import { ogCard } from '../config/ogImages';
import { SITE_URL, contactPageJsonLd } from '../utils/seo';
import { sendContactMessage } from '../services/api';

/**
 * /contact (+ /get-in-touch) — public contact form. Submissions email the
 * support inbox via POST /api/contact. Also the target of the WhatsApp
 * "Get in touch" deep-link.
 */
const Contact = () => {
  useDocumentMeta({ title: 'Contact | Meeticulous' });

  const [form, setForm] = useState({ name: '', email: '', phone: '', subject: '', message: '' });
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await sendContactMessage(form);
      setSent(true);
      toast.success(data?.message || "Thanks — we'll be in touch soon.");
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not send your message. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container flex min-h-[calc(100vh-72px)] items-center justify-center py-8 sm:py-12">
      <Seo
        title="Contact Meeticulous — Talk to Our Team"
        description="Get in touch with Meeticulous. Reach our support and sales teams for help with bookings, hosting, payments, and partnerships."
        image={ogCard('contact')}
        canonical={`${SITE_URL}/contact`}
        jsonLd={contactPageJsonLd({})}
      />
      <div className="page-card w-full max-w-lg p-5 sm:p-8">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary mb-2">Contact</p>
        <h1 className="text-2xl sm:text-3xl font-bold text-ink mb-2">Get in touch</h1>
        <p className="mb-6 text-sm text-gray-500">
          Questions about bookings, hosting, payments, or partnerships? Send us a
          message and we'll get back to you.
        </p>

        {sent ? (
          <div className="text-center py-6">
            <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-bold mb-2">Message sent</h2>
            <p className="text-sm text-gray-500 mb-6">
              Thanks for reaching out — we'll reply to <strong>{form.email}</strong> soon.
            </p>
            <Link to="/" className="text-primary hover:underline text-sm">Go home</Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Name</label>
              <input type="text" required maxLength={120} className="fb-input"
                value={form.name} onChange={set('name')} placeholder="Your name" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input type="email" required className="fb-input"
                  value={form.email} onChange={set('email')} placeholder="you@example.com" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Phone <span className="text-gray-400">(optional)</span></label>
                <input type="tel" className="fb-input"
                  value={form.phone} onChange={set('phone')} placeholder="+91 98765 43210" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Subject</label>
              <input type="text" required maxLength={200} className="fb-input"
                value={form.subject} onChange={set('subject')} placeholder="How can we help?" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Message</label>
              <textarea required rows={5} maxLength={5000} className="fb-input resize-y"
                value={form.message} onChange={set('message')} placeholder="Tell us more…" />
            </div>
            <button type="submit" disabled={loading}
              className="btn w-full bg-primary text-white py-2.5 text-sm font-medium hover:bg-primary-dark disabled:opacity-50">
              {loading ? 'Sending…' : 'Send message'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default Contact;

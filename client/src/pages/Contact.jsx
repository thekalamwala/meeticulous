import { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Mail, MessageCircle, LifeBuoy, Building2, ArrowUpRight, Send, Check } from 'lucide-react';
import useDocumentMeta from '../hooks/useDocumentMeta';
import Seo from '../components/common/Seo';
import OperatorCredit from '../components/common/OperatorCredit';
import { ogCard } from '../config/ogImages';
import { SITE_URL, contactPageJsonLd, ORG_ADDRESS } from '../utils/seo';
import { sendContactMessage } from '../services/api';

/**
 * /contact (+ /get-in-touch) — public contact page. Submissions email the
 * support inbox via POST /api/contact. Also the target of the WhatsApp
 * "Get in touch" deep-link.
 *
 * Layout (lg+): split — heading + ways to reach us on the left, the form in a
 * soft card on the right; sized to fit one screen under the navbar. White page
 * background, crimson as the single accent (matches the About page).
 */

const EMAIL = 'team@meeticulous.com';
// Same WhatsApp number as the footer's WhatsApp link.
const WHATSAPP = 'https://wa.me/15559708785?text=Hi%2C%20I%20want%20to%20talk%20about%20Meeticulous';

// Tokenised form field (soft-modern: white surface, low-alpha border, 6px radius,
// crimson focus ring).
const inputCls =
  'w-full rounded-[6px] border border-black/10 bg-white px-3.5 py-2.5 text-sm text-ink ' +
  'placeholder:text-ink/40 outline-none transition-colors ' +
  'focus:border-primary focus:ring-2 focus:ring-primary/20';
const labelCls = 'mb-1.5 block text-sm font-medium text-ink';

// One-line office address for the map + its caption.
const OFFICE_ADDRESS = [
  ORG_ADDRESS.streetAddress,
  ORG_ADDRESS.addressLocality,
  `${ORG_ADDRESS.addressRegion} ${ORG_ADDRESS.postalCode}`,
  'India',
].join(', ');

const CHANNELS = [
  { Icon: Mail, label: 'Email us', value: EMAIL, href: `mailto:${EMAIL}` },
  { Icon: MessageCircle, label: 'Chat on WhatsApp', value: 'Message us on WhatsApp', href: WHATSAPP, external: true },
  { Icon: LifeBuoy, label: 'Help Center', value: 'Guides and answers to common questions', to: '/help' },
];

function Channel({ c }) {
  const inner = (
    <>
      <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[6px] bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-white">
        <c.Icon size={20} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-ink">{c.label}</span>
        <span className="mt-0.5 block truncate text-sm text-ink/60">{c.value}</span>
      </span>
      <ArrowUpRight size={18} className="flex-shrink-0 text-ink/30 transition-colors group-hover:text-primary" aria-hidden="true" />
    </>
  );
  const cls =
    'group flex items-center gap-4 rounded-[6px] border border-black/5 bg-white px-4 py-3.5 ' +
    'shadow-[0_8px_30px_rgba(26,26,26,0.04)] transition-[border-color,box-shadow] hover:border-primary/30 ' +
    'hover:no-underline hover:shadow-[0_24px_60px_-28px_rgba(26,26,26,0.25)]';
  if (c.to) return <Link to={c.to} className={cls}>{inner}</Link>;
  return (
    <a href={c.href} className={cls} {...(c.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
      {inner}
    </a>
  );
}

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
    <main className="bg-white">
      <div className="px-5 py-14 sm:px-8 lg:flex lg:min-h-[calc(100svh-57px)] lg:items-center lg:py-10">
      <Seo
        title="Contact Meeticulous — Talk to Our Team"
        description="Get in touch with Meeticulous. Reach our support and sales teams for help with bookings, hosting, payments, and partnerships."
        image={ogCard('contact')}
        canonical={`${SITE_URL}/contact`}
        jsonLd={contactPageJsonLd({})}
      />

      <div className="mx-auto grid w-full max-w-6xl items-center gap-12 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
        {/* Left: heading + ways to reach us */}
        <div>
          <h1 className="font-heading text-4xl font-extrabold leading-[1.08] text-ink sm:text-5xl">
            Let’s <span className="text-primary-cta">talk.</span>
          </h1>
          <p className="mt-5 max-w-md text-lg leading-relaxed text-ink/70">
            Questions about bookings, hosting, payments or partnerships? Send us a message, or reach us the way
            that suits you.
          </p>

          <div className="mt-8 grid gap-3">
            {CHANNELS.map((c) => (
              <Channel key={c.label} c={c} />
            ))}
          </div>

          <p className="mt-6 flex items-start gap-2.5 text-sm leading-relaxed text-ink/55">
            <Building2 size={16} className="mt-0.5 flex-shrink-0 text-ink/40" aria-hidden="true" />
            <OperatorCredit />
          </p>
        </div>

        {/* Right: the form */}
        <div className="rounded-[10px] border border-black/5 bg-white p-6 shadow-[0_24px_60px_-28px_rgba(26,26,26,0.25)] sm:p-8">
          {sent ? (
            <div className="py-10 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Check size={28} strokeWidth={2.5} aria-hidden="true" />
              </div>
              <h2 className="mb-2 font-heading text-2xl font-bold text-ink">Message sent</h2>
              <p className="mb-6 text-sm text-ink/60">
                Thanks for reaching out — we’ll reply to <strong className="text-ink">{form.email}</strong> soon.
              </p>
              <Link to="/" className="text-sm font-semibold text-primary-cta hover:underline">
                Back to home
              </Link>
            </div>
          ) : (
            <>
              <h2 className="font-heading text-2xl font-bold text-ink">Send us a message</h2>
              <p className="mt-1 text-sm text-ink/60">We read every message and reply by email.</p>

              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="contact-name" className={labelCls}>Name</label>
                    <input id="contact-name" type="text" required maxLength={120} className={inputCls}
                      value={form.name} onChange={set('name')} placeholder="Your name" autoComplete="name" />
                  </div>
                  <div>
                    <label htmlFor="contact-email" className={labelCls}>Email</label>
                    <input id="contact-email" type="email" required className={inputCls}
                      value={form.email} onChange={set('email')} placeholder="you@example.com" autoComplete="email" />
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="contact-phone" className={labelCls}>
                      Phone <span className="font-normal text-ink/50">(optional)</span>
                    </label>
                    <input id="contact-phone" type="tel" className={inputCls}
                      value={form.phone} onChange={set('phone')} placeholder="+91 98765 43210" autoComplete="tel" />
                  </div>
                  <div>
                    <label htmlFor="contact-subject" className={labelCls}>Subject</label>
                    <input id="contact-subject" type="text" required maxLength={200} className={inputCls}
                      value={form.subject} onChange={set('subject')} placeholder="How can we help?" />
                  </div>
                </div>
                <div>
                  <label htmlFor="contact-message" className={labelCls}>Message</label>
                  <textarea id="contact-message" required rows={5} maxLength={5000} className={`${inputCls} resize-y`}
                    value={form.message} onChange={set('message')} placeholder="Tell us more…" />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-[6px] bg-primary-cta py-3 text-sm font-semibold text-white shadow-[0_12px_30px_-12px_rgba(150,13,50,0.55)] transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {loading ? 'Sending…' : 'Send message'}
                  {!loading && <Send size={16} aria-hidden="true" />}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
      </div>

      {/* Office map — the registered office from ORG_ADDRESS (same address as the
          legal pages + Organization JSON-LD). Keyless Google Maps embed. */}
      <section className="px-5 pb-20 sm:px-8 lg:pb-28">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center font-heading text-3xl font-bold text-ink sm:text-4xl">Find us</h2>
          <p className="mt-4 text-center text-lg leading-relaxed text-ink/70">
            {OFFICE_ADDRESS}
          </p>
          <div className="mt-8 overflow-hidden rounded-[10px] border border-black/5 bg-sand shadow-[0_8px_30px_rgba(26,26,26,0.04)]">
            <iframe
              title={`Map: ${OFFICE_ADDRESS}`}
              src={`https://www.google.com/maps?q=${encodeURIComponent(OFFICE_ADDRESS)}&output=embed`}
              className="block h-[320px] w-full border-0 sm:h-[420px]"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
            />
          </div>
          <p className="mt-4 text-center">
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(OFFICE_ADDRESS)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary-cta hover:no-underline hover:opacity-90"
            >
              Open in Google Maps <ArrowUpRight size={16} aria-hidden="true" />
            </a>
          </p>
        </div>
      </section>
    </main>
  );
};

export default Contact;

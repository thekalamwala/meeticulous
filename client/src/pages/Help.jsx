import { useState } from "react";
import { Link } from "react-router-dom";
import { MessageCircle, MessageSquare, Phone, Mail, Sparkles, Copy, Check } from "lucide-react";
import Seo from "../components/common/Seo";
import { ogCard } from "../config/ogImages";
import { SITE_URL, faqJsonLd } from "../utils/seo";

/**
 * /help — Help Center. FAQ + support channels.
 * Placeholder copy + support number; refine before launch (FAQ can later be
 * wired to the admin FAQ at /admin/content/faq, and the WhatsApp number pulled
 * from admin settings). See gap list.
 */

// TODO: move to admin-configurable support settings.
const SUPPORT_WHATSAPP = "15559708785"; // support WhatsApp (number hidden; link only)
const SUPPORT_WHATSAPP_MSG = "Namaste, I want to talk about Meeticulous";
const SUPPORT_EMAIL = "bolt@meeticulous.in";
const SUPPORT_PHONE = "+917904109359";

const FAQ = [
  {
    q: "How do I book an appointment?",
    a: "Open a host's profile, pick a service and an available slot, then confirm. You'll verify with an OTP or your account and (for paid services) pay securely via Razorpay.",
  },
  {
    q: "How do I reschedule or cancel?",
    a: "Open the booking from My Bookings and use Reschedule or Cancel. Some hosts may charge a reschedule fee, shown before you confirm.",
  },
  {
    q: "I didn't get my confirmation email.",
    a: "Check spam, and confirm the email address you booked with. Confirmations are transactional and always sent. Still missing? Contact support below.",
  },
  {
    q: "How do payments and refunds work?",
    a: "Payments are processed by Razorpay. Refunds, when applicable, follow the host's policy and are returned to your original payment method.",
  },
  {
    q: "How do I become a host?",
    a: "Head to Be a Sloth to start onboarding — set up your profile, services and availability, then go live.",
  },
];

const ChannelCard = ({ icon: Icon, title, desc, action, onClick, disabled, badge }) => {
  const body = (
    <div className={`relative bg-white border rounded-2xl p-5 h-full transition-shadow ${disabled ? "opacity-60" : "hover:shadow-md"}`}>
      {badge && (
        <span className="absolute top-3 right-3 text-[10px] font-semibold uppercase tracking-wide text-gray-400 bg-gray-50 border rounded-full px-2 py-0.5">
          {badge}
        </span>
      )}
      <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-[#960D32]/10 text-[#960D32] mb-3">
        <Icon size={20} />
      </span>
      <p className="font-semibold text-gray-900">{title}</p>
      <p className="text-sm text-gray-500 mt-1">{desc}</p>
    </div>
  );
  if (!disabled && onClick) {
    return <button type="button" onClick={onClick} className="block w-full text-left hover:no-underline">{body}</button>;
  }
  if (disabled || !action) return body;
  // mailto:/tel: must open in the same context — target="_blank" leaves a dead blank tab.
  const newTab = /^https?:/i.test(action);
  return (
    <a
      href={action}
      {...(newTab ? { target: "_blank", rel: "noreferrer" } : {})}
      className="block hover:no-underline"
    >
      {body}
    </a>
  );
};

/**
 * Email support card. A bare mailto: strands users with no default mail app on a
 * blank page, so the card body is inert: the address is selectable, a Copy button
 * always works, and "Open mail app" is an explicit secondary action.
 */
const EmailSupportCard = ({ email }) => {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(email);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked — the address is still selectable above */
    }
  };
  return (
    <div className="relative bg-white border rounded-2xl p-5 h-full">
      <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-[#960D32]/10 text-[#960D32] mb-3">
        <Mail size={20} />
      </span>
      <p className="font-semibold text-gray-900">Email support</p>
      <p className="text-sm text-gray-500 mt-1 break-all select-all">{email}</p>
      <div className="flex flex-wrap gap-2 mt-3">
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#960D32] border border-[#960D32]/30 rounded-lg px-2.5 py-1 hover:bg-[#960D32]/5"
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
          {copied ? "Copied!" : "Copy"}
        </button>
        <a
          href={`mailto:${email}`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 border rounded-lg px-2.5 py-1 hover:bg-gray-50 hover:no-underline"
        >
          Open mail app
        </a>
      </div>
    </div>
  );
};

const Help = () => (
  <div className="min-h-screen" style={{ background: "#F8FAFC" }}>
    <Seo
      title="Help & Support — Meeticulous"
      description="Get help with bookings, rescheduling, payments, and becoming a host on Meeticulous. Answers to common questions plus WhatsApp, email, and phone support."
      image={ogCard('help')}
      canonical={`${SITE_URL}/help`}
      jsonLd={faqJsonLd({ faqs: FAQ })}
    />
    <div className="app-container py-8 sm:py-12 max-w-3xl">
      <h1 className="text-2xl sm:text-3xl font-bold mb-2">Help & Support</h1>
      <p className="text-sm text-gray-500 mb-8">
        Find quick answers, or reach us directly — we're happy to help.
      </p>

      {/* Support channels */}
      <div className="grid sm:grid-cols-2 gap-4 mb-10">
        <ChannelCard
          icon={Sparkles}
          title="Chat with Bolt"
          desc="Our assistant answers most questions instantly — tap to start."
          onClick={() => window.dispatchEvent(new Event('bolt:open'))}
        />
        <ChannelCard
          icon={MessageCircle}
          title="WhatsApp us"
          desc="Message our support team directly on WhatsApp."
          action={`https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(SUPPORT_WHATSAPP_MSG)}`}
        />
        <EmailSupportCard email={SUPPORT_EMAIL} />
        <ChannelCard
          icon={Phone}
          title="Call us"
          desc={SUPPORT_PHONE}
          action={`tel:${SUPPORT_PHONE}`}
        />
      </div>

      {/* FAQ */}
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-lg font-bold">Frequently asked questions</h2>
        <Link to="/help/docs" className="text-sm font-semibold text-[#960D32] hover:underline whitespace-nowrap">
          All help articles →
        </Link>
      </div>
      <div className="space-y-3">
        {FAQ.map(({ q, a }) => (
          <div key={q} className="bg-white border rounded-2xl p-5">
            <h3 className="text-base font-semibold mb-1.5 flex items-start gap-2">
              <MessageSquare size={16} className="text-[#960D32] mt-0.5 flex-shrink-0" /> {q}
            </h3>
            <p className="text-sm text-gray-600 leading-relaxed pl-6">{a}</p>
          </div>
        ))}
      </div>

      <div className="text-center mt-8 space-x-4">
        <Link to="/help/docs" className="text-[#960D32] hover:underline text-sm">Browse all help articles</Link>
        <Link to="/" className="text-[#960D32] hover:underline text-sm">Go home</Link>
      </div>
    </div>
  </div>
);

export default Help;

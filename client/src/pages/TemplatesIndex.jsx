import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import Seo from "../components/common/Seo";
import { SITE_URL, collectionPageJsonLd, breadcrumbJsonLd } from "../utils/seo";

/**
 * /templates — hub for the copy-paste message and policy templates that live as
 * blog posts. Groups them by the job the reader is doing (confirm, remind, get
 * paid, reschedule…) so each template post is one click from a crawlable index.
 * No URLs move: every card links to its existing /blog/:slug.
 * CollectionPage + BreadcrumbList JSON-LD, like /tools.
 */

const CANONICAL = `${SITE_URL}/templates`;

const GROUPS = [
  {
    title: "Confirm and remind",
    items: [
      { slug: "appointment-confirmation-message", title: "Appointment confirmation messages", desc: "WhatsApp, SMS and email confirmations with the payment receipt line." },
      { slug: "appointment-reminder-templates", title: "Appointment reminder templates", desc: "30+ WhatsApp reminders for clinics, salons, tutors and coaches, in English and Hindi." },
      { slug: "whatsapp-business-away-message", title: "WhatsApp Business away messages", desc: "After-hours, holiday and busy replies that still take bookings." },
    ],
  },
  {
    title: "Reschedule, cancel and set policies",
    items: [
      { slug: "appointment-cancellation-reschedule-message", title: "Cancellation and reschedule messages", desc: "For when you cancel, and for when your client does." },
      { slug: "cancellation-policy-template", title: "Cancellation and no-show policy templates", desc: "Copy-ready policies with ₹ examples for clinics, coaches, tutors and salons." },
    ],
  },
  {
    title: "Get paid",
    items: [
      { slug: "payment-reminder-message", title: "Payment reminder messages", desc: "A polite-to-firm sequence for WhatsApp and email." },
      { slug: "payment-reminder-message-hindi", title: "Payment reminder messages in Hindi", desc: "Devanagari and Hinglish versions you can paste into WhatsApp." },
      { slug: "tuition-fee-reminder-message", title: "Tuition fee reminder messages", desc: "Monthly fee reminders for tutors and coaching classes." },
      { slug: "how-to-ask-client-for-payment-politely", title: "How to ask a client for payment politely", desc: "Email, WhatsApp and call scripts for overdue invoices." },
    ],
  },
  {
    title: "Before the session",
    items: [
      { slug: "client-intake-form-questions", title: "Client intake form questions", desc: "Question banks for coaches, therapists and consultants." },
      { slug: "please-share-anything-that-will-help-prepare-for-our-meeting", title: "What to write in a booking form's notes field", desc: "Example answers for the 'please share anything that will help prepare' box." },
    ],
  },
  {
    title: "Interviews and meetings",
    items: [
      { slug: "interview-calling-message", title: "Interview calling messages", desc: "Invitation templates for email, SMS and WhatsApp." },
      { slug: "how-to-acknowledge-interview-email", title: "How to acknowledge an interview email", desc: "Replies to accept, decline or ask for details." },
      { slug: "interview-schedule-template", title: "Interview schedule template", desc: "A simple format for planning interview days." },
      { slug: "meeting-invitation-templates", title: "Meeting invitation templates", desc: "Office, society and school invitations, including Hindi." },
    ],
  },
];

const ALL = GROUPS.flatMap((g) => g.items);

const TemplatesIndex = () => (
  <div className="min-h-dvh bg-canvas text-ink">
    <Seo
      title="Free Message & Policy Templates for Businesses — Meeticulous"
      description="Copy-paste WhatsApp, SMS and email templates for Indian service businesses: confirmations, reminders, payment follow-ups, cancellations and policies."
      canonical={CANONICAL}
      jsonLd={[
        collectionPageJsonLd({
          name: "Message & policy templates",
          description: "Free WhatsApp, SMS and email templates for Indian professionals and small service businesses.",
          url: CANONICAL,
          items: ALL.map((t) => ({ url: `/blog/${t.slug}`, name: t.title })),
        }),
        breadcrumbJsonLd({ items: [{ name: "Home", path: "/" }, { name: "Templates", path: "/templates" }] }),
      ]}
    />

    <main className="mx-auto max-w-4xl px-5 py-14 sm:px-8">
      <h1 className="font-heading text-3xl font-extrabold leading-tight sm:text-4xl">Free message &amp; policy templates</h1>
      <p className="mt-3 max-w-2xl text-neutral-600">
        Copy-paste messages for the parts of running a practice that eat your day: confirming,
        reminding, rescheduling and getting paid. Written for WhatsApp first, with SMS, email and
        Hindi versions where they help.
      </p>

      {GROUPS.map((g) => (
        <section key={g.title} className="mt-10">
          <h2 className="font-heading text-xl font-bold">{g.title}</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {g.items.map((t) => (
              <Link
                key={t.slug}
                to={`/blog/${t.slug}`}
                className="group rounded-[6px] border border-black/5 bg-white p-5 shadow-[0_8px_30px_rgba(26,26,26,0.04)] transition-colors hover:border-primary/30 hover:no-underline"
              >
                <h3 className="font-heading text-base font-bold text-ink">{t.title}</h3>
                <p className="mt-1.5 text-sm text-neutral-600">{t.desc}</p>
                <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary-cta">
                  Open template <ArrowRight size={14} className="transition group-hover:translate-x-0.5" />
                </span>
              </Link>
            ))}
          </div>
        </section>
      ))}

      <p className="mt-12 text-sm text-neutral-500">
        Tired of sending these by hand? A <Link to="/features/booking-pages" className="text-primary-cta hover:underline">booking page</Link> sends
        confirmations and <Link to="/features/notifications" className="text-primary-cta hover:underline">WhatsApp reminders</Link> for
        you, and takes payment before the session.
      </p>
    </main>
  </div>
);

export default TemplatesIndex;

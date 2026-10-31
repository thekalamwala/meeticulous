import { ArrowUpRight, CreditCard, Landmark, Link2, Mail, Receipt } from "lucide-react";
import ToolLogo from "../../pages/for/toolLogos";
import razorpayLogo from "../../pages/enterprise-v2/assets/logo/razorpay.png";
import Reveal from "./Reveal";

/* "Connected" band — two auto-scrolling rows of the tools Meeticulous really
   works with (no logo-wall padding): Razorpay checkout (UPI, cards, netbanking;
   Google Pay / PhonePe are UPI apps paid through it), GST invoices, Google
   sign-in + Calendar + Meet, WhatsApp and email reminders, the booking link.
   Uses the shared .sloth-marquee CSS (static under prefers-reduced-motion);
   the card pauses both rows together on hover. */

const Img = ({ src }) => <img src={src} alt="" width={26} height={26} loading="lazy" className="h-[26px] w-[26px] object-contain" />;
const Ico = ({ icon: Icon }) => <Icon size={22} className="text-primary" />;
const Upi = () => (
  <span className="flex h-[26px] items-center rounded-[4px] bg-ink px-1.5 text-[11px] font-extrabold italic tracking-tight text-white">UPI</span>
);

const ROW_PAYMENTS = [
  { name: "Razorpay", mark: <Img src={razorpayLogo} /> },
  { name: "UPI", mark: <Upi /> },
  { name: "Google Pay", mark: <ToolLogo name="google-pay" size={38} /> },
  { name: "PhonePe", mark: <Img src="/images/logos/phonepe.svg" /> },
  { name: "Cards", mark: <Ico icon={CreditCard} /> },
  { name: "Netbanking", mark: <Ico icon={Landmark} /> },
  { name: "GST invoices", mark: <Ico icon={Receipt} /> },
];

const ROW_CONNECT = [
  { name: "Google Calendar", mark: <ToolLogo name="google-calendar" size={26} /> },
  { name: "Google Meet", mark: <ToolLogo name="google-meet" size={28} /> },
  { name: "WhatsApp", mark: <ToolLogo name="whatsapp-icon" size={26} /> },
  { name: "Email", mark: <Ico icon={Mail} /> },
  { name: "Google sign-in", mark: <ToolLogo name="google-icon" size={24} /> },
  { name: "Your booking link", mark: <Ico icon={Link2} /> },
];

const Pill = ({ item }) => (
  <li className="flex h-12 min-w-[11rem] flex-shrink-0 items-center gap-3 whitespace-nowrap rounded-[10px] border border-black/5 bg-white px-4 pr-5 shadow-[0_8px_30px_rgba(26,26,26,0.06)]">
    <span className="flex h-8 w-10 flex-shrink-0 items-center justify-center">{item.mark}</span>
    <span className="text-sm font-semibold text-ink">{item.name}</span>
  </li>
);

/* One infinite row: the list is rendered twice and the track slides by 50%. */
const Row = ({ items, dir, seconds }) => (
  <div className="sloth-marquee-wrap sloth-edge-fade overflow-hidden">
    <ul className={`sloth-marquee sloth-marquee--${dir}`} style={{ animationDuration: `${seconds}s` }}>
      {[...items, ...items].map((it, i) => (
        <Pill key={`${it.name}-${i}`} item={it} />
      ))}
    </ul>
  </div>
);

export default function IntegrationsMarquee({ onStart, loading }) {
  return (
    // Soft teal card that sits in the page's light, soft-SaaS rhythm: a faint
    // brand-teal tint + low-alpha teal border (tokens only — tailwind.config
    // `teal` #00C9C6, `teal-ink` #0E7C7A), ink headline with the accent words
    // in teal-ink, and the CTA left in the page's crimson. Hovering anywhere on
    // the card pauses BOTH rows (not just the one under the cursor).
    <div className="mx-auto max-w-7xl overflow-hidden rounded-[10px] border border-teal/30 bg-teal/[0.08] px-5 py-9 shadow-[0_8px_30px_rgba(26,26,26,0.04)] sm:px-10 lg:px-14 lg:py-11 [&:hover_.sloth-marquee]:[animation-play-state:paused]">
      <Reveal as="h2" className="max-w-3xl text-3xl font-extrabold leading-tight text-ink sm:text-4xl">
        Plugged into the tools <span className="text-teal-ink">your clients already use.</span>
      </Reveal>
      <Reveal as="p" delay={0.06} className="mt-3 max-w-2xl text-sm leading-relaxed text-neutral-600 sm:text-base">
        Payments, calendars, video calls and reminders stay connected around one smooth booking — from your link to a paid,
        confirmed session.
      </Reveal>

      {/* Lists are decorative repeats for screen readers; the real names are in this sr-only list */}
      <ul className="sr-only">
        {[...ROW_PAYMENTS, ...ROW_CONNECT].map((it) => (
          <li key={it.name}>{it.name}</li>
        ))}
      </ul>
      <div aria-hidden className="-mx-5 mt-7 space-y-3 sm:-mx-10 lg:-mx-14">
        <Row items={ROW_PAYMENTS} dir="left" seconds={42} />
        <Row items={ROW_CONNECT} dir="right" seconds={38} />
      </div>

      <Reveal delay={0.08} className="mt-7">
        <div className="flex flex-col gap-6 rounded-[10px] border border-black/5 bg-white px-5 py-4 shadow-[0_8px_30px_rgba(26,26,26,0.04)] sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[6px] bg-teal/15 text-teal-ink">
              <Link2 size={20} />
            </span>
            <div>
              <h3 className="font-heading text-base font-bold text-ink sm:text-lg">Share your booking page anywhere.</h3>
              <p className="mt-1 text-sm leading-relaxed text-neutral-600">
                Your Instagram bio, WhatsApp status, email signature or website — clients book and pay from wherever they find you.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onStart}
            disabled={loading}
            className="inline-flex flex-shrink-0 items-center justify-center gap-2 rounded-[6px] bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Opening Google…" : "Create your free booking page"} <ArrowUpRight size={16} />
          </button>
        </div>
      </Reveal>
    </div>
  );
}

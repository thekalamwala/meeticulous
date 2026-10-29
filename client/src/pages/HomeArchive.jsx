import { Link } from "react-router-dom";
import { useState, useRef, useEffect } from "react";
import useFeeOnly from "../hooks/useFeeOnly";
import {
  motion,
  useScroll,
  useTransform,
  useInView,
  AnimatePresence,
  useReducedMotion,
} from "framer-motion";
import {
  Search,
  CalendarCheck,
  Wallet,
  Wind,
  CreditCard,
  Mail,
  Globe,
  Users,
  IndianRupee,
  Sparkles,
  ArrowRight,
  Star,
  Check,
  MessageCircle,
  ArrowUpRight,
  Link2,
  ShieldCheck,
  Code2,
  Palette,
  BellRing,
  BarChart3,
  Calendar,
  Webcam,
  Cpu,
  Target,
  HeartPulse,
  GraduationCap,
  Briefcase,
  Plus,
  TrendingUp,
  Smile,
  Clock,
  FolderKanban,
  Zap,
  Lock,
  Download,
  FileCheck,
  Eye,
  CalendarX2,
} from "lucide-react";
import { searchVendors, subscribeNewsletter } from "../services/api";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";
import useLenis from "../hooks/useLenis";
import { HostAvatar } from "../components/common/HostAvatar";
import Reveal from "../components/home/Reveal";
import HowItWorks from "../components/home/HowItWorks";
import BrandPreloader from "../components/preloader/BrandPreloader";
import { HERO, HERO_FACES, PERSONAS, NEWSLETTER } from "../components/home/images";
import { TESTIMONIALS } from "../data/testimonials";
import PricingCards from "../components/pricing/PricingCards";
import Seo from "../components/common/Seo";
import { ogCard } from "../config/ogImages";

/* Real funnel routes — do not point CTAs anywhere else. */
const ROUTE_START = "/be-a-sloth";
const ROUTE_LOGIN = "/login-as-vendor";

/* Directory badges — "Trusted & featured on" strip below the hero. Images are the
   directories' own hosted badges (external). */
/* `dark:true` = the badge art is light-on-transparent (needs a dark chip); the
   rest are dark-on-light (light chip). Uniform chip size keeps the row tidy. */
const FEATURED_ON = [
  { href: "https://www.producthunt.com/products/book-a-sloth-2?embed=true&utm_source=badge-featured&utm_medium=badge&utm_campaign=badge-book-a-sloth-2", src: "https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1227352&theme=light&t=1787277679258", alt: "Meeticulous on Product Hunt" },
  { href: "https://findly.tools/book-a-sloth-1?utm_source=book-a-sloth-1", src: "https://findly.tools/badges/findly-tools-badge-light.svg", alt: "Featured on Findly.tools" },
  { href: "https://saasgrow.app?ref=meeticulous.com", src: "https://saasgrow.app/api/badge?type=top&style=light", alt: "Meeticulous on SaaSGrow" },
  { href: "https://startuptrusted.com?ref=meeticulous.com", src: "https://startuptrusted.com/api/badge?type=top&style=light", alt: "Meeticulous on StartupTrusted" },
  { href: "https://twelve.tools", src: "https://twelve.tools/badge3-white.svg", alt: "Featured on Twelve Tools", dark: true },
];

/* ── Homepage SEO ──────────────────────────────────────────────────────────
   OG/Twitter image + Organization logo must be uploaded to these exact URLs
   on company-assets.meeticulous.in (1200×630 for OG). */
const SITE_URL = "https://meeticulous.com";
const OG_IMAGE = ogCard('home');
const ORG_LOGO = "https://company-assets.meeticulous.in/images/brand/logo.png";

const HOME_JSONLD = [
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Meeticulous",
    applicationCategory: "BusinessApplication",
    applicationSubCategory: "Appointment Scheduling Software",
    operatingSystem: "Web",
    url: SITE_URL,
    description:
      "Meeticulous gives India's creators and professionals one booking link — clients book, pay over UPI, and the money lands in their account.",
    offers: { "@type": "Offer", price: "0", priceCurrency: "INR" },
  },
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Meeticulous",
    url: SITE_URL,
    logo: ORG_LOGO,
    description:
      "The booking link that gets India's creators and professionals paid — bookings, UPI payments and reminders in one link.",
    sameAs: [
      "https://www.linkedin.com/company/book-a-sloth/",
      "https://www.instagram.com/bookasloth",
      "https://www.facebook.com/bookasloth",
      "https://x.com/bookasloth",
    ],
  },
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Meeticulous",
    url: SITE_URL,
    description: "Get booked and paid with one link — bookings, UPI payments and reminders.",
    potentialAction: {
      "@type": "SearchAction",
      target: `${SITE_URL}/search?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  },
];

const EASE = [0.22, 1, 0.36, 1];

/* Google "G" mark — matches the button on /be-a-sloth. */
const GoogleIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0012 23z" />
    <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 010-4.2V7.06H2.18a11 11 0 000 9.88l3.66-2.84z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A11 11 0 0012 1 11 11 0 002.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
  </svg>
);

/* ════════════════════════════════════════════════════════════
   ODOMETER — mechanical rolling-digit stat. Each numeric character rides a
   0–9 column that rolls up to its target digit on scroll-in (staggered, so the
   digits cascade like a real odometer). Non-digits (₹, /, +, K, spaces) stay
   put. Honours prefers-reduced-motion (jumps straight to the final value).
   ════════════════════════════════════════════════════════════ */
const OdometerDigit = ({ digit, delay, inView }) => {
  const reduce = useReducedMotion();
  const show = reduce || inView;
  return (
    <span className="relative inline-block h-[1em] w-[0.62em] overflow-hidden align-baseline">
      <motion.span
        className="absolute inset-x-0 top-0 flex flex-col"
        initial={false}
        animate={{ y: show ? `-${digit}em` : "0em" }}
        transition={reduce ? { duration: 0 } : { duration: 1.2, ease: EASE, delay }}
      >
        {Array.from({ length: 10 }).map((_, n) => (
          <span key={n} className="flex h-[1em] items-center justify-center leading-none">{n}</span>
        ))}
      </motion.span>
    </span>
  );
};

export const Odometer = ({ value, className }) => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  const chars = String(value).split("");
  let di = 0; // running index of digit columns, for the cascade stagger
  return (
    <div ref={ref} className={className} role="img" aria-label={String(value)}>
      <span className="inline-flex items-center tabular-nums" aria-hidden="true">
        {chars.map((c, i) => {
          if (/\d/.test(c)) {
            const delay = di * 0.12;
            di += 1;
            return <OdometerDigit key={i} digit={parseInt(c, 10)} delay={delay} inView={inView} />;
          }
          return (
            <span key={i} className="inline-block">{c === " " ? " " : c}</span>
          );
        })}
      </span>
    </div>
  );
};

/* Stat icon — bigger glyph in a soft tile that pops in on scroll then bobs
   gently forever. Disabled under prefers-reduced-motion. */
const StatIcon = ({ icon: Icon, delay = 0 }) => {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { scale: 0, rotate: -25, opacity: 0 }}
      whileInView={reduce ? {} : { scale: 1, rotate: 0, opacity: 1 }}
      viewport={{ once: true, amount: 0.5 }}
      transition={{ type: "spring", stiffness: 200, damping: 13, delay }}
      className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20"
    >
      <motion.span
        animate={reduce ? {} : { y: [0, -5, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay }}
      >
        <Icon size={30} strokeWidth={2} className="text-primary" />
      </motion.span>
    </motion.div>
  );
};

/* ════════════════════════════════════════════════════════════
   TESTIMONIAL marquee row
   ════════════════════════════════════════════════════════════ */
/* Avatar with graceful initials fallback (CDN image may be unset during setup). */
const TAvatar = ({ src, name }) => {
  const [err, setErr] = useState(false);
  if (err || !src) {
    return (
      <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10 text-sm font-bold text-primary">
        {name?.charAt(0) || "★"}
      </div>
    );
  }
  return (
    <img
      src={src}
      onError={() => setErr(true)}
      alt={name}
      loading="lazy"
      className="h-11 w-11 flex-shrink-0 rounded-xl object-cover"
    />
  );
};

/* Hero "5/5" social-proof face — company-CDN photo with a neutral fallback
   chip, so the row never shows a broken image before the 3 photos are
   uploaded to company-assets …/images/hero/. */
const HeroFace = ({ src }) => {
  const [err, setErr] = useState(false);
  if (err || !src) {
    return (
      <span className="h-10 w-10 flex-shrink-0 rounded-full border-2 border-canvas bg-gradient-to-br from-primary-light to-sand" />
    );
  }
  return (
    <img
      src={src}
      onError={() => setErr(true)}
      alt=""
      loading="lazy"
      className="h-10 w-10 flex-shrink-0 rounded-full border-2 border-canvas object-cover"
    />
  );
};

/* ════════════════════════════════════════════════════════════
   FLOATING glass card (hero)
   ════════════════════════════════════════════════════════════ */
const GlassCard = ({ icon: Icon, label, value, accent, className, float }) => (
  <div
    className={`sloth-glass ${float} absolute flex items-center gap-3 rounded-2xl px-4 py-3 ${className}`}
  >
    <span
      className={`flex h-10 w-10 items-center justify-center rounded-xl ${
        accent ? "bg-primary/10 text-primary" : "bg-neutral-900/5 text-neutral-700"
      }`}
    >
      <Icon size={18} />
    </span>
    <div>
      <div className="text-[11px] font-medium text-neutral-400">{label}</div>
      <div className={`text-sm font-semibold ${accent ? "text-primary" : "text-ink"}`}>
        {value}
      </div>
    </div>
  </div>
);

/* ════════════════════════════════════════════════════════════
   PRODUCT MOCKUPS — stylised UI placeholders for the screenshots
   section. Built from brand tokens so they read as "our product"
   without needing real screenshots. Swap for real captures later.
   ════════════════════════════════════════════════════════════ */
const Bar = ({ w = "w-full", c = "bg-neutral-200", h = "h-2.5" }) => (
  <div className={`${h} ${w} ${c} rounded-full`} />
);
const ProductMock = ({ kind }) => {
  if (kind === "booking") {
    return (
      <div className="flex h-full flex-col">
        <div className="relative">
          <div className="h-16 rounded-[8px]" style={{ background: "linear-gradient(110deg,#fb7185,#f59e0b,#a78bfa,#22d3ee)" }} />
          <div className="absolute -bottom-6 left-3 h-14 w-14 rounded-2xl border-[3px] border-white bg-gradient-to-br from-neutral-200 to-neutral-300" />
        </div>
        <div className="space-y-1 pl-1 pt-7">
          <div className="h-3 w-44 rounded bg-neutral-300" />
          <div className="h-2 w-28 rounded bg-neutral-200" />
          <span className="mt-1 inline-block rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-semibold text-primary">Startup Advisor</span>
        </div>
        <div className="mt-4 space-y-2.5">
          {[["My First Free Service", "Free"], ["My First Paid Service", "₹1,500"]].map(([name, price]) => (
            <div key={name} className="flex items-center justify-between rounded-[6px] border border-neutral-100 bg-white p-3">
              <div>
                <div className="text-xs font-semibold text-ink">{name}</div>
                <div className="mt-0.5 text-[9px] text-neutral-400">20 min · Online</div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-ink">{price}</span>
                <span className="rounded-[5px] bg-primary px-2.5 py-1 text-[9px] font-bold text-white">Book</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (kind === "service") {
    return (
      <div className="space-y-3">
        <div className="rounded-[8px] p-4" style={{ background: "linear-gradient(135deg,#ffd2bf,#fff2ec)" }}>
          <span className="text-[9px] font-bold uppercase tracking-wide text-primary">New · 20 min · Online</span>
          <div className="mt-1.5 font-heading text-base font-extrabold leading-tight text-ink">
            Let&apos;s talk about your <span className="text-primary">booking page</span>
          </div>
        </div>
        <div className="flex items-center gap-2 pl-0.5">
          <div className="h-6 w-6 rounded-full bg-gradient-to-br from-neutral-200 to-neutral-300" />
          <div className="h-2 w-24 rounded bg-neutral-200" />
        </div>
        <div className="flex items-center justify-between rounded-[6px] border border-neutral-100 p-3">
          <span className="text-base font-extrabold text-ink">Free</span>
          <span className="rounded-[6px] bg-primary px-4 py-1.5 text-[10px] font-bold text-white">Book a Slot</span>
        </div>
        <div className="flex gap-4 pl-0.5 text-[9px] font-medium text-neutral-500">
          <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />Verified host</span>
          <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />Instant confirmation</span>
        </div>
      </div>
    );
  }
  if (kind === "checkout") {
    return (
      <div className="space-y-3">
        <div className="flex items-center">
          {["Time", "Details", "Verify", "Done"].map((s, i) => (
            <span key={s} className={`flex items-center ${i < 3 ? "flex-1" : ""}`}>
              <span className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full text-[7px] font-bold ${i === 0 ? "bg-primary text-white" : "bg-neutral-200 text-neutral-400"}`}>{i + 1}</span>
              {i < 3 && <span className="mx-1 h-px flex-1 bg-neutral-200" />}
            </span>
          ))}
        </div>
        <div className="flex gap-3">
          <div className="flex-1">
            <div className="mb-1.5 flex items-center justify-between">
              <div className="h-2.5 w-14 rounded bg-neutral-300" />
              <div className="flex gap-1"><span className="h-2 w-2 rounded-full bg-neutral-200" /><span className="h-2 w-2 rounded-full bg-neutral-200" /></div>
            </div>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: 21 }).map((_, i) => (
                <div key={i} className={`flex aspect-square items-center justify-center rounded-[3px] text-[7px] font-semibold ${i === 11 ? "bg-primary text-white" : i === 10 ? "text-primary ring-1 ring-primary" : "bg-neutral-100 text-neutral-400"}`}>{i + 5}</div>
              ))}
            </div>
          </div>
          <div className="w-px self-stretch bg-neutral-100" />
          <div className="flex-1">
            <div className="mb-2 h-2.5 w-20 rounded bg-neutral-300" />
            <div className="grid grid-cols-2 gap-1.5">
              {["9:00", "9:25", "3:15", "3:40", "4:05", "4:30"].map((t, i) => (
                <div key={t} className={`rounded-[5px] py-1.5 text-center text-[9px] font-semibold ${i === 2 ? "bg-primary text-white" : "border border-neutral-200 text-neutral-500"}`}>{t}</div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }
  // dashboard
  return (
    <div className="flex h-full flex-col gap-3">
      <div className="space-y-1">
        <div className="h-3.5 w-44 rounded bg-neutral-300" />
        <div className="h-2 w-28 rounded bg-neutral-200" />
      </div>
      <div className="grid flex-1 grid-cols-2 gap-2.5">
        {[["1", "Upcoming", "#0079C1"], ["2", "Completed", "#059669"], ["1", "Cancelled", "#dc2626"], ["₹10", "Earnings", "#f59e0b"]].map(([v, l, c]) => (
          <div key={l} className="flex flex-col justify-center rounded-[8px] border border-neutral-100 p-3.5">
            <div className="mb-2 flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: c + "1a" }}>
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: c }} />
            </div>
            <div className="text-2xl font-extrabold leading-none text-ink">{v}</div>
            <div className="mt-1 text-[11px] text-neutral-400">{l}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ════════════════════════════════════════════════════════════
   FEATURES (bento)
   ════════════════════════════════════════════════════════════ */
const FEATURES = [
  { icon: CreditCard, title: "Payments Built In", desc: "Clients pay up-front. Your time finally bills itself." },
  { icon: Mail, title: "Email Reminders", desc: "Gentle nudges so no session is ever forgotten." },
  { icon: Globe, title: "Personal SlothPage", desc: "A mini-site that books and bills on your behalf." },
  { icon: Users, title: "Light CRM", desc: "Notes, history, receipts — zero spreadsheets." },
  { icon: IndianRupee, title: "India First", desc: "GST, INR, UPI — built for how India pays." },
  { icon: Sparkles, title: "AI Assistant", desc: "Suggests slots, drafts briefs, sends thank-yous." },
];

/* "…and so much more" — features + integrations.
   Line icons, per-card colour + subtle glow; hover reveals the description. */
const MOREFEATURES = [
  // Features — payments, video and reminders are covered by their named integrations below.
  { icon: Link2, title: "Short booking links", desc: "meeticulous.com/you — one link for everything you offer.", color: "#0ea5e9" },
  { icon: ShieldCheck, title: "Privacy first", desc: "Your data stays yours. Encrypted, access-controlled, never sold.", color: "#059669" },
  { icon: Code2, title: "Easy embeds", desc: "Drop your booking widget into any website in one line.", color: "#4f46e5" },
  { icon: Palette, title: "Simple customization", desc: "Brand your page — colours, logo and theme in a few clicks.", color: "#db2777" },
  { icon: Star, title: "Reviews & ratings", desc: "Two-way reviews build trust after every session.", color: "#eab308" },
  { icon: BarChart3, title: "Insightful analytics", desc: "Bookings, revenue and no-shows — all at a glance.", color: "#36D8FF" },
  // Integrations
  { icon: IndianRupee, title: "Razorpay", desc: "UPI, cards & netbanking — clients pay before the session starts.", color: "#3b82f6" },
  { icon: Calendar, title: "Google Calendar", desc: "Two-way sync keeps your real availability accurate.", color: "#ea4335" },
  { icon: Webcam, title: "Google Meet", desc: "Auto-generated meet links on confirmed online bookings.", color: "#16a34a" },
  { icon: MessageCircle, title: "WhatsApp & Email", desc: "Confirmations and reminders land where clients look — WhatsApp and inbox.", color: "#25d366" },
];

/* Industry Discovery — the 20 live (active) categories, grouped by industry.
   Mirrors the server categories seed v3.21 (group_label = industry, label =
   profession; only `status:'active'` shown). Fully data-driven: add an industry
   by adding an entry. NOTE: this is a static snapshot — wire it to the live
   categories API later if you want it to track admin changes automatically. */
const INDUSTRIES = [
  {
    name: "Technology & Product",
    slug: "technology-product",
    icon: Cpu,
    color: "var(--c-blue)",
    description: "Build products. Mentor makers.",
    professions: ["Software Engineer", "Product Manager", "UX Designer", "Data Scientist", "AI Engineer"],
  },
  {
    name: "Coaching & Consulting",
    slug: "coaching-consulting",
    icon: Target,
    color: "var(--c-violet)",
    description: "Coach, advise, and transform.",
    professions: ["Career Coach", "Life Coach", "Executive Coach", "Leadership Coach", "Business Coach"],
  },
  {
    name: "Health & Wellness",
    slug: "health-wellness",
    icon: HeartPulse,
    color: "var(--c-emerald)",
    description: "Care for minds and bodies.",
    professions: ["Psychologist", "Nutritionist", "Speech Therapist"],
  },
  {
    name: "Education",
    slug: "education",
    icon: GraduationCap,
    color: "var(--c-amber)",
    description: "Teach, mentor, and inspire.",
    professions: ["Language Tutor", "IELTS Coach", "Study Abroad Consultant"],
  },
  {
    name: "Business Services",
    slug: "business-services",
    icon: Briefcase,
    color: "var(--c-cyan)",
    description: "Advise, strategize, and grow.",
    professions: ["Financial Advisor", "Startup Advisor", "Business Consultant", "HR Consultant"],
  },
];

/* "Who it's for" personas */
const WHO = [
  { key: "freelancer", title: "Freelancers", desc: "Collect advances, never chase invoices." },
  { key: "tutor", title: "Tutors", desc: "Schedule classes, auto-bill parents." },
  { key: "coach", title: "Coaches", desc: "Focus on people, not payment links." },
  { key: "therapist", title: "Therapists", desc: "A calm, private booking space." },
  { key: "consultant", title: "Consultants", desc: "Sell your hours, peacefully." },
  { key: "studio", title: "Agencies & Studios", desc: "One calendar for the whole team." },
];

const TRENDING = [
  "Career coach",
  "Yoga teacher",
  "UI designer",
  "Therapist",
  "Math tutor",
  "Business consultant",
];

/* ── Stats strip — live launch numbers ── */
export const STATS = [
  { icon: Users, value: "20+", label: "Professionals already on Meeticulous" },
  { icon: CalendarCheck, value: "100+", label: "Sessions booked" },
  { icon: Wallet, value: "₹40K+", label: "Processed through the platform" },
  { icon: Smile, value: "5 / 5", label: "Average host rating" },
];

/* ── Problem → solution pairs ── */
const PROBLEMS = [
  { icon: Wallet, problem: "Chasing clients for payment", solution: "They pay before the slot is even confirmed." },
  { icon: MessageCircle, problem: "Booking back-and-forth on WhatsApp", solution: "One link. They pick, pay, done." },
  { icon: Clock, problem: "No-shows wasting your time", solution: "Auto reminders go out — you do nothing." },
  { icon: Calendar, problem: "Calendar chaos across apps", solution: "Two-way Google Calendar sync, always live." },
  { icon: CalendarX2, problem: "Double bookings and clashes", solution: "Slots lock the moment they're taken." },
  { icon: BellRing, problem: "Writing reminders and follow-ups by hand", solution: "They send themselves, before and after every session." },
];

/* ── Feature breakdown — grouped by the job it does ── */
const FEATURE_GROUPS = [
  { icon: CalendarCheck, title: "Get booked", desc: "Your page is live 24/7. Clients book while you sleep.", items: ["Personal booking page", "Availability management", "Two-way calendar sync"] },
  { icon: Wallet, title: "Get paid", desc: "Money in before the session. No invoicing, no chasing.", items: ["Razorpay — UPI, cards, netbanking", "Advance & full payments", "Automatic GST invoices"] },
  { icon: FolderKanban, title: "Stay organized", desc: "Every client, every booking, every rupee — in one place.", items: ["Client history & receipts", "Private notes", "Bookings & revenue reports"] },
  { icon: BellRing, title: "Reduce no-shows", desc: "Gentle reminders that go out automatically. You don't lift a finger.", items: ["Email & WhatsApp reminders", "Instant confirmations", "Post-session follow-ups"] },
];

/* ── Product mockups (stylised UI placeholders — swap for real screenshots later) ── */
const PRODUCT_SHOTS = [
  { tab: "meeticulous.com/you", title: "Public booking page", kind: "booking", color: "#0079C1" },
  { tab: "meeticulous.com/you/strategy-call", title: "Service page", kind: "service", color: "#1DA1F2" },
  { tab: "Checkout · Razorpay", title: "Checkout & payment", kind: "checkout", color: "#36D8FF" },
  { tab: "Dashboard", title: "Your dashboard", kind: "dashboard", color: "#059669" },
];

/* ── Why Meeticulous — reasons to choose it ── */
const WHY_CARDS = [
  { icon: IndianRupee, title: "Built for India", desc: "INR, GST, UPI — native.", color: "var(--c-blue)" },
  { icon: Wallet, title: "0% commission", desc: "You keep every rupee you earn.", color: "var(--c-emerald)" },
  { icon: CreditCard, title: "Razorpay inside", desc: "Payments your clients already trust.", color: "var(--c-violet)" },
  { icon: Zap, title: "Live in minutes", desc: "Claim your link. Add a service. Done.", color: "var(--c-amber)" },
  { icon: Wind, title: "Calm by design", desc: "Clean for you. Clean for your clients.", color: "var(--c-cyan)" },
  { icon: Target, title: "Made for services", desc: "Built for booked time — not bolted onto a CRM.", color: "var(--c-pink)" },
];

/* ── FAQ ── */
const FAQS = [
  { q: "Is Meeticulous really free?", a: "Yes. The Free plan costs nothing and has no time limit. You pay a 5% fee per booking. Paid plans start at ₹83/month and are 0% commission — they pay for themselves quickly if you're booking regularly." },
  { q: "Do you charge commission?", a: "On paid plans, no. You keep 100% of every booking. The Free plan charges 5% per transaction." },
  { q: "Can clients pay while booking?", a: "Yes — that's the whole point. Clients pay via UPI, card or netbanking at checkout. You get paid before the session starts." },
  { q: "Do clients need an account?", a: "No. Clients book and pay without creating an account." },
  { q: "Can I connect Google Calendar?", a: "Yes. Two-way sync — your availability updates automatically and bookings appear in your calendar in real time." },
  { q: "What Google permissions does Meeticulous request?", a: "Only the minimum needed for scheduling: create and manage booking events on your calendar, read your free/busy times so booked slots stay hidden, and read your calendar timezone once. Google data is used solely to provide these features — never for ads, never sold — and you can revoke access anytime from your Google Account settings." },
  { q: "Can I take deposits or advance payments?", a: "Yes. You can collect a deposit or full payment upfront — your choice per service." },
  { q: "Is GST handled?", a: "Yes. GST invoices are generated automatically for every booking." },
  { q: "Will reminders reduce my no-shows?", a: "Consistently. Automated email and WhatsApp reminders go out before every session. Most hosts report a significant drop in no-shows within the first month." },
  { q: "Can I cancel anytime?", a: "Yes. No contracts, no lock-in. Cancel from your dashboard whenever you like." },
  { q: "Can I move from another platform?", a: "Yes. Set up your services and share your new link — most hosts are live the same day." },
];

/* ── Google integration — keep aligned with the consent screen scopes in
   server/config/google.js (3 sensitive scopes, nothing more). Shown in the
   Trust & security section; also part of the Google OAuth verification story. */
const GOOGLE_SCOPES = [
  { name: "Calendar events", scope: "calendar.events", desc: "Creates, reschedules and cancels booking events on your calendar — with Google Meet links attached." },
  { name: "Free/busy times", scope: "calendar.freebusy", desc: "Reads when you're busy so already-taken slots are hidden from your public booking page." },
  { name: "Calendar settings", scope: "calendar.settings.readonly", desc: "Reads your calendar's timezone once, to set your availability correctly." },
];

/* ── Trust & security badges ── */
const TRUST = [
  { icon: Lock, title: "Secure payments", desc: "Processed by Razorpay, India's trusted gateway.", color: "var(--c-blue)" },
  { icon: ShieldCheck, title: "SSL encrypted", desc: "Every page and payment is encrypted end to end.", color: "var(--c-emerald)" },
  { icon: Eye, title: "Privacy-first", desc: "Your data is yours. Never sold, never shared.", color: "var(--c-violet)" },
  { icon: FileCheck, title: "You own your data", desc: "Clients, bookings and earnings always belong to you.", color: "var(--c-cyan)" },
  { icon: Download, title: "Export anytime", desc: "Download your data whenever you want to.", color: "var(--c-amber)" },
];

/* ════════════════════════════════════════════════════════════
   PAGE
   ════════════════════════════════════════════════════════════ */
const HomeArchive = () => {
  useLenis();
  const { startVendorGoogleAuth } = useAuth();

  // Interim (fee-only) mode: soften earn/commission promises to "payments
  // launching soon". Reverts automatically when fee_only_mode flips on Route
  // go-live. Marketing data lives in module-level arrays, so we remap the few
  // earn-y items here at render time.
  const feeOnly = useFeeOnly();
  const featureGroups = feeOnly
    ? FEATURE_GROUPS.map((g) => g.title === "Get paid"
        ? { ...g, title: "Payments coming soon", desc: "Paid bookings and payouts are launching soon — take free bookings today.", items: ["UPI, cards & netbanking (soon)", "Advance & full payments (soon)", "Automatic GST invoices"] }
        : g)
    : FEATURE_GROUPS;
  const whyCards = feeOnly
    ? WHY_CARDS.map((w) => w.title === "0% commission"
        ? { ...w, title: "Made for creators", desc: "Booking, scheduling and reminders — done right." }
        : w)
    : WHY_CARDS;
  const faqs = feeOnly
    ? FAQS.map((f) => {
        if (f.q === "Is Meeticulous really free?") return { q: "Is Meeticulous free to start?", a: "Yes. Creating your booking page, publishing services and taking bookings is free. Paid bookings and payouts are launching soon." };
        if (f.q === "Do you charge commission?") return { q: "Will I be able to charge for bookings?", a: "Paid bookings are launching soon. Today you can take free bookings and manage your schedule; you'll be able to charge guests once payments go live." };
        if (f.q === "Can clients pay while booking?") return { q: "Can clients pay while booking?", a: "Paid bookings are launching soon. Right now clients can book your free sessions; payment at checkout is coming shortly." };
        return f;
      })
    : FAQS;

  // ── Google-only host funnel — same entry as /be-a-sloth ──
  const [googleLoading, setGoogleLoading] = useState(false);
  const startGoogle = async () => {
    setGoogleLoading(true);
    try {
      await startVendorGoogleAuth("signup");
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not start Google sign-up");
      setGoogleLoading(false);
    }
  };

  // ── Preloader readiness: fonts loaded + hero image decoded (real, not timed) ──
  const [assetsReady, setAssetsReady] = useState(false);
  const [openFaq, setOpenFaq] = useState(null); // FAQ: single-open accordion
  useEffect(() => {
    let done = false;
    const finish = () => { if (!done) { done = true; setAssetsReady(true); } };
    const fontsP = document.fonts ? document.fonts.ready : Promise.resolve();
    // The hero banner only renders at >= sm (640px). The mobile hero is text-only,
    // so on phones don't block the preloader decoding an image the device never
    // shows — that just delayed perceived load for ~90% of (mobile) traffic.
    const isMobile = typeof window !== "undefined" && window.matchMedia("(max-width: 639px)").matches;
    let imgP = Promise.resolve();
    if (!isMobile) {
      const img = new Image();
      img.src = HERO;
      imgP = img.decode
        ? img.decode().catch(() => {})
        : new Promise((r) => { img.onload = r; img.onerror = r; });
    }
    Promise.all([fontsP, imgP]).then(finish);
    const safety = setTimeout(finish, 4000); // never strand the preloader
    return () => clearTimeout(safety);
  }, []);

  // ── Newsletter ──
  const [emailInput, setEmailInput] = useState("");
  const [newsletterState, setNewsletterState] = useState("idle"); // idle|loading|ok|err
  const submitNewsletter = async (e) => {
    e.preventDefault();
    const email = emailInput.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      setNewsletterState("err");
      return;
    }
    setNewsletterState("loading");
    try {
      await subscribeNewsletter(email);
    } catch {
      // Network hiccup — the subscribe route already records contact + lead
      // server-side, so just stash the address client-side as a safety net.
      try {
        const leads = JSON.parse(localStorage.getItem("newsletterLeads") || "[]");
        localStorage.setItem("newsletterLeads", JSON.stringify([...leads, email].slice(-200)));
      } catch { /* storage unavailable — ignore */ }
    }
    setNewsletterState("ok");
    setEmailInput("");
  };

  // ── Search (UNCHANGED logic — debounced searchVendors) ──
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const searchTimeout = useRef(null);

  const handleSearch = (q) => {
    setQuery(q);
    clearTimeout(searchTimeout.current);
    if (!q.trim()) {
      setResults(null);
      setSearchError(false);
      return;
    }
    searchTimeout.current = setTimeout(async () => {
      setSearching(true);
      setSearchError(false);
      try {
        const { data } = await searchVendors(q);
        setResults(data);
      } catch {
        setResults(null);
        setSearchError(true);
      } finally {
        setSearching(false);
      }
    }, 400);
  };

  const hasResults =
    results && (results.vendors?.length > 0 || results.services?.length > 0);

  // ── Hero image parallax ──
  const heroRef = useRef(null);
  const { scrollYProgress: heroProg } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const heroImgY = useTransform(heroProg, [0, 1], [0, 80]);

  // ── Testimonials carousel: centred active card fills the 28%→72% middle cell.
  //    Transform-based track (the page runs Lenis smooth-scroll, which blocks inner
  //    scrollLeft — so we translate, not scroll). List is tripled; the auto-advance
  //    walks FORWARD forever and, on reaching the 3rd copy, jumps back one copy with
  //    animation OFF (identical frame) → seamless, never scrolls back. ──
  const N_T = TESTIMONIALS.length;
  const T_GAP = 20; // px gap between cards
  const [activeT, setActiveT] = useState(N_T); // start in the middle copy
  const [tAnim, setTAnim] = useState(false); // transition on? (off on mount + during the seamless jump)
  const [tW, setTW] = useState(0);
  const tWrapRef = useRef(null);
  const tPausedRef = useRef(false);
  const shotsRef = useRef(null);
  // Drag-to-navigate (pointer): follow the finger live, snap to nearest card on release.
  const [dragDX, setDragDX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef({ active: false, startX: 0 });
  useEffect(() => {
    const el = tWrapRef.current;
    if (!el) return;
    const measure = () => setTW(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // Enable the transition a frame AFTER the offset has applied instantly (covers first
  // paint and the post-jump frame) so the track never animates in from the left.
  useEffect(() => {
    if (tAnim || !tW) return;
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setTAnim(true)));
    return () => cancelAnimationFrame(id);
  }, [tAnim, tW]);
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => {
      if (!tPausedRef.current) setActiveT((a) => a + 1);
    }, 2500);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (activeT < 2 * N_T) return;
    const id = setTimeout(() => { setTAnim(false); setActiveT((a) => a - N_T); }, 700);
    return () => clearTimeout(id);
  }, [activeT, N_T]);
  // Mirror reset for backward (drag) travel — keep activeT in the middle copy.
  useEffect(() => {
    if (activeT >= N_T) return;
    const id = setTimeout(() => { setTAnim(false); setActiveT((a) => a + N_T); }, 700);
    return () => clearTimeout(id);
  }, [activeT, N_T]);

  // Reveal + stack the "See it in action" shots. Desktop piles them via CSS
  // sticky; mobile fades each up on entry. Fails open so none stay hidden.
  useEffect(() => {
    const node = shotsRef.current;
    if (!node) return;
    const cards = [...node.querySelectorAll(".home-shot")];
    const reveal = (el) => el.classList.add("is-in");
    if (typeof IntersectionObserver === "undefined") { cards.forEach(reveal); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { reveal(e.target); io.unobserve(e.target); } });
    }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
    cards.forEach((el) => io.observe(el));
    const failOpen = setTimeout(() => {
      if (!cards.some((el) => el.classList.contains("is-in"))) cards.forEach(reveal);
    }, 1500);
    return () => { clearTimeout(failOpen); io.disconnect(); };
  }, []);  const tFrac = tW >= 1024 ? 0.44 : tW >= 640 ? 0.6 : 0.84;
  const tCardW = tW ? tW * tFrac : 0;
  const tOffset = tW ? (tW - tCardW) / 2 - activeT * (tCardW + T_GAP) : 0;

  // ── Competitor comparison tiles (favicons via Google's favicon service) ──
  const COMPETITORS = [
    { name: "Topmate", domain: "topmate.io", href: "/compare/topmate-alternative" },
    { name: "Calendly", domain: "calendly.com", href: "/compare/calendly-alternative" },
    { name: "Cal.com", domain: "cal.com" }, // page not built yet → active tile, no link
    { name: "DaySchedule", domain: "dayschedule.com" }, // page not built yet
  ];

  return (
    <main id="top" className="overflow-x-clip bg-canvas text-ink">
      <Seo
        title="Meeticulous — the booking link that gets you paid"
        description="Share one link — clients book, pay over UPI, and the money lands in your account. Meeticulous is the booking page for India's creators, coaches, tutors and studios. Instant UPI payouts, reminders and calendar sync — set up in about a minute."
        keywords="booking link, get paid for bookings, UPI payments booking, appointment booking India, online booking page, creator booking, coach booking software, consultant scheduling, tutor booking, freelancer payments, instant payout, calendar scheduling, India"
        canonical={`${SITE_URL}/`}
        robots="noindex, nofollow"
        siteName="Meeticulous"
        locale="en_IN"
        themeColor="#F5B700"
        ogTitle="Meeticulous — the booking link that gets you paid"
        ogDescription="Share one link — clients book, pay over UPI, money lands in your account. For India's creators, coaches and studios."
        image={OG_IMAGE}
        jsonLd={HOME_JSONLD}
      />
      <BrandPreloader variant="homepage" ready={assetsReady} />

      {/* ════════════════ HERO — DESKTOP/TABLET (sm+) ════════════════ */}
      {/* Mobile gets its own centered section below; this whole block is sm:block. */}
      <section ref={heroRef} className="relative hidden px-5 pb-14 pt-8 sm:block sm:px-8 sm:pb-20 sm:pt-12 lg:pb-32 lg:pt-16">
        {/* Ambient warm aura — adds depth on the flat canvas without changing the palette */}
        <div aria-hidden className="sloth-hero-aura" />

        <div className="relative z-10 mx-auto grid max-w-7xl items-center gap-10 sm:gap-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12">
          {/* LEFT */}
          <div>
            <Reveal as="h1" delay={0.05} className="text-[clamp(1.7rem,7vw,2.7rem)] font-semibold leading-[1.1] tracking-[-0.03em] text-ink sm:text-[3.4rem] sm:leading-[1.05] lg:text-[3.9rem]">
              You sell your time.
              <br />
              <span className="font-bold text-primary">We make everything around it calmer</span>.
            </Reveal>

            <Reveal as="p" delay={0.12} className="mt-5 max-w-md text-base leading-relaxed text-neutral-500 sm:mt-7 sm:text-lg">
              Booking, payments and reminders — handled. So you never chase an
              invoice or run your own front desk again. Built for India. Set up in ~42 seconds.
            </Reveal>

            {/* Google-only host funnel — fires the same flow as /be-a-sloth */}
            <Reveal delay={0.18} className="mt-6 sm:mt-9">
              <div className="max-w-[22rem]">
                <button
                  onClick={startGoogle}
                  disabled={googleLoading}
                  className="btn flex w-full items-center justify-center gap-3 rounded-[5px] bg-ink py-3.5 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(16,24,40,0.16)] transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  <GoogleIcon />
                  {googleLoading ? "Opening Google…" : "Continue with Google Account"}
                </button>
                <p className="mt-3 text-xs leading-relaxed text-neutral-500">
                  By continuing, you agree to our{" "}
                  <Link to="/terms" className="text-neutral-500 underline decoration-neutral-300 underline-offset-2 hover:text-ink">Terms &amp; Conditions</Link> and{" "}
                  <Link to="/privacy" className="text-neutral-500 underline decoration-neutral-300 underline-offset-2 hover:text-ink">Privacy Policy</Link>.{" "}
                  Why we{" "}
                  <a href="#how-google" className="font-medium text-primary underline underline-offset-2 hover:text-primary-dark">ask for Google</a>.
                </p>
              </div>
            </Reveal>

            {/* Social proof */}
            <Reveal delay={0.24} className="mt-7 flex items-center gap-4 sm:mt-9">
              <div className="flex -space-x-3">
                {HERO_FACES.map((f, i) => (
                  <HeroFace key={i} src={f} />
                ))}
              </div>
              <div>
                <div className="flex items-center gap-1">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <Star key={i} size={13} className="fill-amber-400 text-amber-400" />
                  ))}
                  <span className="ml-1 text-sm font-semibold text-ink">5/5</span>
                </div>
                <p className="text-xs text-neutral-500">
                  Loved by India's creators and coaches.
                </p>
              </div>
            </Reveal>
          </div>

          {/* RIGHT — hero photo (sm+ only; mobile uses the dedicated centered section below) */}
          <Reveal delay={0.1} className="relative hidden sm:block">
            <div className="relative mx-auto aspect-[4/5] w-full max-w-md overflow-hidden rounded-[6px] bg-sand shadow-[0_40px_90px_-25px_rgba(26,26,26,0.38)] ring-1 ring-black/5">
              <motion.img
                src={HERO}
                alt="A calm professional at work"
                loading="eager"
                style={{ y: heroImgY }}
                className="h-[112%] w-full object-cover"
              />
              {/* Subtle inset sheen for a more premium frame */}
              <div aria-hidden className="pointer-events-none absolute inset-0 rounded-[6px] ring-1 ring-inset ring-white/15" />
            </div>

            {/* Floating glass cards */}
            <GlassCard
              icon={CalendarCheck}
              label="New booking"
              value="Confirmed · 4:30 PM"
              float="sloth-float"
              className="hidden sm:flex top-10 sm:-left-8"
            />
            <GlassCard
              icon={Wallet}
              label="Payment received"
              value="₹2,500"
              accent
              float="sloth-float--mid"
              className="hidden sm:flex top-1/2 sm:-right-6"
            />
            <GlassCard
              icon={Wind}
              label="Upcoming session"
              value="Tomorrow · 11 AM"
              float="sloth-float--slow"
              className="hidden sm:flex bottom-8 sm:left-6"
            />
          </Reveal>
        </div>
      </section>

      {/* ════════════════ HERO — MOBILE ONLY (centered) ════════════════ */}
      {/* Same left-column content as the sm+ hero, centered. Full-viewport
          height so the hero fills the first screen; content vertically centered. */}
      <section className="relative flex min-h-screen flex-col justify-center px-5 pb-14 pt-8 sm:hidden">
        <div aria-hidden className="sloth-hero-aura" />

        <div className="relative z-10 mx-auto max-w-md text-center">
          {/* Mobile hero is the responsive twin of the desktop <h1> above; both
              render in the DOM (CSS-hidden per breakpoint), so this one is an h2
              to keep a single H1 per page for crawlers. */}
          <Reveal as="h2" delay={0.05} className="text-[clamp(2.2rem,9vw,3.2rem)] font-semibold leading-[1.08] tracking-[-0.03em] text-ink">
            You sell your time.
            <br />
            <span className="font-bold text-primary">We make everything around it calmer</span>.
          </Reveal>

          <Reveal as="p" delay={0.12} className="mx-auto mt-5 max-w-md text-base leading-relaxed text-neutral-500">
            Booking, payments and reminders — handled. So you never chase an
            invoice or run your own front desk again. Built for India. Set up in ~42 seconds.
          </Reveal>

          {/* Google-only host funnel — fires the same flow as /be-a-sloth */}
          <Reveal delay={0.18} className="mt-6">
            <div className="mx-auto max-w-[22rem]">
              <button
                onClick={startGoogle}
                disabled={googleLoading}
                className="btn btn--outline flex w-full items-center justify-center gap-3 rounded-[5px] border border-black/[0.12] bg-white py-3.5 text-sm font-semibold text-ink shadow-[0_1px_2px_rgba(16,24,40,0.05)] transition-colors hover:border-black/20 disabled:opacity-50"
              >
                <GoogleIcon />
                {googleLoading ? "Opening Google…" : "Continue with Google Account"}
              </button>
              <p className="mt-3 text-xs leading-relaxed text-neutral-500">
                By continuing, you agree to our{" "}
                <Link to="/terms" className="text-neutral-500 underline decoration-neutral-300 underline-offset-2 hover:text-ink">Terms &amp; Conditions</Link> and{" "}
                <Link to="/privacy" className="text-neutral-500 underline decoration-neutral-300 underline-offset-2 hover:text-ink">Privacy Policy</Link>.{" "}
                Why we{" "}
                <a href="#how-google" className="font-medium text-primary underline underline-offset-2 hover:text-primary-dark">ask for Google</a>.
              </p>
            </div>
          </Reveal>

          {/* Social proof */}
          <Reveal delay={0.24} className="mt-7 flex flex-col items-center gap-3">
            <div className="flex -space-x-3">
              {HERO_FACES.map((f, i) => (
                <HeroFace key={i} src={f} />
              ))}
            </div>
            <div className="flex flex-col items-center">
              <div className="flex items-center gap-1">
                {[0, 1, 2, 3, 4].map((i) => (
                  <Star key={i} size={13} className="fill-amber-400 text-amber-400" />
                ))}
                <span className="ml-1 text-sm font-semibold text-ink">5/5</span>
              </div>
              <p className="text-center text-xs text-neutral-500">
                Loved by India's first calm professionals.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ════════════════ FEATURED-ON BADGES ════════════════ */}
      <section className="px-5 py-14 sm:px-8 lg:py-20">
        <div className="mx-auto max-w-5xl">
          <Reveal as="p" className="text-center text-base font-semibold uppercase tracking-[0.2em] text-primary sm:text-lg">
            Trusted &amp; featured on
          </Reveal>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3 sm:gap-4">
            {FEATURED_ON.map((b) => (
              <a
                key={b.alt}
                href={b.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={b.alt}
                className={`flex h-14 items-center justify-center rounded-xl px-5 ring-1 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                  b.dark ? "bg-neutral-900 ring-white/10" : "bg-white ring-black/5"
                }`}
              >
                <img src={b.src} alt={b.alt} loading="lazy" className="max-h-8 w-auto object-contain" />
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════ STATS STRIP (dark) ════════════════ */}
      <section className="bg-ink px-5 py-20 text-white sm:px-8 lg:py-28">
        <div className="mx-auto max-w-6xl">
          <Reveal as="p" className="text-center text-base font-semibold uppercase tracking-[0.2em] text-primary sm:text-lg">
            The calm starts here
          </Reveal>
          <Reveal as="h2" delay={0.05} style={{ textWrap: "balance" }} className="mx-auto mt-3 max-w-[34rem] text-center text-4xl text-white sm:text-5xl">
            Early, intentional, and built to last.
          </Reveal>
          <div className="mt-10 grid grid-cols-2 gap-x-6 gap-y-10 lg:grid-cols-4 lg:gap-x-0 lg:divide-x lg:divide-white/10">
            {STATS.map((s, i) => (
              <Reveal key={s.label} delay={i * 0.08} className="text-center lg:px-6">
                <StatIcon icon={s.icon} delay={i * 0.08} />
                <Odometer value={s.value} className="mt-2 font-heading text-4xl font-extrabold tracking-tight text-white sm:text-5xl" />
                <p className="mx-auto mt-2 max-w-[12rem] text-sm text-white/60">{s.label}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════ ...AND SO MUCH MORE (features + integrations) ════════════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-6xl">
          <Reveal as="p" className="text-center text-sm font-medium uppercase tracking-[0.2em] text-primary">
            Features & integrations
          </Reveal>
          <Reveal as="h2" delay={0.05} className="mt-3 text-center text-4xl font-extrabold leading-tight text-ink sm:text-5xl">
            Everything you need. <span className="text-primary">Nothing you don't.</span>
          </Reveal>

          <div className="mt-14 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-5">
            {MOREFEATURES.map((f, i) => (
              <Reveal key={f.title} delay={(i % 5) * 0.05}>
                <div className="group relative flex h-full min-h-[210px] flex-col items-center justify-center overflow-hidden rounded-[20px] border border-black/5 bg-white p-5 text-center transition-all duration-300 hover:-translate-y-1.5 hover:border-black/10 hover:shadow-[0_22px_45px_-18px_rgba(26,26,26,0.22)]">
                  {/* Diagonal shine sweep on hover */}
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-black/[0.04] to-transparent transition-transform duration-700 ease-out group-hover:translate-x-full"
                  />

                  {/* Icon tile + coloured glow */}
                  <span className="relative mb-4 inline-flex h-14 w-14 items-center justify-center">
                    <span
                      aria-hidden
                      className="absolute inset-0 rounded-2xl opacity-20 blur-xl transition-all duration-300 group-hover:scale-125 group-hover:opacity-60"
                      style={{ background: f.color }}
                    />
                    <span className="relative inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-black/5 bg-white shadow-sm transition-transform duration-300 group-hover:scale-105">
                      <f.icon size={24} strokeWidth={1.75} style={{ color: f.color }} />
                    </span>
                  </span>

                  <h3 className="font-heading text-sm font-bold text-ink">{f.title}</h3>

                  {/* Hover-revealed info */}
                  <p className="mt-2 max-h-0 overflow-hidden text-xs leading-relaxed text-neutral-500 opacity-0 transition-all duration-300 ease-out group-hover:max-h-24 group-hover:opacity-100">
                    {f.desc}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal as="p" delay={0.1} className="mx-auto mt-10 max-w-[750px] text-center text-base text-neutral-500">
            Works with the tools you already use — Razorpay, Google Calendar, Google Meet, WhatsApp and Email.
          </Reveal>
        </div>
      </section>

      {/* ════════════════ INDUSTRY DISCOVERY (dark) ════════════════ */}
      <section className="bg-ink px-5 py-20 text-white sm:px-8 lg:py-28">
        <div className="mx-auto max-w-6xl">
          <Reveal as="p" className="text-center text-sm font-medium uppercase tracking-[0.2em] text-primary">
            Industries we support
          </Reveal>
          <Reveal as="h2" delay={0.05} className="mx-auto mt-3 max-w-[750px] text-center text-4xl text-white sm:text-5xl">
            Built for your <span className="font-extrabold text-primary">profession.</span>
          </Reveal>
          <Reveal as="p" delay={0.1} className="mx-auto mt-4 max-w-[750px] text-center text-base text-white/70">
            Whatever you charge for — sessions, audits, consultations, classes — there's a place for it on Meeticulous.
          </Reveal>

          <div className="mt-14 flex flex-wrap justify-center gap-5">
            {INDUSTRIES.map((ind, i) => (
              <Reveal key={ind.slug} delay={(i % 3) * 0.08} className="w-full sm:w-[calc(50%-0.625rem)] lg:w-[calc(33.333%-0.833rem)]">
                {/* Focusable card: hover (mouse), focus-within (keyboard) and
                    tap (mobile focuses the tabIndex=0 card) all trigger expand. */}
                {/* Fixed-height card: default summary and detail crossfade in the
                    SAME footprint — the card never resizes, so nothing shifts. */}
                <div
                  tabIndex={0}
                  role="group"
                  aria-label={`${ind.name} — show popular professions`}
                  className="group relative h-full min-h-[233px] overflow-hidden rounded-[6px] border border-white/10 bg-white/5 shadow-[0_8px_30px_rgba(0,0,0,0.3)] outline-none ring-1 ring-inset ring-white/10 backdrop-blur-xl transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-[0_24px_50px_-20px_rgba(0,0,0,0.6)] focus-visible:-translate-y-1 focus-visible:ring-2 focus-visible:ring-primary/40 motion-reduce:transition-none"
                >
                  {/* Big line icon anchored to the top-left corner — card background */}
                  <ind.icon
                    aria-hidden
                    strokeWidth={1.25}
                    className="pointer-events-none absolute -left-3 -top-3 h-24 w-24 opacity-25 transition-opacity duration-300 group-hover:opacity-40 group-focus-within:opacity-40 motion-reduce:transition-none"
                    style={{ color: ind.color }}
                  />

                  {/* DEFAULT layer — title sits top-right next to the corner icon;
                      description + hint anchor to the bottom. Fades out on hover/focus. */}
                  <div className="absolute inset-0 flex flex-col p-6 transition-opacity duration-300 group-hover:opacity-0 group-focus-within:opacity-0 motion-reduce:transition-none">
                    <h3 className="ml-auto max-w-[60%] text-right font-heading text-xl font-bold leading-tight text-white">{ind.name}</h3>
                    <p className="mt-auto text-sm leading-relaxed text-white/60">{ind.description}</p>
                    <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-white/50">
                      Explore roles <ArrowRight size={12} />
                    </span>
                  </div>

                  {/* DETAIL layer — frosted panel (bg + blur) fully hides/blurs the
                      back content; professions + CTA fade in over it. */}
                  <div className="absolute inset-0 flex flex-col bg-ink/70 p-6 opacity-0 backdrop-blur-md transition-opacity duration-300 group-hover:opacity-100 group-focus-within:opacity-100 motion-reduce:transition-none">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white">
                      Popular professions
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {ind.professions.map((p) => (
                        <span
                          key={p}
                          className="rounded-full border px-3 py-1 text-xs font-medium"
                          style={{
                            backgroundColor: `color-mix(in srgb, ${ind.color} 18%, transparent)`,
                            borderColor: `color-mix(in srgb, ${ind.color} 35%, transparent)`,
                            color: `color-mix(in srgb, ${ind.color} 60%, white)`,
                          }}
                        >
                          {p}
                        </span>
                      ))}
                    </div>
                    <Link
                      to={`${ROUTE_START}?industry=${ind.slug}`}
                      className="mt-auto inline-flex w-fit items-center gap-1.5 rounded-[6px] bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-transform hover:bg-primary-dark hover:no-underline"
                    >
                      See professions <ArrowRight size={15} />
                    </Link>
                  </div>
                </div>
              </Reveal>
            ))}

          </div>
        </div>
      </section>

      {/* ════════════════ SEARCH — "Find a vendor" ════════════════
         TEMPORARILY DISABLED (keep for later). The whole section is preserved
         below; it just doesn't render. To bring it back, delete the
         `{false && (` line here and its matching `)}` after </section>. */}
      {false && (
      <section id="find" className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal as="h2" className="text-4xl text-ink sm:text-5xl">
            Find a vendor
          </Reveal>
          <Reveal as="p" delay={0.06} className="mx-auto mt-4 max-w-md text-neutral-500">
            Search a name, a skill, a service. Discover calm professionals near you.
          </Reveal>

          <Reveal delay={0.12} className="relative mx-auto mt-10 max-w-2xl">
            <label htmlFor="vendor-search" className="sr-only">
              Search hosts by name, skill or service
            </label>
            <Search
              size={20}
              className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-neutral-400"
            />
            <input
              id="vendor-search"
              type="search"
              placeholder="e.g. career coach, UI designer, yoga teacher…"
              value={query}
              onChange={(e) => handleSearch(e.target.value)}
              className="!h-16 w-full rounded-full border border-black/5 bg-white !pl-14 !pr-14 text-base shadow-[0_12px_40px_-12px_rgba(26,26,26,0.18)] focus:!border-primary"
            />
            {searching && (
              <div className="absolute right-6 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            )}
            {/* Screen-reader status — announces search progress/outcome */}
            <div role="status" aria-live="polite" className="sr-only">
              {searching
                ? "Searching"
                : searchError
                ? "Search failed, please try again"
                : query && !hasResults
                ? `No results for ${query}`
                : ""}
            </div>
          </Reveal>

          {/* Trending chips */}
          {!query && (
            <Reveal delay={0.18} className="mt-6 flex flex-wrap justify-center gap-2">
              <span className="py-1.5 text-xs font-medium uppercase tracking-wide text-neutral-400">
                Trending
              </span>
              {TRENDING.map((c) => (
                <button
                  key={c}
                  onClick={() => handleSearch(c)}
                  className="rounded-full border border-black/5 bg-white px-4 py-1.5 text-sm text-neutral-600 transition-colors hover:border-primary/30 hover:text-primary"
                >
                  {c}
                </button>
              ))}
            </Reveal>
          )}

          {/* Results (unchanged data shape) */}
          {query && (
            <div className="mt-6 text-left">
              {!hasResults && !searching && (
                <p className="py-6 text-center text-sm text-neutral-500">
                  {searchError
                    ? "Something went wrong. Please try again."
                    : `No results for “${query}”.`}
                </p>
              )}

              {results?.vendors?.length > 0 && (
                <div className="mb-5">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
                    Hosts
                  </p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {results.vendors.map((v) => (
                      <Link
                        key={v.id}
                        to={`/${v.username}`}
                        className="flex items-center gap-3 rounded-2xl border border-black/5 bg-white p-3 transition-shadow hover:shadow-md hover:no-underline"
                      >
                        <HostAvatar src={v.profile_image} name={v.name} themeColor={v.theme_color}
                                    size={40} shape="rounded" decorative />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1">
                            <p className="truncate text-sm font-medium text-ink">{v.name}</p>
                            {v.is_verified && <Check size={14} className="flex-shrink-0 text-green-500" />}
                          </div>
                          <p className="truncate text-xs text-neutral-400">
                            {v.profession || v.tagline || "@" + v.username}
                          </p>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {results?.services?.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
                    Services
                  </p>
                  <div className="space-y-2">
                    {results.services.map((s) => (
                      <Link
                        key={s.id}
                        to={`/${s.profiles?.username}/${s.slug || s.id}`}
                        className="flex items-center gap-3 rounded-2xl border border-black/5 bg-white p-3 transition-shadow hover:shadow-md hover:no-underline"
                      >
                        {s.thumbnail_url ? (
                          <img src={s.thumbnail_url} alt={s.title} className="h-10 w-12 flex-shrink-0 rounded-lg object-cover" />
                        ) : (
                          <div className="flex h-10 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-primary/5">
                            <CalendarCheck size={18} className="text-primary/40" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-ink">{s.title}</p>
                          <p className="text-xs text-neutral-400">
                            by {s.profiles?.name} · {s.duration} min
                          </p>
                        </div>
                        <span className="flex-shrink-0 text-sm font-semibold text-primary">
                          {s.price === 0 ? "Free" : `₹${s.price}`}
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>
      )}

      {/* ════════════════ PROBLEM → SOLUTION ════════════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-6xl">
          <Reveal as="p" className="text-center text-sm font-medium uppercase tracking-[0.2em] text-primary">
            Sound familiar?
          </Reveal>
          <Reveal as="h2" delay={0.05} className="mx-auto mt-3 max-w-[750px] text-center text-4xl text-ink sm:text-5xl">
            The admin that eats your week — <span className="font-extrabold text-primary">gone.</span>
          </Reveal>
          <Reveal as="p" delay={0.1} className="mx-auto mt-4 max-w-[750px] text-center text-base text-neutral-500">
            You didn't get into this to chase payments and send reminders. Meeticulous handles the back-office so you don't have to.
          </Reveal>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 sm:gap-6">
            {PROBLEMS.map((p, i) => (
              <Reveal key={p.problem} delay={(i % 2) * 0.08}>
                <div className="h-full rounded-[6px] border border-black/5 bg-white p-6 shadow-[0_8px_30px_rgba(26,26,26,0.04)] transition-all duration-300 hover:-translate-y-1 hover:border-black/10 hover:shadow-[0_22px_45px_-18px_rgba(26,26,26,0.16)] sm:p-7">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <p.icon size={18} />
                    </span>
                    <p className="text-sm font-semibold text-neutral-500 line-through decoration-neutral-400 decoration-[1.5px]">
                      {p.problem}
                    </p>
                  </div>
                  <div className="mt-4 flex items-start gap-3 border-t border-dashed border-neutral-200 pt-4">
                    <Check size={18} className="mt-0.5 flex-shrink-0 text-primary" />
                    <p className="text-[15px] font-medium leading-relaxed text-ink">{p.solution}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════ HOW THE CALM WORKS ════════════════ */}
      <section id="how-it-works" className="bg-neutral-800 px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-6xl">
          <Reveal as="h2" className="mx-auto max-w-[750px] text-center text-4xl text-white sm:text-5xl">
            From link to paid. <span className="font-extrabold text-primary">In three steps.</span>
          </Reveal>
          <Reveal as="p" delay={0.1} className="mx-auto mt-4 max-w-[750px] text-center text-base text-neutral-200">
            No back-and-forth. No payment awkwardness. No reminders to write.
          </Reveal>

          <HowItWorks />
        </div>
      </section>

      {/* ════════════════ FEATURES (BENTO) ════════════════
         REMOVED FROM PAGE (duplicate of the pastel "modern features" grid above).
         Preserved below; re-enable by deleting `{false && (` and its `)}`. */}
      {false && (
      <section className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="grid auto-rows-[minmax(0,1fr)] gap-4 md:grid-cols-3">
            {/* Big intro card */}
            <Reveal className="md:col-span-2 md:row-span-2">
              <div className="flex h-full flex-col justify-between overflow-hidden rounded-[2rem] bg-ink p-8 text-white sm:p-10">
                <div>
                  <Sparkles size={24} className="text-primary" />
                  <h2 className="mt-6 text-3xl leading-tight sm:text-4xl">
                    More than a scheduler.
                    <br />
                    <span className="text-white/50">Your calm business partner.</span>
                  </h2>
                  <p className="mt-4 max-w-md text-white/60">
                    Everything you need to run a one-person practice or a small
                    studio — booking, payments, reminders and a beautiful page —
                    in one quiet place.
                  </p>
                </div>
                <Link
                  to={ROUTE_START}
                  className="mt-8 inline-flex w-fit items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white transition-transform hover:bg-primary-dark hover:no-underline"
                >
                  Get Started <ArrowRight size={16} />
                </Link>
              </div>
            </Reveal>

            {/* Feature cards */}
            {FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={(i % 3) * 0.06}>
                <motion.div
                  whileHover={{ y: -4 }}
                  transition={{ duration: 0.3, ease: EASE }}
                  className="flex h-full flex-col rounded-[2rem] border border-black/5 bg-white p-6 shadow-[0_8px_30px_rgba(26,26,26,0.04)]"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-neutral-100 text-ink">
                    <f.icon size={20} />
                  </span>
                  <h3 className="mt-4 font-heading text-base font-bold text-ink">
                    {f.title}
                  </h3>
                  <p className="mt-1.5 text-sm text-neutral-500">{f.desc}</p>
                </motion.div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>
      )}

      {/* ════════════════ WHO IT'S FOR ════════════════
         REMOVED from page (keep for later). Restore by deleting `{false && (`
         and its matching `)}` after </section>. */}
      {false && (
      <section className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-6xl">
          <Reveal as="h2" className="max-w-xl text-4xl text-ink sm:text-5xl">
            Built for the new
            <br />
            <span className="text-neutral-400">Indian professional.</span>
          </Reveal>

          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {WHO.map((p, i) => (
              <Reveal key={p.key} delay={(i % 3) * 0.07}>
                <div className="group relative overflow-hidden rounded-[2rem] bg-sand shadow-sm transition-shadow duration-300 hover:shadow-[0_24px_50px_-20px_rgba(26,26,26,0.35)]">
                  <div className="aspect-[4/5] overflow-hidden">
                    <img
                      src={PERSONAS[p.key]}
                      alt={p.title}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
                    />
                  </div>
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent p-6 pt-16">
                    <h3 className="font-heading text-lg font-bold text-white">{p.title}</h3>
                    <p className="mt-0.5 text-sm text-white/70">{p.desc}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>
      )}

      {/* ════════════════ PRODUCT SCREENSHOTS ════════════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-6xl">
          <Reveal as="p" className="text-center text-sm font-medium uppercase tracking-[0.2em] text-primary">
            See it in action
          </Reveal>
          <Reveal as="h2" delay={0.05} className="mx-auto mt-3 max-w-[750px] text-center text-4xl text-ink sm:text-5xl">
            Calm to look at. <span className="font-extrabold text-primary">Calm to use.</span>
          </Reveal>
          <Reveal as="p" delay={0.1} className="mx-auto mt-4 max-w-[750px] text-center text-base text-neutral-500">
            Your booking page, service pages, checkout and dashboard — all clean, all connected, all working while you're not.
          </Reveal>
          <div ref={shotsRef} className="home-shots mx-auto mt-14 max-w-2xl">
            {PRODUCT_SHOTS.map((shot, i) => (
              <figure key={shot.title} className="home-shot" style={{ "--cc": shot.color, "--i": i }}>
                <div
                  className="flex min-h-[22rem] flex-col overflow-hidden rounded-[10px] bg-white transition-all duration-300 hover:-translate-y-1 sm:h-[24rem]"
                  style={{
                    border: "1px solid color-mix(in srgb, var(--cc) 40%, transparent)",
                    boxShadow: "0 18px 40px -26px color-mix(in srgb, var(--cc) 48%, transparent)",
                  }}
                >
                  <div
                    className="flex items-center gap-2 border-b px-4 py-3"
                    style={{
                      background: "color-mix(in srgb, var(--cc) 8%, white)",
                      borderColor: "color-mix(in srgb, var(--cc) 16%, transparent)",
                    }}
                  >
                    <span className="flex gap-1.5" aria-hidden>
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: "color-mix(in srgb, var(--cc) 60%, white)" }} />
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: "color-mix(in srgb, var(--cc) 40%, white)" }} />
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: "color-mix(in srgb, var(--cc) 22%, white)" }} />
                    </span>
                    <div className="ml-2 flex-1 truncate rounded-full bg-white px-3 py-1 text-[11px] text-neutral-400 ring-1 ring-inset ring-black/5">
                      {shot.tab}
                    </div>
                  </div>
                  <div className="flex-1 p-5 sm:p-6">
                    <ProductMock kind={shot.kind} />
                  </div>
                  {/* Caption lives INSIDE the opaque card so the sticky deck
                      covers it like the body — keeps trailing text from
                      piling up/overlapping during the stack scroll. */}
                  <figcaption
                    className="border-t px-5 py-3 text-center text-sm font-semibold"
                    style={{
                      borderColor: "color-mix(in srgb, var(--cc) 16%, transparent)",
                      color: "color-mix(in srgb, var(--cc) 80%, #191919)",
                    }}
                  >
                    {shot.title}
                    {shot.kind === "dashboard" && (
                      <span className="mt-0.5 block text-sm font-medium text-primary">
                        This is what your Monday morning looks like.
                      </span>
                    )}
                  </figcaption>
                </div>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════ FEATURE BREAKDOWN (dark) ════════════════ */}
      <section className="bg-ink px-5 py-20 text-white sm:px-8 lg:py-28">
        <div className="mx-auto max-w-6xl">
          <Reveal as="p" className="text-center text-sm font-medium uppercase tracking-[0.2em] text-primary">
            Everything you need
          </Reveal>
          <Reveal as="h2" delay={0.05} className="mx-auto mt-3 max-w-[750px] text-center text-4xl text-white sm:text-5xl">
            Four jobs. <span className="font-extrabold text-primary">One calm tool.</span>
          </Reveal>
          <Reveal as="p" delay={0.1} className="mx-auto mt-4 max-w-[750px] text-center text-base text-white/70">
            Not a feature list — just the four things every service business actually needs, done properly.
          </Reveal>
          <div className="mt-14 grid gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4">
            {featureGroups.map((g, i) => (
              <Reveal key={g.title} delay={(i % 4) * 0.07}>
                {/* Subtle dark-theme hover: card lifts, border warms to orange, bg
                    brightens slightly, icon chip warms. Text + orange accents stay — no invert. */}
                <div className="group flex h-full flex-col rounded-[6px] border border-white/10 bg-white/5 p-6 shadow-[0_8px_30px_rgba(0,0,0,0.3)] transition-all duration-300 hover:-translate-y-1 hover:border-primary hover:bg-white/10 hover:shadow-[0_22px_45px_-18px_rgba(0,0,0,0.6)] sm:p-7">
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15 text-primary transition-colors duration-300 group-hover:bg-primary/25">
                    <g.icon size={22} />
                  </span>
                  <h3 className="mt-5 font-heading text-lg font-bold text-white">{g.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-white/60">{g.desc}</p>
                  <ul className="mt-5 space-y-2.5 border-t border-white/10 pt-5 transition-colors duration-300 group-hover:border-white/20">
                    {g.items.map((it) => (
                      <li key={it} className="flex items-start gap-2 text-sm text-white/80">
                        <Check size={15} className="mt-0.5 flex-shrink-0 text-primary" />
                        {it}
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════ TESTIMONIALS (CENTERED CAROUSEL) ════════════════ */}
      <section id="collective" className="overflow-hidden px-5 pb-20 pt-14 sm:px-8 lg:pb-28 lg:pt-20">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal as="h2" className="text-4xl font-extrabold leading-[1.05] tracking-tight text-ink sm:text-5xl">
            Don't take our word for it.
          </Reveal>
          <Reveal as="p" delay={0.1} className="mx-auto mt-4 max-w-[750px] text-base text-neutral-500">
            Real professionals. Real bookings. Real calm.
          </Reveal>
        </div>

        <div className="relative mt-8">
          {/* Blueprint guide lines (desktop) — at 28%/72% = the active card's edges */}
          <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-12 top-12 z-0 hidden lg:block">
            <div className="absolute inset-x-0 top-0 border-t border-dashed border-neutral-200" />
            <div className="absolute inset-x-0 bottom-0 border-t border-dashed border-neutral-200" />
            <div className="absolute inset-y-0 left-[28%] border-l border-dashed border-neutral-200" />
            <div className="absolute inset-y-0 left-[72%] border-l border-dashed border-neutral-200" />
          </div>

          {/* Transform track — Lenis blocks inner scrollLeft, so we translate.
              Loops forward forever (tripled list, animation-off seamless reset). */}
          <div
            ref={tWrapRef}
            role="region"
            aria-roledescription="carousel"
            aria-label="What our customers say — use the arrow keys to browse"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") { e.preventDefault(); setActiveT((a) => a + 1); }
              else if (e.key === "ArrowLeft") { e.preventDefault(); setActiveT((a) => a - 1); }
            }}
            onMouseEnter={() => { tPausedRef.current = true; }}
            onMouseLeave={() => { tPausedRef.current = false; }}
            onPointerDown={(e) => {
              dragRef.current = { active: true, startX: e.clientX };
              setDragging(true);
              tPausedRef.current = true;
              e.currentTarget.setPointerCapture?.(e.pointerId);
            }}
            onPointerMove={(e) => {
              if (!dragRef.current.active) return;
              setDragDX(e.clientX - dragRef.current.startX);
            }}
            onPointerUp={(e) => {
              if (!dragRef.current.active) return;
              const dx = e.clientX - dragRef.current.startX;
              const step = tCardW + T_GAP;
              let moved = step ? Math.round(-dx / step) : 0;
              // A short flick (under half a card) still advances one in its direction.
              if (moved === 0 && Math.abs(dx) > 48) moved = dx < 0 ? 1 : -1;
              const lim = N_T - 1;
              moved = Math.max(-lim, Math.min(lim, moved));
              dragRef.current.active = false;
              setDragging(false);
              setDragDX(0);
              if (moved !== 0) setActiveT((a) => a + moved);
              tPausedRef.current = false;
              e.currentTarget.releasePointerCapture?.(e.pointerId);
            }}
            onPointerCancel={() => {
              dragRef.current.active = false;
              setDragging(false);
              setDragDX(0);
              tPausedRef.current = false;
            }}
            className="relative z-10 cursor-grab touch-pan-y select-none overflow-hidden rounded-[6px] py-12 outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 active:cursor-grabbing"
          >
            <div
              className={`flex ${tAnim && !dragging ? "transition-transform duration-700 ease-out motion-reduce:transition-none" : ""}`}
              style={{ transform: `translate3d(${tOffset + dragDX}px, 0, 0)`, columnGap: `${T_GAP}px` }}
            >
              {tW > 0 &&
                [...TESTIMONIALS, ...TESTIMONIALS, ...TESTIMONIALS].map((t, i) => {
                  const isActive = i === activeT;
                  return (
                    <figure
                      key={i}
                      style={{ width: `${tCardW}px` }}
                      className={`relative flex h-[14rem] flex-shrink-0 flex-col justify-between overflow-hidden rounded-[6px] p-7 text-left transition-[opacity,box-shadow,border-color] duration-500 sm:p-9 ${
                        isActive
                          ? "border border-black/5 bg-white opacity-100 shadow-[0_30px_70px_-30px_rgba(26,26,26,0.35)]"
                          : "border border-transparent bg-transparent opacity-40"
                      }`}
                    >
                      {/* Subtle orange accent line — only on the active card */}
                      {isActive && (
                        <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[3px] bg-primary" />
                      )}
                      {/* Quote — top-left, full width (font ~50% of before) */}
                      <blockquote className="text-[15px] font-semibold leading-snug text-ink sm:text-[18px]">
                        “{t.quote}”
                      </blockquote>
                      {/* Photo · name · profession — bottom-left (size unchanged) */}
                      <figcaption className="flex items-center gap-3">
                        <TAvatar src={t.avatar} name={t.name} />
                        <div>
                          <div className="text-sm font-semibold text-ink">{t.name}</div>
                          <div className="text-xs text-neutral-500">{t.role}</div>
                        </div>
                      </figcaption>
                    </figure>
                  );
                })}
            </div>
          </div>

          {/* Blueprint crosshairs (desktop) — at the middle cell's corners */}
          <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-12 top-12 z-20 hidden lg:block">
            {[
              "left-[28%] top-0 -translate-x-1/2 -translate-y-1/2",
              "left-[72%] top-0 -translate-x-1/2 -translate-y-1/2",
              "left-[28%] bottom-0 -translate-x-1/2 translate-y-1/2",
              "left-[72%] bottom-0 -translate-x-1/2 translate-y-1/2",
            ].map((pos) => (
              <Plus key={pos} size={18} className={`absolute ${pos} text-neutral-300`} />
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════ CALM ECONOMY / MANIFESTO ════════════════
         REMOVED from page (keep for later). Restore by deleting `{false && (`
         and its matching `)}` after </section>. */}
      {false && (
      <section id="manifesto" className="px-5 py-20 sm:px-8 lg:py-32">
        <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-12">
          <Reveal className="lg:col-span-4">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">
              The Calm Economy
            </p>
            <h2 className="mt-4 text-4xl leading-[1.05] text-ink sm:text-5xl">
              Work slower.
              <br />
              <span className="font-extrabold text-neutral-400">{feeOnly ? "Book smarter." : "Earn smarter."}</span>
            </h2>
          </Reveal>

          <Reveal delay={0.1} className="space-y-5 text-lg leading-relaxed text-neutral-600 lg:col-span-5">
            <p>Work shouldn't feel like warfare.</p>
            <p>
              You shouldn't need five tabs, three apps and a daily dose of anxiety
              to do the thing you actually love.
            </p>
            <p>
              Meeticulous is part of a new rhythm — where peace and profit can
              finally coexist. Less hustle. More flow.
            </p>
          </Reveal>

          <Reveal delay={0.18} className="lg:col-span-3">
            <ul className="space-y-4 border-l border-neutral-200 pl-6">
              {["Less hustle, more flow.", "Balance over burnout.", "Time earns better when it's calm.", "Quiet tools, loud results."].map(
                (t) => (
                  <li key={t} className="text-lg text-ink">
                    {t}
                  </li>
                )
              )}
            </ul>
          </Reveal>
        </div>
      </section>
      )}

      {/* ════════════════ WHY Meeticulous (dark) ════════════════ */}
      <section className="bg-ink px-5 py-20 text-white sm:px-8 lg:py-28">
        <div className="mx-auto max-w-6xl">
          <Reveal as="p" className="text-center text-sm font-medium uppercase tracking-[0.2em] text-primary">
            Why Meeticulous
          </Reveal>
          <Reveal as="h2" delay={0.05} className="mx-auto mt-3 max-w-[750px] text-center text-4xl text-white sm:text-5xl">
            Made for India. <span className="font-extrabold text-primary">Not adapted for it.</span>
          </Reveal>
          <Reveal as="p" delay={0.1} className="mx-auto mt-4 max-w-[750px] text-center text-base text-white/70">
            Most booking tools are built for the West and patched for India. Meeticulous starts from INR, GST and UPI — and works outward from there.
          </Reveal>
          <div className="mt-14 grid gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
            {whyCards.map((w, i) => (
              <Reveal key={w.title} delay={(i % 3) * 0.07}>
                <div className="flex h-full flex-col rounded-[6px] border border-white/10 bg-white/5 p-6 shadow-[0_8px_30px_rgba(0,0,0,0.3)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_22px_45px_-18px_rgba(0,0,0,0.6)] sm:p-7">
                  <span
                    className="flex h-12 w-12 items-center justify-center rounded-xl"
                    style={{
                      backgroundColor: `color-mix(in srgb, ${w.color} 22%, transparent)`,
                      color: `color-mix(in srgb, ${w.color} 60%, white)`,
                    }}
                  >
                    <w.icon size={22} />
                  </span>
                  <h3 className="mt-5 font-heading text-lg font-bold text-white">{w.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-white/60">{w.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════ PRICING (shared PricingCards — 4 plans) ════════════════ */}
      <section id="pricing" className="px-5 pb-12 pt-20 sm:px-8 lg:pb-16 lg:pt-28">
        <div className="mx-auto max-w-[1050px]">
          <Reveal as="h2" className="text-center text-4xl font-extrabold leading-tight text-ink sm:text-5xl">
            Simple pricing. <span className="text-primary">{feeOnly ? "Grow your practice." : "Zero commission."}</span>
          </Reveal>
          <Reveal as="p" delay={0.06} className="mx-auto mt-4 max-w-[750px] text-center text-neutral-500">
            Start free. Upgrade when your bookings demand it. Keep everything you earn — always.
          </Reveal>

          <Reveal delay={0.12} className="mt-8">
            <PricingCards />
          </Reveal>

          <p className="mt-8 text-center text-sm text-neutral-500">
            Not sure which plan? <span className="font-semibold text-ink">Start free</span> — you can upgrade in one click, anytime.
          </p>
          <p className="mt-4 text-center">
            <Link to="/pricing" className="text-sm font-semibold text-primary hover:text-primary-dark hover:underline">
              Compare all plans &amp; features →
            </Link>
          </p>
          <p className="mt-3 text-center text-xs text-neutral-500">
            {feeOnly
              ? "Prices in INR, excl. GST · Paid bookings & payouts launching soon · Cancel anytime"
              : "0% commission on paid plans · Prices in INR, excl. GST · ~2.4% payment gateway fee applies (not our charge) · Cancel anytime"}
          </p>
        </div>
      </section>

      {/* ════════════════ PRICING (legacy, hidden) ════════════════
         REMOVED from page (keep for later). Restore by deleting `{false && (`
         and its matching `)}` after </section>. Its id is `pricing-legacy` so it
         does not clash with the active section's `#pricing` — rename it back to
         `pricing` if you restore this as the canonical pricing section. */}
      {false && (
      <section id="pricing-legacy" className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-5xl">
          <Reveal as="h2" className="text-center text-4xl text-ink sm:text-5xl">
            Calm plans, no contracts.
          </Reveal>
          <Reveal as="p" delay={0.06} className="mt-4 text-center text-neutral-500">
            Cancel anytime. Start free, forever.
          </Reveal>

          {/* Top row: Pro + Studio */}
          <div className="mt-14 grid gap-5 md:grid-cols-2">
            {[
              {
                tier: "Pro Sloth",
                tagline: "For growing freelancers & coaches.",
                price: "₹499",
                period: "/ month",
                popular: true,
                perks: ["Unlimited bookings", "Payments + reminders", "Custom SlothPage", "AI calm assistant"],
              },
              {
                tier: "Studio Plan",
                tagline: "For agencies & multi-person studios.",
                price: "₹1,499",
                period: "/ month",
                perks: ["Everything in Pro", "Team calendars", "Multiple members", "Priority support"],
              },
            ].map((p, i) => (
              <Reveal key={p.tier} delay={i * 0.08}>
                <div
                  className={`relative flex h-full flex-col rounded-[2rem] p-8 ${
                    p.popular
                      ? "bg-ink text-white shadow-[0_30px_70px_-25px_rgba(26,26,26,0.6)]"
                      : "border border-black/5 bg-white"
                  }`}
                >
                  {p.popular && (
                    <span className="absolute right-6 top-6 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-white">
                      Most popular
                    </span>
                  )}
                  <h3 className="font-heading text-lg font-bold">{p.tier}</h3>
                  <p className={`mt-1 text-sm ${p.popular ? "text-white/60" : "text-neutral-500"}`}>
                    {p.tagline}
                  </p>
                  <div className="mt-6 flex items-end gap-1">
                    <span className="text-5xl">{p.price}</span>
                    <span className={`mb-1.5 text-sm ${p.popular ? "text-white/50" : "text-neutral-400"}`}>
                      {p.period}
                    </span>
                  </div>
                  <ul className="mt-6 flex-1 space-y-3">
                    {p.perks.map((perk) => (
                      <li key={perk} className="flex items-center gap-2.5 text-sm">
                        <Check size={16} className="text-primary" />
                        <span className={p.popular ? "text-white/80" : "text-neutral-600"}>{perk}</span>
                      </li>
                    ))}
                  </ul>
                  <Link
                    to={ROUTE_START}
                    className={`mt-8 inline-flex items-center justify-center rounded-full py-3 text-sm font-semibold transition-transform hover:no-underline ${
                      p.popular
                        ? "bg-primary text-white hover:bg-primary-dark"
                        : "bg-neutral-100 text-ink hover:bg-neutral-200"
                    }`}
                  >
                    Get started
                  </Link>
                </div>
              </Reveal>
            ))}
          </div>

          {/* Full-width Free Forever */}
          <Reveal delay={0.1} className="mt-5">
            <div className="flex flex-col items-center gap-6 rounded-[2rem] border border-black/5 bg-white p-8 sm:flex-row sm:justify-between sm:p-10">
              <div className="text-center sm:text-left">
                <h3 className="font-heading text-xl font-bold text-ink">Free Forever</h3>
                <p className="mt-1 max-w-sm text-sm text-neutral-500">
                  Everything you need to get booked and paid. No card, no catch.
                </p>
              </div>
              <div className="text-center">
                <span className="text-5xl text-ink">₹0</span>
                <p className="text-xs text-neutral-400">forever</p>
              </div>
              <Link
                to={ROUTE_START}
                className="inline-flex items-center gap-2 rounded-full bg-ink px-7 py-3.5 text-sm font-semibold text-white transition-transform hover:no-underline"
              >
                Get Started <ArrowRight size={15} />
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
      )}

      {/* ════════════════ FAQ ════════════════ */}
      <section id="faq" className="px-5 pb-20 pt-12 sm:px-8 lg:pb-28 lg:pt-16">
        <div className="mx-auto max-w-3xl">
          <Reveal as="p" className="text-center text-sm font-medium uppercase tracking-[0.2em] text-primary">
            FAQ
          </Reveal>
          <Reveal as="h2" delay={0.05} className="mx-auto mt-3 max-w-[750px] text-center text-4xl text-ink sm:text-5xl">
            Questions, answered.
          </Reveal>
          <Reveal as="p" delay={0.1} className="mx-auto mt-4 max-w-[750px] text-center text-base text-neutral-500">
            Still stuck? Write to us at{" "}
            <a href="mailto:bolt@meeticulous.in" className="font-semibold text-primary hover:no-underline">bolt@meeticulous.in</a>{" "}
            — we reply fast.
          </Reveal>
          <div className="mt-12 space-y-3">
            {faqs.map((f, i) => (
              <Reveal key={f.q} delay={Math.min(i * 0.04, 0.2)}>
                <div className="rounded-[6px] border border-black/5 bg-white px-6 shadow-[0_8px_30px_rgba(26,26,26,0.04)]">
                  <button
                    type="button"
                    id={`faq-q-${i}`}
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    aria-expanded={openFaq === i}
                    aria-controls={`faq-a-${i}`}
                    className="flex w-full cursor-pointer items-center justify-between gap-4 py-5 text-left font-heading text-base font-bold text-ink"
                  >
                    {f.q}
                    <Plus size={18} className={`flex-shrink-0 text-primary transition-transform duration-300 ${openFaq === i ? 'rotate-45' : ''}`} />
                  </button>
                  {openFaq === i && (
                    <p id={`faq-a-${i}`} role="region" aria-labelledby={`faq-q-${i}`} className="-mt-1 pb-5 text-sm leading-relaxed text-neutral-500">{f.a}</p>
                  )}
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════ COMPARISON / COMPETITORS (full-width dark band) ════════════════ */}
      {/* Hidden for now — re-enable once all comparison pages are ready by removing the {false && (...)} wrapper. */}
      {false && (
      <section className="bg-ink px-5 py-20 text-white sm:px-8 lg:py-28">
        <Reveal className="mx-auto max-w-7xl">
          <div className="lg:flex lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">Compare</p>
              <h2 className="mt-4 max-w-[750px] text-4xl leading-tight text-white sm:text-5xl">
                A calmer alternative to the tools you know.
              </h2>
            </div>
            <Link
              to={ROUTE_START}
              className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:no-underline lg:mb-2 lg:mt-0"
            >
              See for yourself <ArrowUpRight size={16} />
            </Link>
          </div>

          <div className="mt-10 grid grid-cols-2 border-l border-t border-white/10 lg:grid-cols-4">
            {COMPETITORS.map((c) => {
              const Tag = c.href ? Link : "div";
              const tagProps = c.href ? { to: c.href } : {};
              return (
                <Tag
                  key={c.name}
                  {...tagProps}
                  className={`group relative flex min-h-[170px] flex-col justify-between border-b border-r border-white/10 p-6 ${
                    c.soon ? "opacity-50" : c.href ? "transition-colors hover:bg-white/[0.04] hover:no-underline" : ""
                  }`}
                >
                  <div className="flex items-start justify-between">
                    {/* competitor icon vs Meeticulous icon — no white tile */}
                    <div className="flex items-center gap-1.5">
                      <img
                        src={`https://www.google.com/s2/favicons?sz=64&domain=${c.domain}`}
                        alt=""
                        loading="lazy"
                        className="h-7 w-7 object-contain"
                      />
                      <span className="text-xs font-medium text-white/40">vs</span>
                      <img
                        src="https://company-assets.meeticulous.in/images/email/sloth-icon-sqr.png"
                        alt="Meeticulous"
                        loading="lazy"
                        className="h-7 w-7 rounded-[6px] object-contain"
                      />
                    </div>
                    {c.soon ? (
                      <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/50">
                        Soon
                      </span>
                    ) : (
                      <ArrowUpRight size={18} className="text-white/40 transition-colors group-hover:text-white" />
                    )}
                  </div>
                  <p className="text-base font-semibold text-white">{c.name} vs Meeticulous</p>
                </Tag>
              );
            })}
          </div>

          <p className="mt-8 text-sm text-white/60">
            More comparisons coming. Want to see one?{" "}
            <a href="mailto:bolt@meeticulous.in?subject=Comparison%20request" className="font-semibold text-primary hover:no-underline">Tell us →</a>
            <span className="mt-2 block text-xs text-white/40">
              No mail app?{" "}
              <button
                type="button"
                onClick={(e) => {
                  navigator.clipboard?.writeText("bolt@meeticulous.in");
                  const b = e.currentTarget;
                  const prev = b.textContent;
                  b.textContent = "Copied!";
                  setTimeout(() => { b.textContent = prev; }, 1600);
                }}
                className="font-semibold text-white/70 underline underline-offset-2 hover:text-white"
              >
                Copy our email
              </button>{" "}
              or visit the{" "}
              <Link to="/help" className="font-semibold text-white/70 underline underline-offset-2 hover:text-white">Help Center</Link>.
            </span>
          </p>
        </Reveal>
      </section>
      )}

      {/* ════════════════ TRUST & SECURITY ════════════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-6xl">
          <Reveal as="p" className="text-center text-sm font-medium uppercase tracking-[0.2em] text-primary">
            Trust & security
          </Reveal>
          <Reveal as="h2" delay={0.05} className="mx-auto mt-3 max-w-[750px] text-center text-4xl text-ink sm:text-5xl">
            Your money and data, <span className="font-extrabold text-primary">handled carefully.</span>
          </Reveal>
          <Reveal as="p" delay={0.1} className="mx-auto mt-4 max-w-[750px] text-center text-base text-neutral-500">
            The unsexy-but-important stuff — done right.
          </Reveal>
          <div className="mt-14 grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-5">
            {TRUST.map((t, i) => (
              <Reveal key={t.title} delay={(i % 5) * 0.06}>
                <div className="flex h-full flex-col items-center rounded-[6px] border border-black/5 bg-white p-6 text-center shadow-[0_8px_30px_rgba(26,26,26,0.04)]">
                  <span
                    className="flex h-12 w-12 items-center justify-center rounded-xl"
                    style={{
                      backgroundColor: `color-mix(in srgb, ${t.color} 12%, transparent)`,
                      color: t.color,
                    }}
                  >
                    <t.icon size={22} />
                  </span>
                  <h3 className="mt-4 font-heading text-sm font-bold text-ink">{t.title}</h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-neutral-500">{t.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>

          {/* How we use Google — plain-language version of the OAuth consent
              screen, for hosts (and Google's verification reviewers). */}
          <Reveal delay={0.1} className="mt-12">
            <div id="how-google" className="mx-auto max-w-6xl scroll-mt-24 rounded-[6px] border border-black/5 bg-white p-6 shadow-[0_8px_30px_rgba(26,26,26,0.04)] sm:p-8 lg:p-10">
              <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
                {/* LEFT — icon + headline + intro */}
                <div className="flex items-start gap-4">
                  <span
                    className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-xl sm:flex"
                    style={{ backgroundColor: "color-mix(in srgb, #ea4335 12%, transparent)", color: "#ea4335" }}
                  >
                    <Calendar size={22} />
                  </span>
                  <div>
                    <h3 className="font-heading text-lg font-bold text-ink">How Meeticulous uses Google</h3>
                    <p className="mt-2 text-sm leading-relaxed text-neutral-500">
                      Hosts sign in with Google — no passwords to remember or leak. With your permission,
                      Meeticulous connects to your Google Calendar so your availability and bookings stay
                      in sync. We request only the minimum permissions needed:
                    </p>
                  </div>
                </div>

                {/* RIGHT — the permissions (bullet points) */}
                <ul className="space-y-3">
                  {GOOGLE_SCOPES.map((s) => (
                    <li key={s.scope} className="flex items-start gap-2.5">
                      <Check size={16} className="mt-0.5 shrink-0 text-primary" />
                      <p className="text-sm leading-relaxed text-neutral-500">
                        <span className="font-semibold text-ink">{s.name}</span>{" "}
                        <span className="rounded-[4px] bg-black/5 px-1.5 py-0.5 font-mono text-[11px] text-neutral-500">{s.scope}</span>{" "}
                        — {s.desc}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>

              {/* BOTTOM — full-width policy / revoke note */}
              <p className="mt-8 border-t border-black/5 pt-6 text-sm leading-relaxed text-neutral-500">
                Your Google data is used only to provide these scheduling features — never for advertising,
                never sold. You can revoke access at any time from your{" "}
                <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline">
                  Google Account settings
                </a>
                . Meeticulous's use of information received from Google APIs adheres to the{" "}
                <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline">
                  Google API Services User Data Policy
                </a>
                , including the Limited Use requirements. Read more in our{" "}
                <Link to="/privacy" className="font-medium text-primary hover:underline">Privacy Policy</Link>.
              </p>
            </div>
          </Reveal>

          <p className="mx-auto mt-10 max-w-[750px] text-center text-sm font-medium text-ink">
            Meeticulous does not sell or share your data with third parties. <span className="text-primary">Ever.</span>
          </p>
        </div>
      </section>

      {/* ════════════════ NEWSLETTER ════════════════
         REMOVED from page (keep for later). Restore by deleting `{false && (`
         and its matching `)}` after </section>. */}
      {false && (
      <section id="newsletter" className="px-5 py-20 sm:px-8">
        <Reveal className="mx-auto max-w-4xl overflow-hidden rounded-[2.5rem] bg-sand">
          <div className="grid items-center gap-8 p-8 sm:p-12 lg:grid-cols-2">
            <div>
              <h2 className="text-3xl text-ink sm:text-4xl">
                Letters from the calm side.
              </h2>
              <p className="mt-3 max-w-sm text-neutral-500">
                Tips, templates and the occasional truth bomb — delivered weekly,
                quietly.
              </p>
              <form onSubmit={submitNewsletter} noValidate className="mt-6 flex flex-col gap-2 sm:flex-row">
                <label htmlFor="newsletter-email" className="sr-only">Email address</label>
                <input
                  id="newsletter-email"
                  type="email"
                  autoComplete="email"
                  placeholder="your@email.com"
                  value={emailInput}
                  onChange={(e) => {
                    setEmailInput(e.target.value);
                    if (newsletterState !== "idle") setNewsletterState("idle");
                  }}
                  aria-invalid={newsletterState === "err"}
                  className="!h-12 flex-1 rounded-full border border-black/5 bg-white px-5 text-sm focus:!border-primary"
                />
                <button
                  type="submit"
                  disabled={newsletterState === "loading"}
                  className="inline-flex items-center justify-center rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white transition-transform hover:bg-primary-dark disabled:opacity-60"
                >
                  {newsletterState === "loading" ? "Joining…" : "Join the Collective"}
                </button>
              </form>
              <p role="status" aria-live="polite" className="mt-3 text-xs text-neutral-500">
                {newsletterState === "ok"
                  ? "You’re in — welcome to the Collective."
                  : newsletterState === "err"
                  ? "Please enter a valid email address."
                  : "No spam. Unsubscribe anytime."}
              </p>
            </div>
            <div className="hidden overflow-hidden rounded-[1.5rem] lg:block">
              <img src={NEWSLETTER} alt="" loading="lazy" className="aspect-[4/3] w-full object-cover" />
            </div>
          </div>
        </Reveal>
      </section>
      )}

    </main>
  );
};

export default HomeArchive;

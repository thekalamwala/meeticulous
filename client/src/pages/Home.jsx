import { Link } from "react-router-dom";
import { useState, useRef, useEffect } from "react";
import {
  motion,
  useInView,
  AnimatePresence,
  useReducedMotion,
} from "framer-motion";
import {
  Search,
  CalendarCheck,
  Wallet,
  CreditCard,
  Mail,
  Globe,
  Users,
  IndianRupee,
  Sparkles,
  ArrowRight,
  Check,
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
  FolderKanban,
  Zap,
  Lock,
  Download,
  FileCheck,
  Eye,
  Camera,
  Dumbbell,
  Gamepad2,
  Bell,
  Clock,
  LayoutDashboard,
} from "lucide-react";
import { searchVendors, subscribeNewsletter } from "../services/api";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";
import useLenis from "../hooks/useLenis";
import { HostAvatar } from "../components/common/HostAvatar";
import Reveal from "../components/home/Reveal";
import AppointmentFlow from "../components/home/AppointmentFlow";
import AudienceCarousel from "../components/home/AudienceCarousel";
import IntegrationsMarquee from "../components/home/IntegrationsMarquee";
import BrandTrustStrip from "../components/home/BrandTrustStrip";
import ProblemGlyph from "../components/home/ProblemGlyph";
import { PERSONAS, NEWSLETTER } from "../components/home/images";
import { TESTIMONIALS } from "../data/testimonials";
import PricingCards from "../components/pricing/PricingCards";
import Seo from "../components/common/Seo";
import { ogCard } from "../config/ogImages";
// Real, consented testimonials shown on /wall-of-love — the honest basis for the
// SoftwareApplication reviewCount below. Derived (not hardcoded) so the schema
// count can never drift from what the site actually displays.
import { WALL_TWEETS, WALL_GOOGLE, WALL_LINKEDIN, WALL_INSTAGRAM } from "../data/wallOfLove";

const WALL_OF_LOVE_COUNT =
  WALL_TWEETS.length + WALL_GOOGLE.length + WALL_LINKEDIN.length + WALL_INSTAGRAM.length;

/* Hero headline is a single static line now — the old cycling-word typewriter
   ("Calmer / Smoother / …") was retired with the copy reposition. */

/* Real funnel routes — do not point CTAs anywhere else. */
const ROUTE_START = "/become-a-host";
const ROUTE_LOGIN = "/login-as-vendor";

/* ── Homepage SEO ──────────────────────────────────────────────────────────
   OG/Twitter image + Organization logo must be uploaded to these exact URLs
   on company-assets.meeticulous.in (1200×630 for OG). */
const SITE_URL = "https://meeticulous.com";
const OG_IMAGE = ogCard('home');

/* ── Hero honeycomb background (brand: bee + M) ──
   Pointy-top hexagon tile (side 18 → 31.18 × 54), 1px crimson #960D32 lines at
   ~5% opacity. Inline SVG data URI: no extra request, no JS, no layout shift,
   no LCP impact. Scrolls with the page (never background-attachment: fixed). */
const HIVE_TILE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='31.18' height='54' viewBox='0 0 31.18 54'%3E%3Cg fill='none' stroke='%23960D32' stroke-opacity='0.05' stroke-width='1'%3E%3Cpath d='M15.59 0L31.18 9V27L15.59 36L0 27V9Z'/%3E%3Cpath d='M15.59 36V54'/%3E%3C/g%3E%3C/svg%3E";
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
      "Meeticulous is appointment booking software for creators, professionals and independent coaches who sell their time — a booking page, online scheduling, upfront UPI payments, GST invoices and WhatsApp & email appointment reminders in one link.",
    offers: { "@type": "Offer", price: "0", priceCurrency: "INR" },
    // Users' rating of the product. ratingValue is the (uniformly 5★) sentiment of
    // the real, consented testimonials on /wall-of-love; reviewCount is DERIVED from
    // that same set (WALL_OF_LOVE_COUNT), so it stays truthful and in sync with what
    // the site actually displays. The prior hardcoded 176 was not backed by real
    // data — never hardcode or inflate this again.
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: "5",
      bestRating: "5",
      reviewCount: String(WALL_OF_LOVE_COUNT),
    },
  },
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Meeticulous",
    // Legal entity (source: /privacy, /terms). Mirrors ORG_LEGAL_NAME/ORG_CONTACT_POINT
    // in utils/seo.js — keep in sync. No address until the LLP's registered office is set.
    legalName: "Rajmudra Media LLP",
    url: SITE_URL,
    logo: ORG_LOGO,
    description:
      "The booking link that gets India's creators and professionals paid — bookings, UPI payments and reminders in one link.",
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer support",
      email: "team@meeticulous.com",
      availableLanguage: ["en", "hi"],
    },
  },
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Meeticulous",
    url: SITE_URL,
    description: "Appointment booking software for creators, pros & bros — scheduling, booking and payment, and appointment reminders in one link.",
    potentialAction: {
      "@type": "SearchAction",
      target: `${SITE_URL}/search?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  },
];

const EASE = [0.22, 1, 0.36, 1];

/* Google "G" mark — matches the button on /become-a-host. */
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
      width={44}
      height={44}
      className="h-11 w-11 flex-shrink-0 rounded-xl object-cover"
    />
  );
};


/* ════════════════════════════════════════════════════════════
   FEATURES (bento)
   ════════════════════════════════════════════════════════════ */
const FEATURES = [
  { icon: CreditCard, title: "Payments Built In", desc: "Clients pay up-front. Your time finally bills itself." },
  { icon: Mail, title: "Email Reminders", desc: "Gentle nudges so no session is ever forgotten." },
  { icon: Globe, title: "Personal booking page", desc: "A mini-site that books and bills on your behalf." },
  { icon: Users, title: "Light CRM", desc: "Notes, history, receipts — zero spreadsheets." },
  { icon: IndianRupee, title: "India First", desc: "GST, INR, UPI — built for how India pays." },
  { icon: Sparkles, title: "AI Assistant", desc: "Suggests slots, drafts briefs, sends thank-yous." },
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
  { icon: Users, value: "70+", label: "Professionals already on Meeticulous" },
  { icon: CalendarCheck, value: "150+", label: "Sessions booked" },
  { icon: Wallet, value: "₹50K+", label: "Processed through the platform" },
  { icon: Smile, value: "5 / 5", label: "Platform rating by hosts" },
];


/* ── Audience segmentation — Creators / Pros / Bros ──
   Rendered by components/home/AudienceCarousel. `learnMore` must point at a
   /for/<slug> page that exists (bespoke route or professionLandingData) —
   an unknown /for/<slug> 404s. */
const AUDIENCES = [
  {
    key: "creators",
    icon: Camera,
    title: "Creators",
    tagline: "Turn followers into paying clients.",
    desc: "Put one link in your bio and let people book shoots, 1:1 calls and paid sessions — or buy a digital download — without a single DM.",
    who: [
      { label: "Influencers" },
      { label: "Photographers", href: "/for/photographers" },
      { label: "Artists" },
      { label: "Workshop hosts" },
    ],
    points: ["Link-in-bio booking page", "Paid sessions & digital products", "UPI checkout at booking"],
    learnMore: "/for/photographers",
    color: "var(--c-pink)",
  },
  {
    key: "pros",
    icon: Briefcase,
    title: "Pros",
    tagline: "Bill for your expertise, not your admin.",
    desc: "Sell consults, audits and coaching calls that are paid before they start, sync with Google Calendar and come with a GST invoice.",
    who: [
      { label: "Consultants", href: "/for/business-consultant" },
      { label: "Coaches", href: "/for/life-coaches" },
      { label: "Freelancers", href: "/for/freelancers" },
      { label: "Designers" },
    ],
    points: ["Paid consults, upfront", "Google Calendar + Meet links", "Automatic GST invoices"],
    learnMore: "/for/freelancers",
    color: "var(--c-blue)",
  },
  {
    key: "bros",
    icon: Dumbbell,
    title: "Bros",
    tagline: "Run your side hustle like a business.",
    desc: "Training, coaching and mentoring sessions that fill themselves after work hours — paid by UPI, with WhatsApp reminders so people actually show up.",
    who: [
      { label: "Fitness trainers", href: "/for/fitness" },
      { label: "Gaming coaches" },
      { label: "Mentors" },
      { label: "Yoga instructors", href: "/for/yoga-instructors" },
    ],
    points: ["Early-morning & evening slots", "WhatsApp + email reminders", "Clients book without an account"],
    learnMore: "/for/fitness",
    color: "var(--c-emerald)",
  },
  {
    key: "educators",
    icon: GraduationCap,
    title: "Educators",
    tagline: "Fill your class calendar.",
    desc: "Tutors and teachers share one link for trial classes and regular sessions — online or in person, paid before the class starts.",
    who: [
      { label: "Tutors", href: "/for/tutors" },
      { label: "Music teachers" },
      { label: "Language coaches" },
      { label: "Exam mentors" },
    ],
    points: ["Online or in-person sessions", "Reminders for every class", "UPI checkout at booking"],
    learnMore: "/for/tutors",
    color: "var(--c-violet)",
  },
  {
    key: "wellness",
    icon: HeartPulse,
    title: "Wellness",
    tagline: "A calm, private way to book.",
    desc: "Therapists, yoga instructors and nutritionists let clients book and pay privately, with notes and history kept in one place.",
    who: [
      { label: "Therapists", href: "/for/therapists" },
      { label: "Yoga instructors", href: "/for/yoga-instructors" },
      { label: "Nutritionists", href: "/for/nutritionists" },
      { label: "Life coaches", href: "/for/life-coaches" },
    ],
    points: ["Private 1:1 bookings", "Client notes & history", "WhatsApp + email reminders"],
    learnMore: "/for/therapists",
    color: "var(--c-cyan)",
  },
];

/* ── Problems → fixes. Each card: a real pain, two fixes that are shipped
   capabilities (verified in server/), and a link to an existing route.
   `icon` + `tile` mirror the matching Navbar Features menu item (same glyph,
   same TILE_MAP tint); cards with no direct menu item use the closest one.
   `band` is the card's header background: the dark (-900) shade of the tile hue.
   `glyph` names the board-style icon in components/home/ProblemGlyph, drawn in
   `pastel` (the -200 tint of the same hue) with no tile behind it. ── */
const PROBLEMS = [
  {
    title: "Endless DMs to fix one time",
    fixes: ["Clients see your open slots and book one themselves.", "Busy times from Google Calendar never show up."],
    icon: CalendarCheck,
    tile: "bg-blue-100 text-blue-500",
    band: "bg-blue-900",
    glyph: "dms",
    pastel: "text-blue-200",
    link: { to: "/features/online-scheduling", label: "Online scheduling" },
  },
  {
    title: "Chasing payments after the call",
    fixes: ["Clients pay upfront by UPI, card or netbanking.", "Payments run through Razorpay at checkout."],
    icon: Wallet,
    tile: "bg-emerald-100 text-emerald-500",
    band: "bg-emerald-900",
    glyph: "wallet",
    pastel: "text-emerald-200",
    link: { to: "/features/payments", label: "Payments" },
  },
  {
    title: "No-shows that cost you an hour",
    fixes: ["Automatic WhatsApp and email reminders before every session.", "A confirmation goes out the moment they book."],
    icon: Bell,
    tile: "bg-amber-100 text-amber-500",
    band: "bg-amber-900",
    glyph: "bell",
    pastel: "text-amber-200",
    link: { to: "/features/notifications", label: "Notifications" },
  },
  {
    title: "Making invoices by hand",
    fixes: ["A GST invoice is generated for every paid booking.", "All your invoices live in one dashboard."],
    icon: Users,
    tile: "bg-red-100 text-red-500",
    band: "bg-red-900",
    glyph: "receipt",
    pastel: "text-red-200",
    link: { to: "/features/client-management", label: "Client management" },
  },
  {
    title: "Double bookings and calendar chaos",
    fixes: ["Two-way Google Calendar sync keeps one source of truth.", "Bookings land on your calendar with a Meet link."],
    icon: CalendarCheck,
    tile: "bg-pink-100 text-pink-500",
    band: "bg-pink-900",
    glyph: "clash",
    pastel: "text-pink-200",
    link: { to: "/features/google-calendar", label: "Google Calendar" },
  },
  {
    title: "Back-and-forth to reschedule",
    fixes: ["Reschedule from your dashboard; the client confirms by link.", "Clients can cancel from their own booking link."],
    icon: LayoutDashboard,
    tile: "bg-lime-100 text-lime-500",
    band: "bg-lime-900",
    glyph: "reschedule",
    pastel: "text-lime-200",
    link: { to: "/features/booking-pages", label: "Booking pages" },
  },
  {
    title: "Back-to-back, no breathing room",
    fixes: ["Add buffers between sessions automatically.", "Set weekly hours and block out days off."],
    icon: Clock,
    tile: "bg-violet-100 text-violet-500",
    band: "bg-violet-900",
    glyph: "break",
    pastel: "text-violet-200",
    link: { to: "/features/availability", label: "Availability" },
  },
  {
    title: "Fees that eat into every booking",
    fixes: ["Starter is free: we take 5% only when you get paid.", "Pro has 0% commission, so you keep every rupee."],
    icon: IndianRupee,
    tile: "bg-cyan-100 text-cyan-500",
    band: "bg-cyan-900",
    glyph: "fees",
    pastel: "text-cyan-200",
    link: { to: "/pricing", label: "Pricing" },
  },
];



/* ── FAQ ── */
const FAQS = [
  { q: "What is appointment booking software?", a: "It's a tool that lets clients book time with you on their own — they see your open slots, pick one and confirm, without messaging back and forth. Meeticulous adds the parts around the booking too: upfront payment, reminders, invoices and a client list." },
  { q: "Who is Meeticulous for?", a: "Anyone who sells their time or skills: creators like photographers, artists and influencers; pros like consultants, coaches, freelancers and designers; and independents like fitness trainers, gaming coaches and mentors. If you get paid per session, it fits." },
  { q: "Is Meeticulous really free?", a: "Yes. Starter costs nothing and has no time limit — unlimited services and bookings. We take 5% only when you actually get paid. Pro removes that commission for ₹1,179 a year (under ₹4 a day), which pays for itself once you're earning about ₹4,700 a month." },
  { q: "Do you charge commission?", a: "On Pro, no — you keep 100% of every booking. Starter (the free plan) charges 5% per transaction, and nothing when you have no bookings." },
  { q: "Can clients pay while booking?", a: "Yes — that's the whole point. Clients pay via UPI, card or netbanking at checkout. You get paid before the session starts." },
  { q: "Do clients need an account?", a: "No. Clients book and pay without creating an account." },
  { q: "Can I connect Google Calendar?", a: "Yes. Two-way sync — your availability updates automatically and bookings appear in your calendar in real time." },
  { q: "What Google permissions does Meeticulous request?", a: "Only the minimum needed for scheduling: create and manage booking events on your calendar, read your free/busy times so booked slots stay hidden, and read your calendar timezone once. Google data is used solely to provide these features — never for ads, never sold — and you can revoke access anytime from your Google Account settings." },
  { q: "Can I sell more than live sessions?", a: "Yes. Alongside 1:1 sessions you can list digital products — guides, templates or downloads — on the same booking page." },
  { q: "Is GST handled?", a: "Yes. GST invoices are generated automatically for every booking." },
  { q: "Will reminders reduce my no-shows?", a: "They help. Automatic email and WhatsApp reminders go out before every session, and because clients pay upfront, they're far more likely to turn up." },
  { q: "Can I cancel anytime?", a: "Yes. No contracts, no lock-in. Cancel from your dashboard whenever you like." },
  { q: "Can I move from another platform?", a: "Yes. Set up your services and share your new link — you can be live the same day." },
];

/* FAQPage schema — derived from FAQS so the markup can never drift from the
   answers actually rendered on the page. */
const FAQ_JSONLD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQS.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

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
  { icon: Lock, title: "Secure payments", desc: "Processed by Razorpay, India's trusted gateway.", color: "#7C3AED" },
  { icon: ShieldCheck, title: "SSL encrypted", desc: "Every page and payment is encrypted end to end.", color: "#0891B2" },
  { icon: Eye, title: "Privacy-first", desc: "Your data is yours. Never sold, never shared.", color: "#DB2777" },
  { icon: FileCheck, title: "You own your data", desc: "Clients, bookings and earnings always belong to you.", color: "#65A30D" },
  { icon: Download, title: "Export anytime", desc: "Download your data whenever you want to.", color: "#EA580C" },
];

/* ════════════════════════════════════════════════════════════
   PAGE
   ════════════════════════════════════════════════════════════ */
const Home = () => {
  useLenis();
  const { startVendorGoogleAuth } = useAuth();

  const faqs = FAQS;

  // ── Google-only host funnel — same entry as /become-a-host ──
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

  const [openFaq, setOpenFaq] = useState(null); // FAQ: single-open accordion

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

  const tFrac = tW >= 1024 ? 0.44 : tW >= 640 ? 0.6 : 0.84;
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
    <main id="top" className="home-wide overflow-x-clip bg-white text-ink">
      <Seo
        title="Appointment Booking Software for Creators, Pros & Bros — Meeticulous"
        description="Meeticulous is appointment booking software for creators, consultants, coaches, freelancers and fitness trainers. One link handles scheduling, upfront UPI payments, GST invoices and WhatsApp reminders — clients book and pay themselves. Free to start, built for India."
        keywords="appointment booking software, online booking system, booking software for creators, booking app for coaches, booking software for fitness trainers, appointment scheduling software, take payments for appointments, booking page, UPI booking, India"
        canonical={`${SITE_URL}/`}
        robots="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1"
        siteName="Meeticulous"
        locale="en_IN"
        themeColor="#960D32"
        ogTitle="Appointment booking software for creators, pros & bros"
        ogDescription="Get booked, paid and reminded — without the admin. One link for bookings, UPI payments, invoices and WhatsApp reminders."
        image={OG_IMAGE}
        jsonLd={[...HOME_JSONLD, FAQ_JSONLD]}
      />
      {/* ponytail: no BrandPreloader on the homepage — it was a fixed full-screen
          overlay gated on a post-hydration useEffect (fonts.ready + hero decode),
          which hid the already-prerendered hero until the JS bundle booted. On
          slow mobile that WAS the LCP (~6-10s). The hero is server-rendered, so
          it now paints immediately. Intro kept on profile pages. */}

      {/* ════════════════ HERO — centered, light (all breakpoints) ════════════════
         HubSpot/Calendly-style hierarchy: category eyebrow → keyword H1 →
         two-line promise → primary + secondary CTA → risk-reversal microcopy,
         then the product/photo panel below. One H1 for every breakpoint (the
         old dark split hero needed an h1/h2 mobile twin). */}
      <section className="relative overflow-hidden border-b border-black/10 px-5 pb-20 pt-16 sm:px-8 sm:pb-28 sm:pt-24 lg:pb-32 lg:pt-28">
        {/* Honeycomb pattern — hero only (brand: bee + M). Sits under the hero content, which is z-10. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: `url("${HIVE_TILE}")`,
            backgroundSize: "31.18px 54px",
            backgroundRepeat: "repeat",
          }}
        />

        <div className="relative z-10 mx-auto max-w-5xl text-center">

          {/* sm+: "Appointment booking software" holds one line (font scales with the
              viewport so it fits); phones wrap naturally at a readable size. */}
          <Reveal instant as="h1" delay={0.05} className="mx-auto max-w-[17ch] font-heading text-[clamp(2.4rem,8.5vw,4.75rem)] font-extrabold leading-[1.04] tracking-[-0.035em] text-ink sm:max-w-none sm:text-[clamp(2rem,5.5vw,4.25rem)]">
            <span className="sm:block sm:whitespace-nowrap">Appointment booking software</span>{" "}
            for creators, pros &amp; bros<span className="text-primary">.</span>
          </Reveal>

          <Reveal instant as="p" delay={0.12} className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-neutral-600 sm:mt-8 sm:text-lg">
            Get booked, paid and reminded — without the admin. One link turns your time, skills
            and services into paid bookings, with UPI checkout, WhatsApp reminders and GST invoices built in.
          </Reveal>

          {/* Google-only host funnel — fires the same flow as /become-a-host */}
          <Reveal instant delay={0.18} className="mt-8 sm:mt-10">
            <div className="mx-auto flex max-w-md flex-col items-stretch justify-center gap-3 sm:max-w-none sm:flex-row sm:items-center">
              <button
                onClick={startGoogle}
                disabled={googleLoading}
                className="btn inline-flex items-center justify-center gap-3 rounded-[6px] bg-primary px-6 py-3.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 sm:px-7 sm:py-4 sm:text-base"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-[4px] bg-white">
                  <GoogleIcon />
                </span>
                {googleLoading ? "Opening Google…" : "Create Your Free Booking Page"}
              </button>
            </div>
            <p className="mx-auto mt-4 max-w-md text-xs leading-relaxed text-neutral-500">
              By continuing, you agree to our{" "}
              <Link to="/terms" className="text-neutral-500 underline decoration-neutral-300 underline-offset-2 hover:text-ink">Terms &amp; Conditions</Link> and{" "}
              <Link to="/privacy" className="text-neutral-500 underline decoration-neutral-300 underline-offset-2 hover:text-ink">Privacy Policy</Link>.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ════════════════ COMPANY TRUST STRIP ════════════════
         Brand marquee right under the hero. Replaces the STATS proof strip
         (hidden, not deleted — STATS + Odometer stay exported above). */}
      <BrandTrustStrip />

      {/* ════════════════ WHO IT'S FOR — Creators / Pros / Bros ════════════════
         Audience carousel on a plain white band: the active audience sits
         centred and white, its neighbours faded either side (HubSpot-style). */}
      <section
        id="who-its-for"
        className="scroll-mt-24 overflow-hidden px-5 py-20 sm:px-8 lg:py-28"
      >
        <div className="mx-auto max-w-7xl">
          <Reveal as="h2" delay={0.05} className="mx-auto max-w-[780px] text-center text-4xl font-extrabold leading-tight text-ink sm:text-5xl">
            If you sell your time, <span className="text-primary-cta">it's bookable.</span>
          </Reveal>
          <Reveal as="p" delay={0.1} className="mx-auto mt-4 max-w-[640px] text-center text-base text-neutral-700">
            Sessions, shoots, consults, coaching or a downloadable guide. One page, paid before you start.
          </Reveal>

          <Reveal delay={0.12} className="mt-12 lg:mt-14">
            <AudienceCarousel audiences={AUDIENCES} />
          </Reveal>
        </div>
      </section>

      {/* ════════════════ PROBLEMS → FIXES ════════════════
         Names the pain before the product (HubSpot-style problem→solution
         bridge): the left column stays sticky (lg+) while the problem cards
         scroll past on the right. Every fix line is a shipped capability. */}
      <section className="border-y border-black/5 px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
            <div className="lg:sticky lg:top-28 lg:self-start">
              <Reveal as="h2" delay={0.05} className="text-4xl font-extrabold leading-tight text-ink sm:text-5xl">
                Selling your time shouldn't feel like <span className="text-primary-cta">a second job.</span>
              </Reveal>
              <Reveal as="p" delay={0.1} className="mt-5 max-w-md text-base leading-relaxed text-neutral-600 sm:text-lg">
                Most people who sell sessions run them on DMs, payment screenshots and memory.
                Meeticulous replaces that admin with one link that does it for you.
              </Reveal>
              <Reveal delay={0.15} className="mt-8 flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={startGoogle}
                  disabled={googleLoading}
                  className="btn inline-flex items-center justify-center gap-2 rounded-[6px] bg-primary px-6 py-3.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {googleLoading ? "Opening Google…" : "Start for free"}
                </button>
                <Link
                  to="/pricing"
                  className="inline-flex items-center justify-center rounded-[6px] border border-primary/40 bg-white px-6 py-3.5 text-sm font-semibold text-primary-cta transition-colors hover:border-primary hover:no-underline"
                >
                  See pricing
                </Link>
              </Reveal>
            </div>

            <ul className="grid gap-5 sm:grid-cols-2">
              {PROBLEMS.map((p, i) => (
                <Reveal as="li" key={p.title} delay={(i % 2) * 0.08}>
                  <div className="flex h-full flex-col overflow-hidden rounded-[10px] border border-black/5 bg-white shadow-[0_8px_30px_rgba(26,26,26,0.04)] transition-shadow duration-300 hover:shadow-[0_24px_60px_-28px_rgba(26,26,26,0.25)]">
                    {/* Dark header band — only the part above the first divider,
                        tinted with the dark (-900) shade of the card's icon colour */}
                    <h3 className={`flex items-center gap-3 ${p.band} px-6 py-5 font-heading text-lg font-bold leading-snug text-white sm:px-7`}>
                      <ProblemGlyph name={p.glyph} size={30} className={`flex-shrink-0 ${p.pastel}`} />
                      {p.title}
                    </h3>
                    <div className="flex flex-1 flex-col px-6 pb-6 sm:px-7">
                    <ul className="flex-1 space-y-3 pt-5">
                      {p.fixes.map((f) => (
                        <li key={f} className="flex items-start gap-2.5 text-[15px] leading-relaxed text-neutral-600">
                          <Check size={16} className="mt-1 flex-shrink-0 text-primary" />
                          {f}
                        </li>
                      ))}
                    </ul>
                    <Link
                      to={p.link.to}
                      className="group mt-5 inline-flex items-center gap-1.5 border-t border-black/5 pt-5 text-sm font-semibold text-ink hover:text-primary-cta hover:no-underline"
                    >
                      {p.link.label} <ArrowRight size={15} className="transition-transform duration-300 group-hover:translate-x-0.5" />
                    </Link>
                    </div>
                  </div>
                </Reveal>
              ))}
            </ul>
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
                        <span className="flex-shrink-0 text-sm font-semibold text-primary-cta">
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


      {/* ════════════════ HOW THE CALM WORKS ════════════════ */}
      <section id="how-it-works" className="scroll-mt-24 px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-7xl">
          <Reveal as="h2" delay={0.05} className="mx-auto max-w-[750px] text-center text-4xl font-extrabold leading-tight text-ink sm:text-5xl">
            Everything around the appointment, <span className="text-primary-cta">automated.</span>
          </Reveal>
          <Reveal as="p" delay={0.1} className="mx-auto mt-4 max-w-[680px] text-center text-base leading-relaxed text-neutral-500 sm:text-lg">
            Sessions are how you earn, but the admin around them eats your day. Meeticulous handles
            everything before, during and after each booking, so you can focus on the work itself.
          </Reveal>
          <Reveal delay={0.15} className="mt-8 flex justify-center">
            <button
              onClick={startGoogle}
              disabled={googleLoading}
              className="btn inline-flex items-center justify-center gap-2 rounded-[6px] bg-ink px-6 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {googleLoading ? "Opening Google…" : "Start for free"} <ArrowRight size={16} />
            </button>
          </Reveal>

          <Reveal delay={0.1} className="mt-12 lg:mt-14">
            <AppointmentFlow />
          </Reveal>
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


      {/* ════════════════ INTEGRATIONS (dark panel, two moving logo rows) ════════════════ */}
      <section id="integrations" className="px-3 py-10 sm:px-5 lg:px-8 lg:py-14">
        <IntegrationsMarquee onStart={startGoogle} loading={googleLoading} />
      </section>

      {/* ════════════════ TESTIMONIALS (CENTERED CAROUSEL) ════════════════ */}
      <section id="collective" className="overflow-hidden border-t border-black/5 px-5 pb-20 pt-20 sm:px-8 lg:pb-28 lg:pt-28">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal as="h2" delay={0.05} className="text-4xl font-extrabold leading-[1.05] tracking-tight text-ink sm:text-5xl">
            Don't take our word for it.
          </Reveal>
          <Reveal as="p" delay={0.1} className="mx-auto mt-4 max-w-[750px] text-base text-neutral-500">
            Coaches, consultants, creators and mentors already getting booked and paid.
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
                      // Inactive/duplicate slides are dimmed to opacity-40 (fails
                      // Lighthouse contrast) and the list is triplicated for the
                      // infinite loop — hide all but the active one from the a11y
                      // tree. Fixes the contrast audit AND stops screen readers
                      // reading every testimonial 3×. Purely visual otherwise.
                      aria-hidden={!isActive}
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
            <h2 className="mt-4 text-4xl leading-[1.05] text-ink sm:text-5xl">
              Work slower.
              <br />
              <span className="font-extrabold text-neutral-400">Earn smarter.</span>
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


      {/* ════════════ PRICING (shared PricingCards — Starter + Pro) ════════════ */}
      <section id="pricing" className="px-5 pb-12 pt-20 sm:px-8 lg:pb-16 lg:pt-28">
        <div className="home-text-wrap mx-auto max-w-[860px]">
          <Reveal as="h2" className="text-center text-4xl font-extrabold leading-tight text-ink sm:text-5xl">
            Simple pricing. <span className="text-primary-cta">No surprises.</span>
          </Reveal>
          <Reveal as="p" delay={0.06} className="mx-auto mt-4 max-w-[750px] text-center text-neutral-500">
            Start free — we take 5% only when you get paid. Go Pro for 0% commission and keep every rupee.
          </Reveal>

          <Reveal delay={0.12} className="mt-8">
            {/* Starter card in a brand shade (primary-dark) instead of the green */}
            <PricingCards freeAccent="#7A0A28" />
          </Reveal>

          <p className="mt-8 text-center">
            <Link to="/pricing" className="text-sm font-semibold text-primary-cta hover:text-primary-dark hover:underline">
              Compare all plans &amp; features →
            </Link>
          </p>
          <p className="mt-3 text-center text-xs text-neutral-500">
            0% commission on Pro · All prices include GST · ~2.4% payment gateway fee applies (not our charge) · Cancel anytime
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
                tier: "Pro",
                tagline: "For growing freelancers & coaches.",
                price: "₹499",
                period: "/ month",
                popular: true,
                perks: ["Unlimited bookings", "Payments + reminders", "Custom booking page", "AI calm assistant"],
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

      {/* ════════════════ COMPARISON / COMPETITORS (full-width dark band) ════════════════ */}
      {/* Hidden for now — re-enable once all comparison pages are ready by removing the {false && (...)} wrapper. */}
      {false && (
      <section className="bg-ink px-5 py-20 text-white sm:px-8 lg:py-28">
        <Reveal className="mx-auto max-w-7xl">
          <div className="lg:flex lg:items-end lg:justify-between">
            <div>
              <h2 className="mt-4 max-w-[750px] text-4xl leading-tight text-white sm:text-5xl">
                A calmer alternative to the tools you know.
              </h2>
            </div>
            <Link
              to={ROUTE_START}
              className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-primary-cta hover:no-underline lg:mb-2 lg:mt-0"
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
                        src="/brand/meeticulous-icon.svg"
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
            <a href="mailto:team@meeticulous.com?subject=Comparison%20request" className="font-semibold text-primary-cta hover:no-underline">Tell us →</a>
            <span className="mt-2 block text-xs text-white/40">
              No mail app?{" "}
              <button
                type="button"
                onClick={(e) => {
                  navigator.clipboard?.writeText("team@meeticulous.com");
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
      <section id="trust" className="border-y border-black/5 px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-6xl">
          <Reveal as="h2" delay={0.05} className="mx-auto max-w-[750px] text-center text-4xl font-extrabold leading-tight text-ink sm:text-5xl">
            Your money and data, <span className="text-primary-cta">handled carefully.</span>
          </Reveal>
          <Reveal as="p" delay={0.1} className="mx-auto mt-4 max-w-[750px] text-center text-base text-neutral-500">
            Payments, privacy and your data — the unsexy-but-important stuff, done right.
          </Reveal>

          <div className="mt-14 grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-5 [&>*:last-child]:col-span-2 lg:[&>*:last-child]:col-span-1">
            {TRUST.map((t, i) => (
              <Reveal key={t.title} delay={(i % 5) * 0.06}>
                <div
                  className="flex h-full flex-col items-center rounded-[6px] border border-black/5 bg-white p-6 text-center shadow-[0_8px_30px_rgba(26,26,26,0.04)]"
                >
                  <span
                    className="flex h-12 w-12 items-center justify-center rounded-xl"
                    style={{
                      backgroundColor: `color-mix(in srgb, ${t.color} 14%, white)`,
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
                        <span className="rounded-[4px] bg-black/5 px-1.5 py-0.5 font-mono text-[11px] text-neutral-600">{s.scope}</span>{" "}
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
                <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer" className="font-medium text-primary-cta hover:underline">
                  Google Account settings
                </a>
                . Meeticulous's use of information received from Google APIs adheres to the{" "}
                <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer" className="font-medium text-primary-cta hover:underline">
                  Google API Services User Data Policy
                </a>
                , including the Limited Use requirements. Read more in our{" "}
                <Link to="/privacy" className="font-medium text-primary-cta hover:underline">Privacy Policy</Link>.
              </p>
            </div>
          </Reveal>

          <p className="mx-auto mt-10 max-w-[750px] text-center text-sm font-medium text-ink">
            Meeticulous does not sell or share your data with third parties. <span className="text-primary-cta">Ever.</span>
          </p>
        </div>
      </section>

      {/* ════════════════ FAQ ════════════════ */}
      {/* Split view: heading column sticky on lg+, questions scroll with the
          page. Answers stay mounted and open via the grid-rows 0fr→1fr trick,
          so height animates smoothly with no layout jump (instant under
          prefers-reduced-motion). Single-open, same FAQS/FAQ_JSONLD as before. */}
      <section id="faq" className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[2fr_3fr] lg:gap-16">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <Reveal as="h2" delay={0.05} className="text-4xl font-extrabold leading-tight text-ink sm:text-5xl">
              Questions, <span className="text-primary-cta">answered.</span>
            </Reveal>
            <Reveal as="p" delay={0.1} className="mt-5 max-w-sm text-base leading-relaxed text-neutral-600">
              Still stuck? Write to us at{" "}
              <a href="mailto:team@meeticulous.com" className="font-semibold text-primary-cta hover:no-underline">team@meeticulous.com</a>{" "}
              — we reply fast.
            </Reveal>
            <Reveal delay={0.15} className="mt-6">
              <Link
                to="/contact"
                className="group inline-flex items-center gap-1.5 text-sm font-semibold text-ink hover:text-primary-cta hover:no-underline"
              >
                Still have questions? Contact us
                <ArrowRight size={15} className="transition-transform duration-300 group-hover:translate-x-0.5" />
              </Link>
            </Reveal>
          </div>

          <Reveal delay={0.05}>
            <ul className="border-t border-black/10">
              {faqs.map((f, i) => {
                const open = openFaq === i;
                return (
                  <li key={f.q} className="border-b border-black/10">
                    <button
                      type="button"
                      id={`faq-q-${i}`}
                      onClick={() => setOpenFaq(open ? null : i)}
                      aria-expanded={open}
                      aria-controls={`faq-a-${i}`}
                      className="flex w-full cursor-pointer items-center justify-between gap-6 rounded-[4px] py-5 text-left font-heading text-base font-bold text-ink transition-colors hover:text-primary-cta focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 sm:text-lg"
                    >
                      {f.q}
                      <Plus
                        size={20}
                        className={`flex-shrink-0 text-primary transition-transform duration-300 ease-out motion-reduce:transition-none ${open ? "rotate-45" : ""}`}
                      />
                    </button>
                    <div
                      id={`faq-a-${i}`}
                      role="region"
                      aria-labelledby={`faq-q-${i}`}
                      aria-hidden={!open}
                      inert={open ? undefined : ""}
                      className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none ${
                        open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                      }`}
                    >
                      <div className="overflow-hidden">
                        <p className="pb-6 pr-10 text-[15px] leading-relaxed text-neutral-600">{f.a}</p>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Reveal>
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

export default Home;

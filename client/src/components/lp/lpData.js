/* ════════════════════════════════════════════════════════════════════
   lpData.js — single source of content for /compare/topmate-alternative.

   HONESTY: Topmate facts come from data/competitors.js (checked against its
   pricing page, CHECKED_LABEL). Meeticulous prices/plan names come from
   data/plans.js — never type ₹235 / 5% / 0% here. Booking fee, gateway and
   TDS/TCS figures mirror /host-fees.

   PROFILES + COHORTS use real testimonial hosts (data/testimonials.js).
   ════════════════════════════════════════════════════════════════════ */
import { FREE_PLAN, PREMIUM_PLAN, PLAN_MATRIX } from "../../data/plans";
import { COMPETITORS, CHECKED_LABEL } from "../../data/competitors";

const CDN = "/images/testimonials";
const TM = COMPETITORS.topmate;
const inr = (n) => `₹${n.toLocaleString("en-IN")}`;
const ROW = (label) => PLAN_MATRIX.flatMap((g) => g.rows).find((r) => r.label === label);
const COMMISSION = ROW("Commission on your bookings");
// Free-plan limits as plans.js words them, e.g. "2 free services", "3 digital products".
const FREE_SERVICES = ROW("Free (₹0) services").free.tip.split(" — ")[0];
const FREE_PRODUCTS = ROW("Digital products").free.tip;
// Monthly sales at which a flat Pro fee equals Topmate's 10% cut.
const BREAKEVEN = PREMIUM_PLAN.monthly * 10;
export const PRICE_LINE = `${inr(PREMIUM_PLAN.monthly)} a month`;
export const PER_DAY_LINE = `under ₹4 a day billed yearly (${inr(PREMIUM_PLAN.yearly)} a year)`;

/* ─── Hero floating columns + creators carousel (placeholder creators) ─── */
export const PROFILES = [
  { name: "Mukesh Tidke",        tagline: "Coworking Space Owner",  img: `${CDN}/mukesh-tidke.webp`,        accent: "c-amber"   },
  { name: "Ar. Pranav Kadoo",    tagline: "Architect",              img: `${CDN}/pranav-kadoo.webp`,        accent: "c-emerald" },
  { name: "Vishal Chaware",      tagline: "Salesforce Developer",   img: `${CDN}/vishal-chaware.webp`,      accent: "c-blue"    },
  { name: "Sangharata Somkuvar", tagline: "DevOps Engineer",        img: `${CDN}/sangharata-somkuvar.webp`, accent: "c-violet"  },
  { name: "Dr. Yukta Bawankar",  tagline: "Physiotherapist",        img: `${CDN}/yukta-bawankar.webp`,      accent: "c-pink"    },
  { name: "Happy Singh",         tagline: "Creative Lead",          img: `${CDN}/happy-singh.webp`,         accent: "c-cyan"    },
  { name: "Arjun Ravikumar",     tagline: "Performance Marketeer",  img: `${CDN}/arjun-ravikumar.webp`,     accent: "c-blue"    },
  { name: "Tushar Malvi",        tagline: "Management Trainee, ECL", img: `${CDN}/tushar-malvi.webp`,       accent: "c-emerald" },
];

/* Two hero columns — column A scrolls up, column B scrolls down. */
export const HERO_COL_A = PROFILES.slice(0, 4);
export const HERO_COL_B = PROFILES.slice(4, 8);

/* ─── Block 2: "See what creators build" carousel cards ─── */
export const COHORTS = [
  { title: "Weekend Coworking Pass", blurb: "Book a cabin in seconds — no more 'is 4pm free?' WhatsApps.", tag: "Coworking · In person", name: "Mukesh Tidke",        img: `${CDN}/mukesh-tidke.webp`        },
  { title: "Site-Visit Bookings",     blurb: "Clients pick a slot and pay upfront — no WhatsApp date juggling.", tag: "1:1 · Design",       name: "Ar. Pranav Kadoo",    img: `${CDN}/pranav-kadoo.webp`       },
  { title: "Salesforce Audit Calls",  blurb: "Link out, slot picked, paid up-front. No money talk.",          tag: "1:1 · 45 min",       name: "Vishal Chaware",      img: `${CDN}/vishal-chaware.webp`     },
  { title: "Weekend Mentoring",       blurb: "Set it up once. Slots fill, money's already in.",                tag: "Mentoring · Recurring", name: "Sangharata Somkuvar", img: `${CDN}/sangharata-somkuvar.webp`},
  { title: "Recovery Sessions",       blurb: "Reminder texts help patients remember their slot.",              tag: "1:1 · Physio",       name: "Dr. Yukta Bawankar",  img: `${CDN}/yukta-bawankar.webp`     },
  { title: "Brand Power Hours",       blurb: "One link in the Insta bio. No GPay QR after the call.",          tag: "1:1 · Design",       name: "Happy Singh",         img: `${CDN}/happy-singh.webp`        },
];

/* ─── Block 4: interactive accordion (left preview swaps on open) ─── */
export const CAPABILITIES = [
  {
    title: "Offer 1:1 sessions",
    body: "Sell your time by the slot. Clients pick, pay up-front, and Google Meet links generate automatically.",
    preview: { kind: "session", title: "Strategy Call", meta: "Tomorrow · 5:00pm", price: "₹1,200", accent: "c-violet" },
  },
  {
    title: "Offer a free discovery call",
    body: `Let new clients book a free intro call before they pay. ${FREE_PLAN.name} includes ${FREE_SERVICES}; ${PREMIUM_PLAN.name} has no limit.`,
    preview: { kind: "free", title: "Free Discovery Call", meta: "15 min · Google Meet", price: "Free", accent: "c-pink" },
  },
  {
    title: "Meet clients in person",
    body: "Run in-person appointments at your studio, clinic or office with the same link, reminders and upfront payment.",
    preview: { kind: "offline", title: "Studio Session", meta: "Sat · 11:00am · In person", price: "₹599", accent: "c-amber" },
  },
  {
    title: "Get paid before the session",
    body: "Clients pay by UPI or card when they book. Meeticulous settles it to your Indian bank account after a one-time KYC, with a GST invoice for every paid booking.",
    preview: { kind: "paid", title: "Audit Call", meta: "45 min · Paid upfront", price: "₹1,999", accent: "c-emerald" },
  },
  {
    title: "Sell digital products",
    body: `Add a PDF, template or recording to your SlothPage and sell it next to your sessions. ${FREE_PLAN.name} includes ${FREE_PRODUCTS}.`,
    preview: { kind: "product", title: "GST Filing Playbook (PDF)", meta: "Download after payment", price: "₹799", accent: "c-blue" },
  },
];

/* ─── Block 5: testimonials (reused from Home.jsx — real hosts) ─── */
export const TESTIMONIALS = [
  { quote: "Half my day used to go in 'is a cabin free at 4?' WhatsApps. Now people just book it themselves.", name: "Mukesh Tidke", role: "Coworking Space Owner", avatar: `${CDN}/mukesh-tidke.webp` },
  { quote: "Clients book site-visit slots straight off my link and pay upfront. No more chasing dates over WhatsApp.", name: "Ar. Pranav Kadoo", role: "Architect", avatar: `${CDN}/pranav-kadoo.webp` },
  { quote: "I send the link, they pick a slot, payment's sorted before the call. No more awkward money talk.", name: "Vishal Chaware", role: "Salesforce Developer", avatar: `${CDN}/vishal-chaware.webp` },
  { quote: "Set up my weekend mentoring in one evening and kind of forgot about it. Slots fill, money's already in.", name: "Sangharata Somkuvar", role: "DevOps Engineer", avatar: `${CDN}/sangharata-somkuvar.webp` },
  { quote: "My patients forget appointments easily. The reminder texts have honestly been a lifesaver.", name: "Dr. Yukta Bawankar", role: "Physiotherapist", avatar: `${CDN}/yukta-bawankar.webp` },
  { quote: "Stuck the link in my Insta bio. Looks way better than sending a GPay QR after the call.", name: "Happy Singh", role: "Creative Lead", avatar: `${CDN}/happy-singh.webp` },
  { quote: "Honestly I picked it because 0% commission. I charge for audits and Sloth doesn't take a cut.", name: "Arjun Ravikumar", role: "Performance Marketeer", avatar: `${CDN}/arjun-ravikumar.webp` },
  { quote: "I run mentoring calls on the side — slots fill, payment's sorted, zero admin after work hours.", name: "Tushar Malvi", role: "Management Trainee, ECL", avatar: `${CDN}/tushar-malvi.webp` },
];

/* ─── Block 6: bento grid ("What you get") ─── */
export const BENTO = [
  { big: COMMISSION.premium, label: `commission on ${PREMIUM_PLAN.name}`, sub: `A flat ${PRICE_LINE}, ${PER_DAY_LINE}.`, color: "c-pink", span: false },
  { big: COMMISSION.free, label: `on the free ${FREE_PLAN.name} plan`, sub: `Half of Topmate's 10%. Move to ${PREMIUM_PLAN.name} whenever it pays off.`, color: "c-violet", span: false },
  { big: "UPI", label: "and cards at booking", sub: "Razorpay checkout, settled to your Indian bank after a one-time KYC.", color: "c-blue", span: false },
  { big: "GST", label: "invoice on every paid booking", sub: "Sent automatically on both plans. No separate billing tool.", color: "c-emerald", span: false },
  { big: "1 link", label: "for everything you sell", sub: "Sign in with Google, claim your page, add services and share it.", color: "c-amber", span: false },
  { big: "24h", label: "reminders before each booking", sub: `Email on ${FREE_PLAN.name}. WhatsApp and 1-hour reminders on ${PREMIUM_PLAN.name}.`, color: "c-cyan", span: false },
];

/* ─── Block: Meeticulous vs Topmate comparison table ─────────────────
   Topmate cells say ONLY what Topmate's pricing page says (competitors.js,
   checked CHECKED_LABEL). `win`: true = Meeticulous advantage · null = parity
   or a different trade-off · false = Topmate's edge · "unlisted" = Topmate's
   pricing page doesn't say (rendered neutral, never as an X).
   ──────────────────────────────────────────────────────────────────── */
export const COMPARE_TM = [
  { f: "Commission on your sales", bas: `${COMMISSION.premium} on ${PREMIUM_PLAN.name}, ${COMMISSION.free} on ${FREE_PLAN.name}`, tm: "10% of each sale", win: true },
  { f: "Marketplace sales to new customers", bas: `Same as above`, tm: "20% of each sale", win: true },
  { f: "Pricing model", bas: `Flat ${PRICE_LINE} on ${PREMIUM_PLAN.name}`, tm: "No subscription, a cut of each sale", win: null },
  { f: "GST invoice on every paid booking", bas: "Yes, automatic", tm: "Not listed", win: "unlisted" },
  { f: "WhatsApp reminders", bas: `Yes, on ${PREMIUM_PLAN.name}`, tm: "Not listed", win: "unlisted" },
  { f: "Payments at booking", bas: "UPI and cards via Razorpay", tm: "Built in", win: null },
  { f: "Payout timing", bas: "After the session", tm: "Instant payouts", win: false },
  { f: "1:1 sessions and digital products", bas: "Yes", tm: "Yes", win: null },
  { f: "Public creator page", bas: "Yes (SlothPage)", tm: "Yes", win: null },
  { f: "Creator marketplace", bas: "Explore page, growing", tm: "Yes, larger today", win: false },
];

export const COMPARE_NOTE = `Checked against Topmate's pricing page in ${CHECKED_LABEL}.`;
export const COMPARE_SOURCE = TM.source;

/* ─── Block 7: FAQ (answer-first, facts only; feeds the FAQPage JSON-LD) ─── */
export const FAQ = [
  { q: "Is Meeticulous a good Topmate alternative?", a: `Yes, if you want to stop paying commission. Meeticulous takes ${COMMISSION.premium} commission on ${PREMIUM_PLAN.name} for a flat ${PRICE_LINE}, or ${COMMISSION.free} on the free ${FREE_PLAN.name} plan. Clients pay by UPI or card at booking and every paid booking gets a GST invoice. Topmate takes 10% of each sale, with no subscription.` },
  { q: "How much commission does Topmate take?", a: `Topmate's pricing page lists 10% of each sale made through your profile or link, and 20% on marketplace sales to new customers (checked ${CHECKED_LABEL}). Meeticulous takes ${COMMISSION.free} on the free ${FREE_PLAN.name} plan and ${COMMISSION.premium} on ${PREMIUM_PLAN.name}.` },
  { q: "When does Pro cost less than Topmate?", a: `Once you sell more than about ${inr(BREAKEVEN)} a month. At that point Topmate's 10% equals the flat ${PRICE_LINE} for ${PREMIUM_PLAN.name}, and every rupee above it costs you nothing extra in commission. Below that, the free ${FREE_PLAN.name} plan at ${COMMISSION.free} costs less than Topmate's 10%.` },
  { q: "Are there any other fees on Meeticulous?", a: `Your client pays a flat ₹10 + GST booking fee on each paid booking. The payment gateway charge (about 2%) is passed through at cost, and TDS 1% and TCS 1% are deducted on payout as Indian tax law requires. On a ₹1,000 booking on ${PREMIUM_PLAN.name} you receive ₹959.76.` },
  { q: "Can my clients pay by UPI, and do I get paid in rupees?", a: "Yes. Clients pay upfront by UPI or card through Razorpay, and your earnings settle to your Indian bank account in rupees after a one-time KYC. There's no foreign-currency conversion." },
  { q: "Do I get GST invoices automatically?", a: `Yes. Meeticulous sends a GST invoice for every paid booking on both the ${FREE_PLAN.name} and ${PREMIUM_PLAN.name} plans, so you don't need a separate billing tool.` },
  { q: "How do payouts work?", a: "Clients pay upfront when they book. Meeticulous settles your earnings to your bank account after the session, once your one-time KYC is done. Topmate advertises instant payouts, so if same-day money matters most to you, that is a real difference." },
  { q: "How do I switch from Topmate?", a: "Sign in with Google, add your services and availability, then share your new SlothPage link. You can keep your Topmate page running while your clients move over." },
  { q: "Is Topmate better than Meeticulous for anything?", a: `Yes. Topmate has a larger creator marketplace today and advertises instant payouts, and it charges no subscription, which can suit you if you sell very little each month. Meeticulous suits you once commission starts to add up: ${COMMISSION.premium} commission for a flat ${PRICE_LINE}, GST invoices and WhatsApp reminders on ${PREMIUM_PLAN.name}.` },
];

/**
 * Marketing content for the /features/:slug pages. Pure data consumed by
 * FeaturePage.jsx. Every string is written without em dashes, and icons are
 * referenced by lucide-react name (mapped in FeaturePage's ICONS table).
 *
 * Per feature:
 *   accent / accentLight / darkBg  — piped in as CSS custom properties
 *   signature                      — 'coverflow' | 'timeline' | 'automation'
 *                                    (exactly one flow block per page)
 *   hero, heroMock, heroGlass, stats, benefits, (steps | timeline | automation),
 *   capabilities, product, useCases, testimonials, related, faq, cta, seo
 *
 * Brand palette (design-system.md): #2E1065 orange · #FF4D93 pink · #4AB765 green
 * · #F59E0B amber · #269CEF blue · #8B5CF6 violet · #0F1111 / #1A1D24 dark.
 */

// Shared social proof — generic host voices, reused across pages (as the
// homepage/about pages do). Swap for per-feature quotes later if needed.
const TESTIMONIALS = [
  { name: "Ananya Rao", role: "Independent Consultant", quote: "Meeticulous replaced three tools and the follow-up emails I used to send by hand. Clients book, pay and show up, and I just do the work." },
  { name: "Rahul Menon", role: "Fitness Coach", quote: "No-shows dropped the week I turned on reminders. The slot locks on payment, so my calendar is finally honest." },
  { name: "Kavya S.", role: "Math Tutor", quote: "Parents book lesson times themselves now. I stopped negotiating slots over WhatsApp at 11pm." },
];

export const FEATURES = [
  /* ══════════════════ 1. ONLINE SCHEDULING (coverflow) ══════════════════ */
  {
    slug: "online-scheduling",
    title: "Online Scheduling",
    tagline: "Online scheduling",
    description: "Give clients a link and let them pick a slot that actually works. Meeticulous checks your real availability, blocks double-bookings and confirms instantly, 24/7.",
    accent: "#269CEF", accentLight: "rgba(38,156,239,0.10)", darkBg: "#0F1111",
    signature: "coverflow",
    hero: {
      pre: "Free online appointment scheduling", accent: "software", post: "",
      sub: "Let clients book on your real availability while Meeticulous handles the confirmations, reminders and admin. No WhatsApp ping-pong, no double-bookings.",
      cta: "Get started free",
    },
    heroMock: { kind: "calendar", title: "Priya Nair, Discovery call", subtitle: "30 min", slots: [{ t: "10:00" }, { t: "11:30", on: true }, { t: "2:00" }, { t: "3:30 full", dim: true }, { t: "4:30" }, { t: "5:00" }], go: "Confirm and pay ₹1,500" },
    heroGlass: [
      { icon: "CalendarCheck", label: "New booking", value: "Confirmed, 4:30 PM", tint: "#269CEF" },
      { icon: "Wallet", label: "Payment received", value: "₹1,500", tint: "#4AB765" },
    ],
    stats: [
      { value: "24/7", label: "bookings without a phone call" },
      { value: "2x", label: "faster than manual DMs" },
      { value: "0", label: "double-bookings once live" },
    ],
    benefits: {
      heading: "Free appointment scheduling software that runs your calendar for you",
      lead: "“Are you free Tuesday?” “How about 4pm?” Every booking that starts as a chat ends as your admin.",
      without: [
        { title: "Endless WhatsApp threads", desc: "Ten messages just to lock one slot." },
        { title: "Manual availability checks", desc: "You juggle calendars, DMs and calls by hand." },
        { title: "Double bookings", desc: "Overlapping slots slip through when it is all manual." },
        { title: "No-shows", desc: "No reminders means wasted, empty slots." },
        { title: "Chasing payment", desc: "You follow up for money days after the session." },
      ],
      with: [
        { title: "One self-service link", desc: "Clients pick a slot themselves, 24/7, no messages." },
        { title: "Real-time availability", desc: "Your live calendar is always accurate." },
        { title: "Conflict-free slots", desc: "The first paid booking locks the time, so no overlaps." },
        { title: "Automatic reminders", desc: "WhatsApp and email nudges cut no-shows." },
        { title: "Paid upfront", desc: "Payment clears before the slot is ever held." },
      ],
    },
    stepsHeading: "From link to booked in a few steps",
    stepsLead: "Set it up once, then let clients do the rest.",
    steps: [
      { icon: "PenLine", title: "Set your services and hours", desc: "Add each service with its length, price and the hours you are open for it." },
      { icon: "Share2", title: "Share your link", desc: "Drop your booking page in your Instagram bio, emails or a DM." },
      { icon: "CalendarCheck", title: "Clients book themselves", desc: "They pick a time that works, 24/7, with no messages back and forth." },
      { icon: "Wallet", title: "They pay to confirm", desc: "The slot locks the moment payment clears, so your calendar stays accurate." },
      { icon: "BellRing", title: "Everyone gets reminded", desc: "Automatic confirmations and reminders go out to both sides." },
    ],
    capabilities: [
      { icon: "Clock", title: "Real-time availability", body: "Clients only see slots you are free for, pulled live from your calendar and existing bookings." },
      { icon: "CalendarClock", title: "Buffers and durations", body: "Set prep time before and after each service so back-to-back calls never crowd you." },
      { icon: "Layers", title: "Multiple service types", body: "A 15 minute discovery call and a 90 minute workshop from one page, each with its own rules." },
      { icon: "Zap", title: "Instant confirmation", body: "The moment a client books, both of you get a confirmation, with no approval step." },
      { icon: "Globe", title: "Built for Indian time zones", body: "Clients in Dubai or New York see slots in their own local time, converted automatically." },
      { icon: "Users", title: "Group sessions", body: "Cap a workshop at a fixed number of seats, so classes work like one-to-ones." },
    ],
    product: {
      eyebrow: "See it live", heading: "Your booking page, working",
      body: "This is the page your client actually sees: your services, your live slots and a pay button. Nothing to build, nothing to chase.",
      mock: { kind: "calendar", title: "meeticulous.com/priya", subtitle: "Live", slots: [{ t: "10:00" }, { t: "11:30" }, { t: "2:00", on: true }, { t: "3:30" }, { t: "4:30 full", dim: true }, { t: "5:00" }], go: "Confirm and pay" },
    },
    useCases: [
      { icon: "Sparkles", audience: "Coaches", description: "Let clients book a session without a single back-and-forth message." },
      { icon: "Briefcase", audience: "Consultants", description: "Offer a short paid discovery call and a longer strategy session from one page." },
      { icon: "GraduationCap", audience: "Tutors", description: "Let students or parents pick a lesson time that fits around classes." },
      { icon: "PenLine", audience: "Freelancers", description: "Take scoping calls on your terms, only in the hours you actually work." },
    ],
    testimonials: TESTIMONIALS,
    related: [
      { slug: "availability", label: "Set the hours clients can book", icon: "Clock" },
      { slug: "payments", label: "Collect payment when clients book", icon: "Wallet" },
      { slug: "google-calendar", label: "Sync every booking to your calendar", icon: "CalendarDays" },
      { slug: "notifications", label: "Send automatic confirmations and reminders", icon: "BellRing" },
    ],
    faq: [
      { q: "Do clients need an account to book?", a: "No. Guests book with just their phone number and an OTP, with no password and no app download." },
      { q: "Can I offer different durations for the same service?", a: "Yes. Each service can have its own duration, buffer time and pricing, all shown on your booking page." },
      { q: "What happens if two people try to book the same slot?", a: "The first confirmed payment locks the slot. Everyone else instantly sees it as unavailable, so there are no overlaps." },
      { q: "Is this only for one-on-one appointments?", a: "No. You can cap group sessions at a fixed number of seats, so workshops and classes work the same way." },
    ],
    cta: { headline: "Stop scheduling over WhatsApp.", subline: "Set up your booking page free in under 5 minutes. Clients book, pay and get reminded, and you just show up." },
    seo: {
      title: "Free Online Appointment Scheduling Software | Meeticulous",
      description: "Free online appointment scheduling software for India's creators — clients book themselves 24/7 on your real availability, with no double-bookings and instant confirmation.",
    },
  },

  /* ══════════════════ 2. BOOKING PAGES (timeline) ══════════════════ */
  {
    slug: "booking-pages",
    title: "Booking Pages",
    tagline: "Booking pages",
    description: "Your booking page lives at your own meeticulous.com/username, styled with your colours, photo and bio. Showcase every service and let it double as your creator page.",
    accent: "#2E1065", accentLight: "rgba(254,81,0,0.10)", darkBg: "#1A1D24",
    signature: "timeline",
    hero: {
      pre: "A free booking page for", accent: "freelancers", post: "",
      sub: "Not a bare scheduling widget. Your page shows who you are, what you offer and how to book, all at one link you can put anywhere.",
      cta: "Claim your link",
    },
    heroMock: { kind: "list", title: "meeticulous.com/priya", subtitle: "Live", rows: [
      { label: "Discovery call, 30 min", value: "₹1,500", tint: "#4AB765" },
      { label: "Strategy session, 90 min", value: "₹6,000", tint: "#4AB765" },
      { label: "Follow-up, 15 min", value: "Free", tint: "#269CEF" },
    ], go: "Book now" },
    heroGlass: [
      { icon: "Link2", label: "Your link", value: "meeticulous.com/priya", tint: "#2E1065" },
      { icon: "Star", label: "Rating", value: "4.9 from 120", tint: "#FFCC1C" },
    ],
    stats: [
      { value: "1", label: "link for bookings, bio and socials" },
      { value: "60s", label: "to set up a new page" },
      { value: "5+", label: "themes tailored to creators" },
    ],
    benefits: {
      heading: "A free booking page that sells for you, not a plain form",
      lead: "A generic widget with someone else's branding does not build much trust with a first-time client.",
      without: [
        { title: "Off-brand booking widgets", desc: "Your work looks like everyone else's." },
        { title: "A separate bio link", desc: "One tool for links, another for booking." },
        { title: "No context for new clients", desc: "Visitors cannot tell what you offer or why." },
        { title: "Prices hidden in DMs", desc: "People message just to ask what it costs." },
      ],
      with: [
        { title: "Your own branded page", desc: "Your photo, colours, bio and services in one place." },
        { title: "One permanent link", desc: "meeticulous.com/yourname works as your link-in-bio too." },
        { title: "Every service on show", desc: "Prices, durations and descriptions up front." },
        { title: "Built to convert on mobile", desc: "Most clients book from a phone, so the page is built for it." },
      ],
    },
    timeline: {
      heading: "From your link to a booked client",
      lead: "Tap any stop to see what happens along the way.",
      nodes: [
        { icon: "Link2", title: "Claim your link", desc: "Pick meeticulous.com/yourname. It is yours permanently." },
        { icon: "Briefcase", title: "Add your services", desc: "List each offering with its price, length and a short description." },
        { icon: "PenLine", title: "Add a bio and socials", desc: "A short intro plus your Instagram and LinkedIn, so the page works as a link-in-bio." },
        { icon: "Share2", title: "Share it anywhere", desc: "Instagram bio, email signature, a business card. One link does it all." },
        { icon: "CalendarCheck", title: "Visitors book", desc: "They pick a service and a time, and pay to confirm." },
      ],
    },
    capabilities: [
      { icon: "Sparkles", title: "Custom themes and colours", body: "Pick a palette that matches your brand instead of a one-size-fits-all template." },
      { icon: "Link2", title: "Your own permanent link", body: "meeticulous.com/yourname is easy to put on Instagram, a resume or a card." },
      { icon: "Layers", title: "Full service showcase", body: "List every offering with pricing, duration and a description clients can read before booking." },
      { icon: "Globe", title: "Mobile-first design", body: "Built to load fast and convert on the small screens most clients book from." },
      { icon: "Users", title: "Bio and socials", body: "Add a short bio and your social links so the page works as a link-in-bio too." },
      { icon: "Star", title: "Reviews on your page", body: "Your verified rating shows right where a new visitor decides to book." },
    ],
    product: {
      eyebrow: "See it live", heading: "One page, everything a client needs",
      body: "Services, prices, availability and a pay button, all on a page that looks like you and loads in a blink.",
      mock: { kind: "list", title: "Your services", subtitle: "3 live", rows: [
        { label: "Discovery call", value: "₹1,500", tint: "#4AB765" },
        { label: "Strategy session", value: "₹6,000", tint: "#4AB765" },
        { label: "Portfolio review", value: "₹3,000", tint: "#269CEF" },
      ], go: "Share your page" },
    },
    useCases: [
      { icon: "Sparkles", audience: "Creators", description: "Turn your bio link into a page that actually takes bookings." },
      { icon: "Briefcase", audience: "Consultants", description: "Present your services professionally without building a website." },
      { icon: "GraduationCap", audience: "Coaches", description: "Show your programs and let clients book the right one." },
      { icon: "PenLine", audience: "Freelancers", description: "Give prospects one link for who you are and how to book you." },
    ],
    testimonials: TESTIMONIALS,
    related: [
      { slug: "online-scheduling", label: "Let visitors pick a time", icon: "CalendarCheck" },
      { slug: "payments", label: "Take payment at checkout", icon: "Wallet" },
      { slug: "reviews", label: "Show ratings that build trust", icon: "Star" },
      { slug: "digital-products", label: "Sell products on the same page", icon: "Download" },
    ],
    faq: [
      { q: "Can I change my username later?", a: "Yes. Your old link keeps redirecting for a while so existing shares do not break." },
      { q: "Can I use my own domain?", a: "Custom domains are on the roadmap. Today every host gets a permanent meeticulous.com/username link." },
      { q: "How many services can I list?", a: "Starter includes up to 3 services. Paid plans raise or remove that cap." },
      { q: "Is the page fast on mobile?", a: "Yes. It is a mobile-first page built to load quickly even on slower connections." },
    ],
    cta: { headline: "Get a booking page that looks like you.", subline: "Claim your meeticulous.com link free, with no credit card needed." },
    seo: {
      title: "Free Booking Page for Freelancers & Creators | Meeticulous",
      description: "Create a free booking page at your own meeticulous.com link — services, pricing, bio and socials in one place, built mobile-first for freelancers and creators.",
    },
  },

  /* ══════════════════ 3. PAYMENTS (automation) ══════════════════ */
  {
    slug: "payments",
    title: "Payments & Invoicing",
    tagline: "Payments",
    description: "Every booking is paid upfront through Razorpay before it hits your calendar. GST-ready invoices generate automatically, so you never chase a payment or a receipt again.",
    accent: "#4AB765", accentLight: "rgba(74,183,101,0.10)", darkBg: "#1A1D24",
    signature: "automation",
    hero: {
      pre: "Online payments and", accent: "GST invoices", post: "for freelancers",
      sub: "Collect payment at checkout over UPI, cards, netbanking or wallets. An unpaid slot is never held, and every paid booking gets a GST invoice on its own.",
      cta: "Get started free",
    },
    heroMock: { kind: "list", title: "Payments", subtitle: "This week", rows: [
      { label: "Discovery call, Priya", value: "Paid ₹1,500", tint: "#4AB765" },
      { label: "Workshop, Aarav", value: "Paid ₹6,000", tint: "#4AB765" },
      { label: "Follow-up, Meera", value: "Settled", tint: "#269CEF" },
    ], go: "Download GST invoice" },
    heroGlass: [
      { icon: "IndianRupee", label: "Payment received", value: "₹6,000", tint: "#4AB765" },
      { icon: "Receipt", label: "GST invoice", value: "Generated", tint: "#269CEF" },
    ],
    stats: [
      { value: "0", label: "payment failures on verified UPI" },
      { value: "₹0", label: "setup fee to start accepting payments" },
      { value: "1-click", label: "GST invoice on every booking" },
    ],
    benefits: {
      heading: "GST invoices and upfront payment, without chasing money",
      lead: "The session is over, and now you are sending “just following up on the payment” for the third time.",
      without: [
        { title: "Chasing payment", desc: "You follow up for money days after the appointment." },
        { title: "Manual invoices", desc: "You type up receipts in a spreadsheet at tax time." },
        { title: "No-shows still cost you", desc: "Unpaid holds block real bookings." },
        { title: "Payment links everywhere", desc: "A separate link, sent by hand, for every client." },
      ],
      with: [
        { title: "Paid at checkout", desc: "UPI, cards, netbanking and wallets, before the slot is held." },
        { title: "Automatic GST invoices", desc: "A numbered, compliant invoice on every paid booking." },
        { title: "No unpaid holds", desc: "The slot only locks once payment clears." },
        { title: "One payout stream", desc: "See what has settled to your bank in one place." },
      ],
    },
    automation: {
      heading: "What happens the moment a client pays",
      lead: "Meeticulous handles the money admin so you can focus on the work.",
      nodes: [
        { icon: "CalendarCheck", label: "Booking made" },
        { icon: "CreditCard", label: "Payment verified" },
        { icon: "ShieldCheck", label: "Slot locked" },
        { icon: "Receipt", label: "GST invoice sent" },
        { icon: "Wallet", label: "Payout settles" },
      ],
      cards: [
        { icon: "CreditCard", title: "Every Indian payment method", desc: "Razorpay checkout supports UPI, cards, netbanking and wallets your clients already trust." },
        { icon: "Receipt", title: "Automatic GST invoices", desc: "Each paid booking produces a numbered, compliant invoice with nothing to type." },
        { icon: "RefreshCw", title: "One-click refunds", desc: "Cancel a booking and refund the original method directly, no bank transfer by hand." },
      ],
    },
    capabilities: [
      { icon: "CreditCard", title: "UPI, cards and netbanking", body: "Razorpay checkout supports every method Indian clients trust, with no separate payment link." },
      { icon: "Receipt", title: "Auto-generated GST invoices", body: "Every paid booking produces a sequentially numbered, compliant invoice with no manual entry." },
      { icon: "RefreshCw", title: "Subscription billing", body: "Set up recurring monthly or yearly packages and let Razorpay charge clients on renewal." },
      { icon: "Wallet", title: "Payout tracking", body: "See exactly how much has settled to your bank and what is still clearing, in one dashboard." },
      { icon: "ShieldCheck", title: "Verified before the slot locks", body: "Payment is captured securely before a booking is confirmed, so no unpaid holds." },
      { icon: "IndianRupee", title: "Priced in rupees", body: "Everything is in INR, from checkout to invoice to payout, built for India." },
    ],
    product: {
      eyebrow: "See it live", heading: "Payments and invoices, in one view",
      body: "Watch what is paid, what has settled and every invoice, without opening a separate payment app.",
      mock: { kind: "list", title: "Payments", subtitle: "Today", rows: [
        { label: "Priya, discovery call", value: "Paid", tint: "#4AB765" },
        { label: "Aarav, workshop", value: "Paid", tint: "#4AB765" },
        { label: "Meera, follow-up", value: "Refunded", tint: "#FF4D93" },
      ], go: "Download invoices" },
    },
    useCases: [
      { icon: "Briefcase", audience: "Consultants", description: "Take payment for advisory calls before they start, not after." },
      { icon: "Sparkles", audience: "Coaches", description: "Sell single sessions or paid packages through the same checkout." },
      { icon: "PenLine", audience: "Freelancers", description: "Collect a booking fee so a no-show costs the client, not you." },
      { icon: "Star", audience: "Creators", description: "Charge for paid 1:1s without setting up a separate payment link." },
    ],
    testimonials: TESTIMONIALS,
    related: [
      { slug: "online-scheduling", label: "Let clients book a time first", icon: "CalendarCheck" },
      { slug: "booking-pages", label: "Show services and prices", icon: "Layers" },
      { slug: "notifications", label: "Send receipts and reminders", icon: "MailCheck" },
      { slug: "analytics", label: "Track revenue over time", icon: "BarChart3" },
    ],
    faq: [
      { q: "Do I need my own Razorpay account?", a: "Meeticulous handles the payment processing. You just connect your bank account to receive payouts." },
      { q: "Are GST invoices automatic?", a: "Yes. Every paid booking generates a numbered, GST-compliant invoice you and your client can download instantly." },
      { q: "What happens if a payment fails?", a: "The booking simply is not confirmed. No slot is held on unpaid bookings, so your calendar stays accurate." },
      { q: "Can I offer monthly retainers?", a: "Yes. Subscription plans bill clients automatically every month or year through Razorpay." },
    ],
    cta: { headline: "Never chase a payment again.", subline: "Every booking is paid before it lands on your calendar." },
    seo: {
      title: "GST Invoice & Online Payments for Freelancers | Meeticulous",
      description: "Accept UPI, cards and netbanking with Razorpay and send auto-generated GST invoices for freelancers on every paid booking. Built for India.",
    },
  },

  /* ══════════════════ 4. AVAILABILITY (timeline) ══════════════════ */
  {
    slug: "availability",
    title: "Availability",
    tagline: "Availability",
    description: "Define your weekly hours, breaks and holidays once, and Meeticulous handles the rest, blocking booked slots, respecting buffers and adjusting for every client's timezone.",
    accent: "#8B5CF6", accentLight: "rgba(139,92,246,0.10)", darkBg: "#1A1D24",
    signature: "timeline",
    hero: {
      pre: "Set your availability for", accent: "online bookings", post: "",
      sub: "Your booking page stays accurate on its own, blocking booked time, respecting your buffers and converting slots to each client's local timezone.",
      cta: "Get started free",
    },
    heroMock: { kind: "calendar", title: "Your week", subtitle: "Working hours", slots: [{ t: "Mon 9-5", on: true }, { t: "Tue 9-5", on: true }, { t: "Wed off", dim: true }, { t: "Thu 9-5", on: true }, { t: "Fri 9-1", on: true }, { t: "Sat off", dim: true }], go: "Save schedule" },
    heroGlass: [
      { icon: "Clock", label: "Working hours", value: "Set once", tint: "#8B5CF6" },
      { icon: "CalendarOff", label: "Holiday", value: "Blocked", tint: "#FF4D93" },
    ],
    stats: [
      { value: "1x", label: "setup, applies every week after" },
      { value: "0", label: "manual availability updates" },
      { value: "24/7", label: "an accurate booking page" },
    ],
    benefits: {
      heading: "Set availability for online bookings once, not by hand",
      lead: "Opening and closing slots every week is exactly the admin you signed up to avoid.",
      without: [
        { title: "Weekly manual updates", desc: "You re-enter your availability again and again." },
        { title: "Forgotten blocks", desc: "You get booked during lunch or a day off." },
        { title: "Timezone maths", desc: "You convert times by hand for clients abroad." },
        { title: "Back-to-back overload", desc: "No buffers means no breathing room between calls." },
      ],
      with: [
        { title: "Set weekly hours once", desc: "Your schedule repeats automatically every week." },
        { title: "Buffers and breaks", desc: "Block lunch, travel and prep time between sessions." },
        { title: "Holiday blocking", desc: "Mark a date off and it disappears from your page instantly." },
        { title: "Automatic timezones", desc: "Clients abroad see slots in their own local time." },
      ],
    },
    timeline: {
      heading: "How your availability stays right",
      lead: "One setup, then it runs on its own. Tap any stop.",
      nodes: [
        { icon: "Clock", title: "Set weekly hours", desc: "Choose the hours you are open for bookings on each day." },
        { icon: "CalendarClock", title: "Add buffers and breaks", desc: "Block prep time, lunch and travel so you are never overbooked." },
        { icon: "CalendarOff", title: "Mark days off", desc: "A holiday or a one-off block disappears from your page instantly." },
        { icon: "Globe", title: "Convert timezones", desc: "Clients abroad automatically see your slots in their local time." },
        { icon: "CalendarCheck", title: "Clients see only free slots", desc: "Booked time blocks itself, so the page is always accurate." },
      ],
    },
    capabilities: [
      { icon: "Clock", title: "Weekly recurring hours", body: "Set your working hours for each day once, with no need to re-enter them every week." },
      { icon: "CalendarClock", title: "Buffers and breaks", body: "Block lunch, travel or prep time between sessions so your calendar never overbooks you." },
      { icon: "CalendarOff", title: "Holiday and leave blocking", body: "Mark a date off once and it disappears from your booking page across every service." },
      { icon: "Layers", title: "Per-service availability", body: "Offer a service only on weekends, or another only on weekday mornings, with independent rules." },
      { icon: "Globe", title: "Multi-timezone support", body: "Clients abroad see your availability converted to their own timezone, with no manual maths." },
      { icon: "CalendarDays", title: "Respects your calendar", body: "Any event on your connected Google Calendar blocks that time automatically." },
    ],
    product: {
      eyebrow: "See it live", heading: "Your week, set once",
      body: "Define your hours, buffers and days off, and every booking respects them without another thought from you.",
      mock: { kind: "calendar", title: "Working hours", subtitle: "Weekly", slots: [{ t: "Mon 9-5", on: true }, { t: "Tue 9-5", on: true }, { t: "Wed 9-1", on: true }, { t: "Thu off", dim: true }, { t: "Fri 9-5", on: true }, { t: "Sat 10-2", on: true }], go: "Save" },
    },
    useCases: [
      { icon: "Briefcase", audience: "Consultants", description: "Keep mornings for deep work and afternoons for calls." },
      { icon: "Sparkles", audience: "Coaches", description: "Offer weekend-only slots for a specific program." },
      { icon: "GraduationCap", audience: "Tutors", description: "Open only the evening hours you actually teach." },
      { icon: "PenLine", audience: "Freelancers", description: "Protect focus time while still taking bookings." },
    ],
    testimonials: TESTIMONIALS,
    related: [
      { slug: "online-scheduling", label: "Let clients book the open slots", icon: "CalendarCheck" },
      { slug: "google-calendar", label: "Block busy time from your calendar", icon: "CalendarDays" },
      { slug: "notifications", label: "Remind clients of their slot", icon: "BellRing" },
      { slug: "booking-pages", label: "Show availability on your page", icon: "Layers" },
    ],
    faq: [
      { q: "Can I set different hours for different services?", a: "Yes. Each service can carry its own availability rules layered on top of your general weekly hours." },
      { q: "What happens on days I mark as off?", a: "Those dates disappear from your booking page entirely, so clients simply cannot select them." },
      { q: "Does this respect my Google Calendar?", a: "Yes. Any event on your connected Google Calendar blocks that time automatically, on top of your set hours." },
      { q: "Can I block a single day temporarily?", a: "Yes. One-off blocks work alongside your recurring weekly schedule without changing it permanently." },
    ],
    cta: { headline: "Set your schedule once. Let it run itself.", subline: "Define your availability today and stop manually updating your calendar." },
    seo: {
      title: "Set Availability for Online Bookings | Meeticulous",
      description: "Set your availability for online bookings once — weekly hours, buffers and holidays. Your page stays accurate automatically, in every client's timezone.",
    },
  },

  /* ══════════════════ 5. GOOGLE CALENDAR (automation) ══════════════════ */
  {
    slug: "google-calendar",
    title: "Google Calendar Sync",
    tagline: "Google Calendar",
    description: "Connect Google Calendar once and Meeticulous reads your existing events to block busy time, while every new booking is pushed straight back with a Meet link attached.",
    accent: "#FF4D93", accentLight: "rgba(255,77,147,0.10)", darkBg: "#0F1111",
    signature: "automation",
    hero: {
      pre: "The Google Calendar", accent: "appointment scheduler", post: "",
      sub: "One calendar, not two. Meeticulous reads your events to block busy time and writes every booking back with a Google Meet link, automatically.",
      cta: "Connect your calendar",
    },
    heroMock: { kind: "list", title: "Google Calendar", subtitle: "Synced", rows: [
      { label: "Discovery call, Priya", value: "Meet link", tint: "#269CEF" },
      { label: "Dentist (personal)", value: "Busy", tint: "#FF4D93" },
      { label: "Workshop, Aarav", value: "Meet link", tint: "#269CEF" },
    ], go: "Open in Google Calendar" },
    heroGlass: [
      { icon: "CalendarDays", label: "Booking added", value: "To your calendar", tint: "#FF4D93" },
      { icon: "Video", label: "Meet link", value: "Attached", tint: "#269CEF" },
    ],
    stats: [
      { value: "1", label: "calendar to maintain, not two" },
      { value: "100%", label: "of bookings sync automatically" },
      { value: "<2s", label: "average sync time after booking" },
    ],
    benefits: {
      heading: "A Google Calendar appointment scheduler, not two half-right calendars",
      lead: "A personal event lands on your calendar, a client books that same hour on your page, and now you are double-booked.",
      without: [
        { title: "Two separate calendars", desc: "A booking calendar and a personal one, always out of step." },
        { title: "Clashes with personal time", desc: "Clients book over events you already had." },
        { title: "Manual Meet links", desc: "You create and paste a video link for every call." },
        { title: "Reschedules leave duplicates", desc: "Stray invites pile up when times change." },
      ],
      with: [
        { title: "Two-way sync", desc: "Bookings appear on Google Calendar, and your events block your page." },
        { title: "Free and busy blocking", desc: "A personal event instantly hides that slot from clients." },
        { title: "Auto Meet links", desc: "Every video booking gets a unique Google Meet link at confirmation." },
        { title: "Reschedules stay clean", desc: "The event updates in place, with no duplicate invites." },
      ],
    },
    automation: {
      heading: "What happens when calendars talk to each other",
      lead: "Connect once, and Meeticulous keeps both sides honest.",
      nodes: [
        { icon: "Link2", label: "Calendar connected" },
        { icon: "CalendarCheck", label: "Client books" },
        { icon: "CalendarDays", label: "Event written" },
        { icon: "Video", label: "Meet link attached" },
        { icon: "ShieldCheck", label: "Busy time blocked" },
      ],
      cards: [
        { icon: "RefreshCw", title: "Two-way sync", desc: "New bookings appear on Google Calendar, and events you add there block your booking page." },
        { icon: "Video", title: "Google Meet links", desc: "Every video booking gets a unique Meet link created and attached at confirmation time." },
        { icon: "ShieldCheck", title: "Free and busy blocking", desc: "A personal event or another meeting instantly hides that slot from clients." },
      ],
    },
    capabilities: [
      { icon: "RefreshCw", title: "Two-way sync", body: "New bookings appear on your Google Calendar, and events you add there block your booking page." },
      { icon: "ShieldCheck", title: "Free and busy blocking", body: "A personal event instantly hides that slot from clients, with no manual availability updates." },
      { icon: "Video", title: "Auto-generated Meet links", body: "Every video booking gets a unique Google Meet link created and attached at confirmation." },
      { icon: "CalendarDays", title: "One calendar, not two", body: "Your existing Google Calendar becomes the single source of truth for your time." },
      { icon: "RefreshCw", title: "Reschedules stay in sync", body: "When a client reschedules, the calendar event updates in place with no duplicate invites." },
      { icon: "ShieldCheck", title: "Minimal permissions", body: "Only calendar read and write access, never your inbox or your drive." },
    ],
    product: {
      eyebrow: "See it live", heading: "Your bookings, on the calendar you already use",
      body: "Every confirmed booking lands on Google Calendar with a Meet link, and every personal event blocks your page.",
      mock: { kind: "list", title: "Today", subtitle: "Synced", rows: [
        { label: "10:00 Discovery call", value: "Meet", tint: "#269CEF" },
        { label: "1:00 Lunch (personal)", value: "Busy", tint: "#FF4D93" },
        { label: "4:30 Strategy session", value: "Meet", tint: "#269CEF" },
      ], go: "Open calendar" },
    },
    useCases: [
      { icon: "Briefcase", audience: "Consultants", description: "Keep client calls and internal meetings on one calendar, never clashing." },
      { icon: "Sparkles", audience: "Coaches", description: "Block personal time so it never shows up as bookable." },
      { icon: "PenLine", audience: "Freelancers", description: "Avoid collisions between client calls and project deadlines." },
    ],
    testimonials: TESTIMONIALS,
    related: [
      { slug: "availability", label: "Layer booking hours on your calendar", icon: "Clock" },
      { slug: "online-scheduling", label: "Let clients book the free slots", icon: "CalendarCheck" },
      { slug: "notifications", label: "Send reminders for every event", icon: "BellRing" },
      { slug: "booking-pages", label: "Share one booking page", icon: "Link2" },
    ],
    faq: [
      { q: "Do I need Google Workspace?", a: "No. A free personal Gmail account works. You just connect it once from your dashboard settings." },
      { q: "What access does Meeticulous request?", a: "Only calendar read and write access needed for availability and event creation, never your inbox or drive." },
      { q: "Can I disconnect my calendar later?", a: "Yes. Revoke access anytime from your dashboard or Google account settings, with no impact on past bookings." },
      { q: "Does this work with Outlook?", a: "Google Calendar sync is live today. Outlook and iCal support is on our roadmap based on host demand." },
    ],
    cta: { headline: "Let your calendar do the blocking for you.", subline: "Connect Google Calendar in one click and never double-book again." },
    seo: {
      title: "Google Calendar Appointment Scheduler & Sync | Meeticulous",
      description: "A Google Calendar appointment scheduler with two-way sync, automatic Meet links and free/busy blocking — keep one calendar instead of two.",
    },
  },

  /* ══════════════════ 6. NOTIFICATIONS (automation) ══════════════════ */
  {
    slug: "notifications",
    title: "Notifications",
    tagline: "Notifications",
    description: "Automatic WhatsApp and email reminders keep every booking top of mind, from confirmation to a nudge an hour before. Reschedules and cancellations notify everyone instantly.",
    accent: "#F59E0B", accentLight: "rgba(245,158,11,0.12)", darkBg: "#1A1D24",
    signature: "automation",
    hero: {
      pre: "An automated appointment reminder", accent: "system", post: "",
      sub: "WhatsApp and email confirmations and reminders go out on their own, so clients show up and you never send another manual nudge.",
      cta: "Get started free",
    },
    heroMock: { kind: "list", title: "Notifications", subtitle: "Automatic", rows: [
      { label: "Booking confirmed", value: "Sent", tint: "#4AB765" },
      { label: "Reminder, 1 hr before", value: "Scheduled", tint: "#F59E0B" },
      { label: "Follow-up after session", value: "Queued", tint: "#269CEF" },
    ], go: "Turn on reminders" },
    heroGlass: [
      { icon: "MailCheck", label: "Confirmation", value: "Sent instantly", tint: "#4AB765" },
      { icon: "BellRing", label: "Reminder", value: "1 hr before", tint: "#F59E0B" },
    ],
    stats: [
      { value: "38%", label: "fewer no-shows with reminders on" },
      { value: "90%+", label: "WhatsApp message open rate" },
      { value: "3", label: "automatic touchpoints per booking" },
    ],
    benefits: {
      heading: "An automated appointment reminder system that ends no-shows",
      lead: "A client forgets, you sit waiting, and that hour is gone along with the money it should have made.",
      without: [
        { title: "Manual reminders", desc: "You text every client the day before, one by one." },
        { title: "No-shows", desc: "People forget appointments they booked weeks ago." },
        { title: "Confusion on changes", desc: "A reschedule leaves one side guessing." },
        { title: "Missed confirmations", desc: "Clients are unsure the booking even went through." },
      ],
      with: [
        { title: "Automatic confirmations", desc: "Both sides get a confirmation the moment a booking is made." },
        { title: "Reminders that cut no-shows", desc: "WhatsApp and email nudges before every session." },
        { title: "Instant change alerts", desc: "Reschedules and cancellations notify everyone at once." },
        { title: "Follow-ups on autopilot", desc: "A review request or rebooking nudge goes out after the session." },
      ],
    },
    automation: {
      heading: "Every message, sent for you",
      lead: "From the booking to the follow-up, the right message goes out on its own.",
      nodes: [
        { icon: "CalendarCheck", label: "Client books" },
        { icon: "MailCheck", label: "Confirmation sent" },
        { icon: "BellRing", label: "Reminder before" },
        { icon: "Clock", label: "Session happens" },
        { icon: "Repeat", label: "Follow-up sent" },
      ],
      cards: [
        { icon: "MessageCircle", title: "WhatsApp reminders", desc: "Clients get a message on the channel Indian clients check first, from a verified business number." },
        { icon: "Mail", title: "Email confirmations", desc: "Branded confirmation and receipt emails go out the moment payment clears." },
        { icon: "Repeat", title: "Automated follow-ups", desc: "After a session, clients get a review request or rebooking nudge automatically." },
      ],
    },
    capabilities: [
      { icon: "MessageCircle", title: "WhatsApp reminders", body: "Clients get a WhatsApp message before their booking, the channel they actually check first." },
      { icon: "Mail", title: "Email confirmations", body: "Branded confirmation and receipt emails go out the moment payment clears, with no follow-up needed." },
      { icon: "Repeat", title: "Automated follow-ups", body: "After a session ends, clients get a review request or rebooking nudge on your schedule." },
      { icon: "BellRing", title: "Reschedule and cancel alerts", body: "Any change to a booking notifies both sides immediately, so nobody shows up to an empty slot." },
      { icon: "Clock", title: "Custom reminder timing", body: "Choose how far ahead reminders fire, an hour before a call or a day before a workshop." },
      { icon: "ShieldCheck", title: "Email fallback", body: "If a client's number is unreachable, the email confirmation still goes out, so the record is never lost." },
    ],
    product: {
      eyebrow: "See it live", heading: "Every touchpoint, handled",
      body: "Confirmations, reminders and follow-ups go out automatically on WhatsApp and email, so you never chase a client again.",
      mock: { kind: "list", title: "For today's bookings", subtitle: "Auto", rows: [
        { label: "Confirmation to Priya", value: "Sent", tint: "#4AB765" },
        { label: "Reminder to Aarav", value: "In 1 hr", tint: "#F59E0B" },
        { label: "Follow-up to Meera", value: "Tomorrow", tint: "#269CEF" },
      ], go: "Edit reminders" },
    },
    useCases: [
      { icon: "Sparkles", audience: "Coaches", description: "Cut no-shows for sessions clients booked weeks in advance." },
      { icon: "GraduationCap", audience: "Tutors", description: "Remind parents the evening before a lesson." },
      { icon: "Briefcase", audience: "Consultants", description: "Send a calendar-worthy confirmation the moment a call is booked." },
      { icon: "PenLine", audience: "Freelancers", description: "Keep clients warm from the booking through to the follow-up." },
    ],
    testimonials: TESTIMONIALS,
    related: [
      { slug: "online-scheduling", label: "Take the booking that triggers it all", icon: "CalendarCheck" },
      { slug: "google-calendar", label: "Keep events synced across calendars", icon: "CalendarDays" },
      { slug: "client-management", label: "Keep a record of who you messaged", icon: "Users" },
      { slug: "reviews", label: "Turn the follow-up into a review", icon: "Star" },
    ],
    faq: [
      { q: "Do clients need to save a number to get WhatsApp reminders?", a: "No. Reminders arrive from our verified business number, with no need to save a contact." },
      { q: "Can I use only email?", a: "Yes. Notification channels are configurable per host from your dashboard settings." },
      { q: "What if a client's number is unreachable?", a: "The email confirmation still goes out as a fallback, so the booking record is never lost." },
      { q: "Are notifications plan-gated?", a: "Core booking confirmations are on every plan. Advanced follow-up flows scale with paid plans." },
    ],
    cta: { headline: "Let reminders chase your clients, not you.", subline: "Turn on WhatsApp and email notifications in your dashboard today." },
    seo: {
      title: "Automated Appointment Reminder System | Meeticulous",
      description: "An automated appointment reminder system that cuts no-shows — WhatsApp and email reminders for every booking, reschedule and cancellation.",
    },
  },

  /* ══════════════════ 7. CLIENT MANAGEMENT (timeline) ══════════════════ */
  {
    slug: "client-management",
    title: "Client Management",
    tagline: "Client management",
    description: "Every guest who books is saved automatically with their full booking history, so you always know who is new and who is coming back. No separate CRM to keep updated.",
    accent: "#2E1065", accentLight: "rgba(254,81,0,0.10)", darkBg: "#1A1D24",
    signature: "timeline",
    hero: {
      pre: "Free client management for", accent: "coaches", post: "",
      sub: "Everyone who books is saved automatically with their full history, so you know who is a first-timer and who is on their fifth session. No CRM to maintain.",
      cta: "Get started free",
    },
    heroMock: { kind: "list", title: "Clients", subtitle: "Auto-saved", rows: [
      { label: "Priya Nair", value: "5 bookings", tint: "#4AB765" },
      { label: "Aarav Shah", value: "New", tint: "#269CEF" },
      { label: "Meera Iyer", value: "3 bookings", tint: "#4AB765" },
    ], go: "Open client" },
    heroGlass: [
      { icon: "UserPlus", label: "New client", value: "Saved automatically", tint: "#2E1065" },
      { icon: "Repeat", label: "Repeat client", value: "5th booking", tint: "#4AB765" },
    ],
    stats: [
      { value: "Auto", label: "every client saved, no data entry" },
      { value: "1", label: "place for history, notes and contact" },
      { value: "₹0", label: "extra CRM subscription needed" },
    ],
    benefits: {
      heading: "Free client management for coaches, without a CRM to maintain",
      lead: "Client details scattered across chats, a notes app and your inbox is how you forget who is a regular.",
      without: [
        { title: "Scattered details", desc: "Names and numbers across chats and notebooks." },
        { title: "No booking history", desc: "You cannot recall what a client booked last time." },
        { title: "Manual data entry", desc: "You copy client info into a spreadsheet by hand." },
        { title: "Regulars go unnoticed", desc: "You treat a loyal client like a first-timer." },
      ],
      with: [
        { title: "Saved automatically", desc: "Anyone who books is added to your client list on their own." },
        { title: "Full booking history", desc: "Every past and upcoming appointment in one view." },
        { title: "Private notes", desc: "Add context before a call, visible only to you." },
        { title: "Repeat clients flagged", desc: "Spot loyal clients versus first-timers at a glance." },
      ],
    },
    timeline: {
      heading: "How your client list builds itself",
      lead: "You take bookings, and the records appear on their own. Tap any stop.",
      nodes: [
        { icon: "CalendarCheck", title: "A client books", desc: "Someone books through your page for the first time." },
        { icon: "UserPlus", title: "Saved automatically", desc: "They are added to your client list with no data entry." },
        { icon: "Layers", title: "History builds up", desc: "Every past and upcoming booking lines up under their name." },
        { icon: "PenLine", title: "You add notes", desc: "Keep private context before the next call, visible only to you." },
        { icon: "Repeat", title: "Repeat clients flagged", desc: "Loyal clients are marked, so you always know who is coming back." },
      ],
    },
    capabilities: [
      { icon: "Users", title: "Client history and notes", body: "See every past booking for a client in one view, with space for private notes before a call." },
      { icon: "Search", title: "Searchable contact database", body: "Every client who has ever booked is saved automatically, searchable by name, phone or email." },
      { icon: "Repeat", title: "Repeat-client tagging", body: "Instantly spot your loyal clients versus first-timers, right from your bookings list." },
      { icon: "Layers", title: "Full booking timeline", body: "Every past and upcoming appointment for a client lines up in order, with no digging through email." },
      { icon: "Download", title: "Export your client list", body: "Download your full client base anytime. It is your data, not locked into the platform." },
      { icon: "UserPlus", title: "Works for one-time guests", body: "Every guest is recorded the same way, whether it is their first booking or their fiftieth." },
    ],
    product: {
      eyebrow: "See it live", heading: "Your clients, without the busywork",
      body: "Everyone who books shows up here with their history and your notes, so you are always prepared for the next session.",
      mock: { kind: "list", title: "Clients", subtitle: "128 saved", rows: [
        { label: "Priya Nair", value: "Regular", tint: "#4AB765" },
        { label: "Aarav Shah", value: "New", tint: "#269CEF" },
        { label: "Meera Iyer", value: "Regular", tint: "#4AB765" },
      ], go: "Export list" },
    },
    useCases: [
      { icon: "Sparkles", audience: "Coaches", description: "Remember where each client left off before the next session." },
      { icon: "Briefcase", audience: "Consultants", description: "Keep context on every account in one place." },
      { icon: "PenLine", audience: "Freelancers", description: "Know a returning client's history before the call starts." },
    ],
    testimonials: TESTIMONIALS,
    related: [
      { slug: "online-scheduling", label: "Every booking builds the list", icon: "CalendarCheck" },
      { slug: "notifications", label: "Reach clients automatically", icon: "BellRing" },
      { slug: "reviews", label: "See feedback per client", icon: "Star" },
      { slug: "analytics", label: "Spot your repeat clients", icon: "BarChart3" },
    ],
    faq: [
      { q: "Do I need to add clients manually?", a: "No. Anyone who books through your page is added to your client list automatically, with full history." },
      { q: "Can I add private notes about a client?", a: "Yes. Notes are visible only to you and are saved against that client for every future booking." },
      { q: "Can I export my client list?", a: "Yes. Your client data belongs to you and can be exported at any time from your dashboard." },
      { q: "Does this work for one-time guests?", a: "Yes. Every guest is recorded the same way, whether it is their first booking or their fiftieth." },
    ],
    cta: { headline: "Know your clients without a separate CRM.", subline: "Every booking builds your client list automatically, starting today." },
    seo: {
      title: "Free Client Management for Coaches & Creators | Meeticulous",
      description: "Free client management for coaches and creators — keep client info, appointments and booking history in one place, with no separate CRM subscription.",
    },
  },

  /* ══════════════════ 8. DIGITAL PRODUCTS (automation) ══════════════════ */
  {
    slug: "digital-products",
    title: "Digital Products",
    tagline: "Digital products",
    description: "List ebooks, templates or recorded courses right next to your bookable services. Clients pay once through the same Razorpay checkout and get an instant, secure download link.",
    accent: "#269CEF", accentLight: "rgba(38,156,239,0.10)", darkBg: "#1A1D24",
    signature: "automation",
    hero: {
      pre: "Sell digital products", accent: "online", post: "alongside your services",
      sub: "Templates, ebooks and recorded courses on the same page as your bookings. One checkout, one payout stream, no separate store to run.",
      cta: "Get started free",
    },
    heroMock: { kind: "list", title: "Your products", subtitle: "On sale", rows: [
      { label: "Notion template pack", value: "₹499", tint: "#4AB765" },
      { label: "Recorded workshop", value: "₹1,200", tint: "#4AB765" },
      { label: "Starter checklist", value: "Free", tint: "#269CEF" },
    ], go: "Add a product" },
    heroGlass: [
      { icon: "Download", label: "Delivered", value: "Secure link sent", tint: "#269CEF" },
      { icon: "IndianRupee", label: "Sale", value: "₹499", tint: "#4AB765" },
    ],
    stats: [
      { value: "1", label: "checkout for products and bookings" },
      { value: "2MB", label: "max file size, kept fast for mobile" },
      { value: "₹0", label: "extra platform fee beyond your plan" },
    ],
    benefits: {
      heading: "Sell digital products online without a second storefront",
      lead: "You have a worksheet or a recorded workshop worth money, but a whole separate store for it is its own project.",
      without: [
        { title: "A separate store to run", desc: "Another tool, another login, another payout." },
        { title: "Manual delivery", desc: "You email the file by hand after each sale." },
        { title: "Two payout streams", desc: "Product money and booking money never line up." },
        { title: "Public file links", desc: "A shared link can be passed around for free." },
      ],
      with: [
        { title: "Products beside services", desc: "List a template right next to a consulting call." },
        { title: "Automatic delivery", desc: "A secure, expiring link goes out the moment they pay." },
        { title: "One payout stream", desc: "Products settle the same way as bookings." },
        { title: "Secure, expiring links", desc: "No public URLs that get shared around." },
      ],
    },
    automation: {
      heading: "What happens when someone buys",
      lead: "List it once, and every sale delivers itself.",
      nodes: [
        { icon: "Layers", label: "Product listed" },
        { icon: "CreditCard", label: "Client pays" },
        { icon: "Download", label: "Secure link sent" },
        { icon: "Receipt", label: "Sale recorded" },
        { icon: "BarChart3", label: "Revenue tracked" },
      ],
      cards: [
        { icon: "Download", title: "Instant secure delivery", desc: "Every purchase generates a unique, expiring download link, with no public file URLs." },
        { icon: "Layers", title: "Bundle with services", desc: "Offer a template pack alongside a consulting call, and let clients buy either or both." },
        { icon: "IndianRupee", title: "One payout stream", desc: "Money settles the same way as bookings, so there is one stream to track, not two." },
      ],
    },
    capabilities: [
      { icon: "Download", title: "One-time downloads", body: "Upload a PDF, template or resource pack once and sell it unlimited times, with no inventory." },
      { icon: "ShieldCheck", title: "Secure delivery links", body: "Every purchase generates a unique, expiring download link, so files cannot be shared around." },
      { icon: "Layers", title: "Bundle with services", body: "Offer a template pack alongside a call on the same page, and let clients buy either or both." },
      { icon: "CreditCard", title: "Instant payment on purchase", body: "Money settles the same way as bookings, through Razorpay, so there is one stream to track." },
      { icon: "BarChart3", title: "Sales analytics", body: "See which products are actually selling and how much revenue they add next to your bookings." },
      { icon: "Receipt", title: "Recorded with your bookings", body: "Every purchase appears in your dashboard alongside your regular bookings and payments." },
    ],
    product: {
      eyebrow: "See it live", heading: "Products and bookings, one page",
      body: "List a template or a recorded workshop next to your services, and let clients buy on the spot.",
      mock: { kind: "list", title: "Store", subtitle: "3 products", rows: [
        { label: "Template pack", value: "₹499", tint: "#4AB765" },
        { label: "Recorded course", value: "₹1,200", tint: "#4AB765" },
        { label: "Free checklist", value: "Free", tint: "#269CEF" },
      ], go: "Add product" },
    },
    useCases: [
      { icon: "Sparkles", audience: "Coaches", description: "Sell a workbook that complements your sessions." },
      { icon: "Briefcase", audience: "Consultants", description: "Package a template or checklist as a low-touch offer." },
      { icon: "PenLine", audience: "Creators", description: "Turn a guide or preset pack into repeatable income." },
    ],
    testimonials: TESTIMONIALS,
    related: [
      { slug: "payments", label: "Sell through the same checkout", icon: "CreditCard" },
      { slug: "booking-pages", label: "List products next to services", icon: "Layers" },
      { slug: "analytics", label: "See which products sell", icon: "BarChart3" },
      { slug: "client-management", label: "Know who bought what", icon: "Users" },
    ],
    faq: [
      { q: "What file types can I sell?", a: "PDFs, templates and other downloadable files up to 2MB, kept intentionally light for fast delivery." },
      { q: "Is this available on every plan?", a: "Digital products roll out to Studio-tier hosts first, with a wider release planned soon." },
      { q: "How do buyers receive their file?", a: "A secure download link is emailed instantly after payment confirms, with no manual sending on your end." },
      { q: "Can I see who bought what?", a: "Yes. Every purchase appears in your dashboard alongside your regular bookings and payments." },
    ],
    cta: { headline: "Turn your knowledge into a second income stream.", subline: "List your first digital product next to your services today." },
    seo: {
      title: "Sell Digital Products Online in India | Meeticulous",
      description: "Sell digital products online — ebooks, templates and courses — right beside your bookings, with secure instant delivery and one unified checkout.",
    },
  },

  /* ══════════════════ 9. REVIEWS (timeline) ══════════════════ */
  {
    slug: "reviews",
    title: "Reviews & Ratings",
    tagline: "Reviews and ratings",
    description: "After every completed booking, clients get a one-tap prompt to leave a review, verified against a real booking. Your rating shows right on your booking page.",
    accent: "#FF4D93", accentLight: "rgba(255,77,147,0.10)", darkBg: "#0F1111",
    signature: "timeline",
    hero: {
      pre: "Collect reviews from your", accent: "clients", post: "",
      sub: "A one-tap prompt after every session, tied to a real paid booking, so reviews cannot be faked. Your rating and testimonials show where new clients decide.",
      cta: "Get started free",
    },
    heroMock: { kind: "list", title: "Reviews", subtitle: "4.9 average", rows: [
      { label: "Priya, discovery call", value: "5 stars", tint: "#FFCC1C" },
      { label: "Aarav, workshop", value: "5 stars", tint: "#FFCC1C" },
      { label: "Meera, follow-up", value: "4 stars", tint: "#FFCC1C" },
    ], go: "See all reviews" },
    heroGlass: [
      { icon: "Star", label: "New review", value: "5 stars", tint: "#FFCC1C" },
      { icon: "ShieldCheck", label: "Verified", value: "Real booking", tint: "#4AB765" },
    ],
    stats: [
      { value: "4.9", label: "average rating across active hosts" },
      { value: "100%", label: "of reviews tied to a real booking" },
      { value: "2x", label: "conversion lift with 10+ reviews" },
    ],
    benefits: {
      heading: "Collect reviews from clients and let proof convince",
      lead: "A stranger deciding whether to book wants to know one thing: did this go well for someone like me?",
      without: [
        { title: "No social proof", desc: "New visitors have nothing to trust yet." },
        { title: "Screenshots of praise", desc: "Testimonials that anyone could have faked." },
        { title: "Reviews on other sites", desc: "Feedback lives where clients never see it." },
        { title: "Asking by hand", desc: "You remember to ask for a review only sometimes." },
      ],
      with: [
        { title: "Verified reviews only", desc: "Every review is tied to a real, paid booking." },
        { title: "Shown where it counts", desc: "Your rating appears right on your booking page." },
        { title: "Asked automatically", desc: "A prompt goes out once a session is complete." },
        { title: "You can respond", desc: "Reply publicly to show you are engaged." },
      ],
    },
    timeline: {
      heading: "How a session becomes proof",
      lead: "It happens on its own after every booking. Tap any stop.",
      nodes: [
        { icon: "CalendarCheck", title: "Session completed", desc: "A booking is marked complete once the session is done." },
        { icon: "MailCheck", title: "Review request sent", desc: "A one-tap prompt goes out to the client automatically." },
        { icon: "Star", title: "Client leaves a rating", desc: "One tap, tied to their real booking, with no account to create." },
        { icon: "ShieldCheck", title: "Verified as real", desc: "The review is linked to a genuine paid booking, so it cannot be faked." },
        { icon: "Sparkles", title: "Shown on your page", desc: "Your average rating and best testimonials appear where clients decide." },
      ],
    },
    capabilities: [
      { icon: "MailCheck", title: "Post-booking requests", body: "A review prompt goes out automatically once a session is marked complete, with nothing to remember." },
      { icon: "ShieldCheck", title: "Verified bookings only", body: "Every review is tied to a real, paid booking, so no anonymous drive-by ratings." },
      { icon: "Star", title: "Public rating on your page", body: "Your average rating and review count show directly where clients decide to book." },
      { icon: "MessageCircle", title: "Respond to reviews", body: "Reply publicly to any review, showing future clients you are engaged and easy to work with." },
      { icon: "Sparkles", title: "Showcase your best", body: "Pin standout reviews to the top of your page so they are the first thing a visitor reads." },
      { icon: "Users", title: "Two-way trust", body: "Reviews are bidirectional, so hosts can also rate guests, building trust on both sides." },
    ],
    product: {
      eyebrow: "See it live", heading: "Your rating, where clients look",
      body: "Verified reviews and your average rating show right on your booking page, warming up every new visitor.",
      mock: { kind: "list", title: "Your reviews", subtitle: "4.9 from 120", rows: [
        { label: "Great first session", value: "5 stars", tint: "#FFCC1C" },
        { label: "Very helpful", value: "5 stars", tint: "#FFCC1C" },
        { label: "Would book again", value: "5 stars", tint: "#FFCC1C" },
      ], go: "Share your page" },
    },
    useCases: [
      { icon: "Sparkles", audience: "Coaches", description: "Build a wall of proof from clients you have actually helped." },
      { icon: "Briefcase", audience: "Consultants", description: "Show verified outcomes to warm up new leads." },
      { icon: "PenLine", audience: "Freelancers", description: "Turn finished projects into social proof automatically." },
    ],
    testimonials: TESTIMONIALS,
    related: [
      { slug: "notifications", label: "Auto-send the review request", icon: "MailCheck" },
      { slug: "booking-pages", label: "Show ratings where clients decide", icon: "Layers" },
      { slug: "client-management", label: "See feedback per client", icon: "Users" },
      { slug: "online-scheduling", label: "Turn a booking into proof", icon: "CalendarCheck" },
    ],
    faq: [
      { q: "Can clients leave a review without booking?", a: "No. Every review requires a completed, verified booking, which keeps ratings honest and spam-free." },
      { q: "Can I remove a review I disagree with?", a: "You can respond publicly to any review, but reviews tied to genuine bookings cannot be deleted by hosts." },
      { q: "Do guests review hosts, or is it two-way?", a: "Reviews are bidirectional. Hosts can also rate guests, helping build trust on both sides of a booking." },
      { q: "Where do reviews show up?", a: "On your public booking page and in your dashboard, so you can track your rating trend over time." },
    ],
    cta: { headline: "Build trust before the first call even starts.", subline: "Turn every happy client into a public testimonial, automatically." },
    seo: {
      title: "Collect Reviews from Clients After Bookings | Meeticulous",
      description: "Collect reviews from clients automatically after every booking — verified, shown on your page, turning happy clients into proof that converts visitors.",
    },
  },

  /* ══════════════════ 10. ANALYTICS (coverflow) ══════════════════ */
  {
    slug: "analytics",
    title: "Analytics",
    tagline: "Analytics",
    description: "See revenue, booking trends and repeat-client rate in one dashboard, instead of piecing it together from a payment app and a notebook. Spot your best service and do more of it.",
    accent: "#4AB765", accentLight: "rgba(74,183,101,0.10)", darkBg: "#0F1111",
    signature: "coverflow",
    hero: {
      pre: "Booking analytics for", accent: "freelancers", post: "",
      sub: "Revenue, booking trends and repeat-client rate in one live dashboard. Spot your best-performing service and where bookings drop off, with no spreadsheets.",
      cta: "Get started free",
    },
    heroMock: { kind: "list", title: "This month", subtitle: "Live", rows: [
      { label: "Revenue", value: "₹84,500", tint: "#4AB765" },
      { label: "Bookings", value: "62", tint: "#269CEF" },
      { label: "Repeat clients", value: "41%", tint: "#8B5CF6" },
    ], go: "Open dashboard" },
    heroGlass: [
      { icon: "BarChart3", label: "Revenue", value: "Up 18%", tint: "#4AB765" },
      { icon: "Repeat", label: "Repeat clients", value: "41%", tint: "#8B5CF6" },
    ],
    stats: [
      { value: "₹0", label: "extra spreadsheet tools needed" },
      { value: "1", label: "dashboard for revenue and bookings" },
      { value: "Live", label: "numbers, no manual refresh" },
    ],
    benefits: {
      heading: "Booking analytics that show what is working, not just how it feels",
      lead: "Which service earns the most? How many visitors actually book? Right now that answer lives in a payment app and a notebook.",
      without: [
        { title: "Guesswork", desc: "You are not sure which service actually pays." },
        { title: "Spreadsheet exports", desc: "You stitch numbers together by hand each month." },
        { title: "No funnel view", desc: "You cannot see where visitors drop off." },
        { title: "Blind to repeat rate", desc: "You do not know how many clients come back." },
      ],
      with: [
        { title: "Revenue at a glance", desc: "Track earnings week over week and month over month." },
        { title: "Top services breakdown", desc: "See which service actually drives bookings and income." },
        { title: "Conversion funnel", desc: "See how many visits turn into paid bookings." },
        { title: "Repeat-client rate", desc: "Know what share of revenue comes from returning clients." },
      ],
    },
    stepsHeading: "From bookings to better decisions",
    stepsLead: "Take bookings as usual, and the numbers explain themselves.",
    steps: [
      { icon: "CalendarCheck", title: "Take bookings as usual", desc: "Every booking and payment feeds the dashboard automatically, with nothing to log." },
      { icon: "BarChart3", title: "Read your numbers", desc: "Revenue, trends and repeat-client rate, with no spreadsheet exports." },
      { icon: "Layers", title: "Find your best service", desc: "See which offering actually drives the most bookings and revenue." },
      { icon: "Zap", title: "Fix the leak", desc: "Spot where the funnel drops off and fix that step." },
      { icon: "Download", title: "Export for your CA", desc: "Download a clean summary at tax time or for your own records." },
    ],
    capabilities: [
      { icon: "BarChart3", title: "Revenue and booking trends", body: "Track earnings week over week and month over month, in rupees, with no spreadsheet exports." },
      { icon: "Repeat", title: "Repeat-client tracking", body: "See what share of your revenue comes from returning clients versus first-time bookings." },
      { icon: "Layers", title: "Top services breakdown", body: "Find out which service actually drives the most bookings and revenue, not just the one you promote." },
      { icon: "Zap", title: "Conversion funnel", body: "See how many page visits turn into started bookings, and how many complete payment." },
      { icon: "Download", title: "Exportable reports", body: "Download a clean summary for your CA at tax time, or to keep your own records outside the app." },
      { icon: "LayoutDashboard", title: "One live dashboard", body: "Revenue, bookings and clients update in real time, with no manual refresh needed." },
    ],
    product: {
      eyebrow: "See it live", heading: "Your business, in one dashboard",
      body: "Revenue, top services and repeat-client rate, updated live, so you can do more of what works.",
      mock: { kind: "list", title: "Overview", subtitle: "This month", rows: [
        { label: "Revenue", value: "₹84,500", tint: "#4AB765" },
        { label: "Top service", value: "Strategy call", tint: "#269CEF" },
        { label: "Repeat rate", value: "41%", tint: "#8B5CF6" },
      ], go: "Export report" },
    },
    useCases: [
      { icon: "Briefcase", audience: "Consultants", description: "See which offer actually drives revenue." },
      { icon: "Sparkles", audience: "Coaches", description: "Track repeat clients versus one-off sessions." },
      { icon: "PenLine", audience: "Freelancers", description: "Watch monthly income trend without a spreadsheet." },
    ],
    testimonials: TESTIMONIALS,
    related: [
      { slug: "payments", label: "Where the revenue comes from", icon: "Wallet" },
      { slug: "client-management", label: "See repeat clients by name", icon: "Users" },
      { slug: "online-scheduling", label: "Track bookings as they come in", icon: "CalendarCheck" },
      { slug: "reviews", label: "Watch your rating trend", icon: "Star" },
    ],
    faq: [
      { q: "Is analytics available on the free Starter plan?", a: "A basic revenue and booking summary is available on every plan. Deeper breakdowns come with paid plans." },
      { q: "Can I export my data?", a: "Yes. Reports can be downloaded for your own records or handed straight to your accountant." },
      { q: "Does this replace Google Analytics on my page?", a: "This dashboard tracks your bookings and revenue specifically. For site traffic, GA4 can run alongside it." },
      { q: "How often does the dashboard update?", a: "Numbers reflect live data, so a new booking or payment shows up without needing to refresh." },
    ],
    cta: { headline: "Stop guessing what is working.", subline: "See your real numbers in one dashboard, updated live." },
    seo: {
      title: "Booking Analytics for Freelancers & Coaches | Meeticulous",
      description: "Booking analytics for freelancers — track revenue, repeat clients and top services in one live dashboard. No spreadsheets, no guesswork.",
    },
  },
];

export function getFeature(slug) {
  return FEATURES.find((feature) => feature.slug === slug);
}

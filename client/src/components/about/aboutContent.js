// All About-page copy + data.
//
// Honesty rules for this file (the page is a trust page — keep it verifiable):
// - No customer counts, uptime/SLA numbers, brand logos or founding facts unless
//   they are real and confirmed. Unknowns stay OUT of the copy, not bracketed in it.
// - Commission is plan-dependent (subscription_plans.commission_percentage): the
//   free Starter plan takes a commission on paid bookings, Pro takes 0%. Never
//   claim "0% commission" unqualified, and never hardcode the % here.
// - Testimonials must come from real hosts — never from team members.

// Shared CTA destination — matches homepage ROUTE_START.
export const ROUTE_START = "/become-a-host";

export const hero = {
  eyebrow: "About Meeticulous",
  title: "Your time is the product.",
  titleAccent: "We make it bookable.",
  sub: "Meeticulous is an online booking platform for creators, pros & bros — the people who sell sessions, shoots, lessons and expertise. One page to list your services, take bookings, collect payment upfront and send the reminders, so the admin stops eating into the work.",
  ctaPrimary: "Let's Get Started",
  ctaGhost: "See pricing",
  ctaGhostHref: "/pricing",
};

// Illustrative booking card shown beside the hero (a UI sketch, not customer data).
export const heroMock = {
  host: "Your booking page",
  service: "1:1 Portrait Session",
  meta: "60 min · In studio",
  price: "₹2,500",
  slots: ["10:00 AM", "12:30 PM", "4:00 PM", "6:30 PM"],
  activeSlot: 2,
  cta: "Pay & confirm booking",
  toasts: [
    { label: "Payment received", value: "₹2,500" },
    { label: "Reminder sent", value: "WhatsApp + email" },
  ],
};

export const problem = {
  eyebrow: "Why we built it",
  heading: "Selling your time shouldn't feel like a second job.",
  intro:
    "Most people who sell their time run their bookings out of WhatsApp chats, Instagram DMs and a UPI QR code. It works — until the week gets busy.",
  rows: [
    { pain: "Ten messages to agree on one time slot", fix: "Clients pick an open slot from your booking page." },
    { pain: "Sending a QR code and waiting for a screenshot", fix: "Payment is collected when they book — UPI, cards or netbanking via Razorpay." },
    { pain: "Clients who forget and don't turn up", fix: "Confirmations and reminders go out by email and WhatsApp on their own." },
    { pain: "Bookings and invoices scattered across apps", fix: "Bookings and GST invoices live in one dashboard." },
  ],
};

export const mission = {
  eyebrow: "Our mission",
  statement: "Make every skill bookable — so the people who create, teach, coach and heal spend their time on the work, not the admin around it.",
};

export const audiences = {
  eyebrow: "Who it's for",
  heading: "Built for creators, pros & bros.",
  sub: "Meeting schedulers were built for sales calls and team syncs. Meeticulous is appointment scheduling for professionals and creators whose time is what they sell.",
  groups: [
    {
      name: "Creators",
      who: "Content creators, photographers, artists and workshop hosts.",
      sells: ["Portrait and product shoots", "1:1 creator calls", "Workshops and classes", "Portfolio reviews"],
      accent: "var(--c-pink)",
    },
    {
      name: "Pros",
      who: "Consultants, coaches, freelancers, designers and experts.",
      sells: ["Consultations", "Coaching sessions", "Audits and strategy calls", "Design reviews"],
      accent: "var(--c-blue)",
    },
    {
      name: "Bros",
      who: "Personal trainers, fitness coaches, mentors, gaming coaches and independent pros.",
      sells: ["Training sessions", "Mentoring calls", "Gaming coaching", "Site visits and walkthroughs"],
      accent: "var(--c-emerald)",
    },
  ],
};

export const difference = {
  eyebrow: "How we're different",
  heading: "A booking platform, not just a calendar.",
  sub: "A calendar link helps two people find a time. Selling that time takes more — so that's what we built.",
  items: [
    { title: "Services, not meetings", body: "Each service gets its own price, duration and description on your booking page — the way clients actually shop for your time." },
    { title: "Paid before the session", body: "Clients pay when they book, through Razorpay with UPI, cards or netbanking. No chasing after the call." },
    { title: "Reminders where clients read them", body: "Booking confirmations and reminders go out on WhatsApp as well as email, so fewer sessions are missed." },
    { title: "Invoices handled", body: "GST invoices are generated for your bookings, so the paperwork keeps itself." },
    { title: "Synced with Google Calendar", body: "Your availability stays in step with the calendar you already use, so you don't get double-booked." },
    { title: "Pricing, stated plainly", body: "Start free on Starter, which takes a small commission on paid bookings. On Pro, commission is 0%." },
  ],
};

export const beliefs = {
  heading: "What we believe.",
  items: [
    { title: "Time should never be wasted.", body: "Every tap removed is a minute given back." },
    { title: "Your craft is the valuable part.", body: "The machinery around it isn't your job — that part is ours." },
    { title: "Your clients are yours.", body: "They book you directly, on your own page, under your name." },
    { title: "Automation should feel invisible.", body: "The best tool is the one you forget is there." },
    { title: "Calm beats hustle.", body: "Work slower. Earn smarter." },
    { title: "Pricing should be honest.", body: "What we charge is on the pricing page — no surprises at payout." },
  ],
};

// Order is intentional (4 across, 2 rows):
//   Durga · Happy · Mohini · Sujata  /  Arjun · Sariga · Aastha · Shubham
// Photos: the old company-assets.meeticulous.in host does not resolve, so every
// member renders the initials fallback until real photos are re-hosted — set
// `photo` per member when they are. Socials resolve to Meeticulous's own pages
// for now (TeamSocials fills the default per type) until individual links exist.
export const team = {
  heading: "The people behind Meeticulous.",
  sub: "A small team, building in India.",
  members: [
    {
      name: "Durga Laxne",
      position: "Social Media Manager",
      role: "Social",
      photo: null,
      bio: "Durga tells the Meeticulous story across every feed, turning posts, reels and replies into calm moments that help the right creators find their home.",
      socials: [{ type: "linkedin" }, { type: "instagram" }, { type: "sloth" }],
    },
    {
      name: "Happy Singh",
      position: "Content Lead",
      role: "Content",
      photo: null,
      bio: "Happy turns the product into words people actually enjoy reading, shaping guides, emails and pages that respect your time and never waste a tap on it.",
      socials: [{ type: "instagram" }, { type: "x" }, { type: "sloth" }],
    },
    {
      name: "Mohini Daf",
      position: "Automation Engineer",
      role: "Automation",
      photo: null,
      bio: "Mohini makes the boring parts quietly vanish, wiring up flows so reminders, payouts and follow-ups run by themselves while you focus on the real work.",
      socials: [{ type: "linkedin" }, { type: "x" }, { type: "sloth" }],
    },
    {
      name: "Sujata Mishra",
      position: "Director of Ops",
      role: "Operations",
      photo: null,
      bio: "Sujata keeps the whole machine humming behind the scenes, steering operations so no one slips through the cracks on any given day, week or quarter.",
      socials: [{ type: "linkedin" }, { type: "sloth" }],
    },
    {
      name: "Arjun Ravikumar",
      position: "Performance Marketer",
      role: "Performance",
      photo: null,
      bio: "Arjun finds calm creators wherever they scroll and brings them home, tuning every campaign so each rupee spent earns its keep, and then some more too.",
      socials: [{ type: "linkedin" }, { type: "instagram" }, { type: "x" }, { type: "sloth" }],
    },
    {
      name: "Sariga Suresh",
      position: "Admin Executive",
      role: "Admin",
      photo: null,
      bio: "Sariga keeps the back office spotless so the team stays on creators, handling payouts, paperwork and all the small stuff before it becomes a big mess.",
      socials: [{ type: "linkedin" }, { type: "sloth" }],
    },
    {
      name: "Aastha Nikhare",
      position: "Product Designer",
      role: "Product",
      photo: null,
      bio: "Aastha obsesses over each tap so you never think twice, removing friction for a living and shaping a product that feels calm, quick and humane in use.",
      socials: [{ type: "linkedin" }, { type: "x" }, { type: "sloth" }],
    },
    {
      name: "Shubham",
      position: "Founding Engineer",
      role: "Engineering",
      photo: null,
      bio: "Shubham builds all the calm under the hood, shipping fast reliable systems that stay quietly out of your way so booking and payments simply just work.",
      socials: [{ type: "linkedin" }, { type: "x" }, { type: "sloth" }],
    },
  ],
};

// Real hosts only (avatars in client/public/images/testimonials). Team members'
// quotes were removed — an About page can't present staff as customers.
export const testimonials = {
  eyebrow: "From real hosts",
  heading: "What hosts tell us.",
  items: [
    { quote: "Half my day used to go in 'is a cabin free at 4?' WhatsApps. Now people just book it themselves.", name: "Mukesh Tidke", role: "Coworking Space Owner", avatar: "/images/testimonials/mukesh-tidke.webp" },
    { quote: "Clients book site-visit slots straight off my link and pay upfront. No more chasing dates over WhatsApp.", name: "Ar. Pranav Kadoo", role: "Architect", avatar: "/images/testimonials/pranav-kadoo.webp" },
    { quote: "I send the link, they pick a slot, payment's sorted before the call. No more awkward money talk.", name: "Vishal Chaware", role: "Salesforce Developer", avatar: "/images/testimonials/vishal-chaware.webp" },
    { quote: "Set up my weekend mentoring in one evening and kind of forgot about it. Slots fill, money's already in.", name: "Sangharata Somkuvar", role: "DevOps Engineer", avatar: "/images/testimonials/sangharata-somkuvar.webp" },
    { quote: "My patients forget appointments easily. The reminder texts have honestly been a lifesaver.", name: "Dr. Yukta Bawankar", role: "Physiotherapist", avatar: "/images/testimonials/yukta-bawankar.webp" },
    { quote: "I run mentoring calls on the side — slots fill, payment's sorted, zero admin after work hours.", name: "Tushar Malvi", role: "Management Trainee, ECL", avatar: "/images/testimonials/tushar-malvi.webp" },
  ],
};

// Only questions with verifiable answers. Also emitted as FAQPage JSON-LD (About.jsx).
export const faq = {
  heading: "Questions, answered.",
  items: [
    {
      q: "What is Meeticulous?",
      a: "Meeticulous is appointment booking software for creators, pros & bros. You publish your services on your own booking page; clients pick a time, pay upfront and get reminders automatically.",
    },
    {
      q: "Who is Meeticulous for?",
      a: "Anyone who sells their time: photographers, artists and workshop hosts; consultants, coaches, freelancers and designers; personal trainers, mentors and gaming coaches.",
    },
    {
      q: "How is it different from a meeting scheduler?",
      a: "A meeting scheduler helps two people find a time. Meeticulous is built for selling that time — each service has its own price, payment is collected when the client books, and invoices are generated for you.",
    },
    {
      q: "How do my clients pay?",
      a: "Through Razorpay when they book — UPI, cards or netbanking. The payment is in before the session, so there's nothing to chase afterwards.",
    },
    {
      q: "Does Meeticulous take a commission?",
      a: "The free Starter plan takes a small commission on paid bookings. On Pro, commission is 0%. The current rates are on the pricing page.",
    },
    {
      q: "Do clients get reminders?",
      a: "Yes. Booking confirmations and reminders go out by email and WhatsApp.",
    },
  ],
};

export const finalCta = {
  heading: "Make your time bookable.",
  sub: "Set up your booking page, add your services and share one link. Starter is free to begin.",
  ctaPrimary: "Let's Get Started",
  ctaSecondary: "Compare plans",
  ctaSecondaryHref: "/pricing",
};

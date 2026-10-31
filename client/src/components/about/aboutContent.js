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
  title: "Your time is the product.",
  titleAccent: "We make it bookable.",
  sub: "Meeticulous is an online booking platform for creators, pros & bros — the people who sell sessions, shoots, lessons and expertise. One page to list your services, take bookings, collect payment upfront and send the reminders, so the admin stops eating into the work.",
  ctaPrimary: "Join the team",
  ctaPrimaryHref: "/careers",
  ctaGhost: "More about us",
  // In-page anchor on the story section right under the hero (ProblemSection).
  ctaGhostHref: "#our-story",
  // Right-hand hero photo (Unsplash, same ID as the homepage "studio" persona).
  // Swap for a real Meeticulous photo when one exists.
  image: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1400&h=1100&q=80",
  imageAlt: "A small team working together around a laptop",
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
  heading: "Selling your time shouldn't feel like a second job.",
  intro:
    "Most people who sell their time run their bookings out of WhatsApp chats, Instagram DMs and a UPI QR code. It works — until the week gets busy.",
  // Before/after cards: each row is one pain ("The old way") and its fix
  // ("A smoother way"), each with a short title + one line.
  rows: [
    { painTitle: "Endless conversations", pain: "Ten messages just to agree on one time slot.", fixTitle: "Self-service booking", fix: "Clients pick an open slot from your booking page." },
    { painTitle: "Payment chasing", pain: "Sending a QR code and waiting for a screenshot.", fixTitle: "Automatic payments", fix: "UPI, cards or netbanking via Razorpay, paid at booking." },
    { painTitle: "Missed appointments", pain: "Clients forget and don't turn up.", fixTitle: "Automatic reminders", fix: "Email and WhatsApp confirmations go out on their own." },
    { painTitle: "Scattered records", pain: "Bookings and invoices spread across apps.", fixTitle: "One organised dashboard", fix: "Bookings and GST invoices in one place." },
  ],
};

export const mission = {
  statement: "Make every skill bookable — so the people who create, teach, coach and heal spend their time on the work, not the admin around it.",
};

export const difference = {
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

// Polaroid gallery (after the team). Stock Unsplash photos of the KINDS of work
// people sell with Meeticulous — captioned by activity, never as named customers.
// `id` = Unsplash photo id (checked to load and to match its caption).
export const gallery = {
  heading: "Made for every kind of booked time.",
  sub: "Classes, sessions, shoots and lessons — the work people sell with one booking link.",
  items: [
    { id: "1544367567-0f2fcb009e0b", title: "Yoga", caption: "Sunrise flows, booked by the slot." },
    { id: "1571019613454-1cb2f99b2d8b", title: "Fitness", caption: "Personal training, at home or in the studio." },
    { id: "1427504494785-3a9ca7044f45", title: "Study", caption: "Tutoring and exam prep, one session at a time." },
    { id: "1516035069371-29a1b244cc32", title: "Photography", caption: "Shoots booked and paid before the day." },
    { id: "1556761175-5973dc0f32e7", title: "Workshops", caption: "Talks and group sessions with limited seats." },
    { id: "1531482615713-2afd69097998", title: "Mentoring", caption: "1:1 calls and reviews, scheduled around work." },
    { id: "1510915361894-db8b60106cb1", title: "Music lessons", caption: "Weekly lessons from a single link." },
    { id: "1560066984-138dadb4c035", title: "Salons", caption: "Chairs filled without the phone calls." },
  ],
};

export const beliefs = {
  heading: "What we believe.",
  sub: "A few ideas that shape every feature we build.",
  // Three columns, each paired with an illustration in BeliefGrid (art: time, clients, pricing — keep the order).
  items: [
    { art: "time", title: "Time should never be wasted.", body: "Every tap removed is a minute given back." },
    { art: "clients", title: "Your clients are yours.", body: "They book you directly, on your own page, under your name." },
    { art: "pricing", title: "Pricing should be honest.", body: "What we charge is on the pricing page — no surprises at payout." },
  ],
};

// Order is intentional: Shubham · Shivani · Pranav · Tushar · Aastha.
// Shivani, Pranav and Tushar carry a neutral "Team Member" title until their
// real roles are confirmed — update position/role/bio when they are.
// Photos: the old company-assets.meeticulous.in host does not resolve, so every
// member renders the initials fallback until real photos are re-hosted — set
// `photo` per member when they are. Socials resolve to Meeticulous's own pages
// for now (TeamSocials fills the default per type) until individual links exist.
export const team = {
  heading: "The people behind Meeticulous.",
  sub: "A small team, building in India. Tap a photo to meet the person behind it.",
  members: [
    {
      name: "Shubham Datarkar",
      position: "Founding Engineer",
      role: "Engineering",
      photo: null,
      bio: "Shubham builds all the calm under the hood, shipping fast reliable systems that stay quietly out of your way so booking and payments simply just work.",
      socials: [{ type: "linkedin" }, { type: "x" }, { type: "sloth" }],
    },
    {
      name: "Shivani Kadoo",
      position: "Team Member",
      role: "Team",
      photo: null,
      bio: "Shivani is part of the small team building Meeticulous in India, helping creators and professionals get booked, paid and reminded without the admin.",
      socials: [{ type: "linkedin" }, { type: "sloth" }],
    },
    {
      name: "Pranav Kadoo",
      position: "Team Member",
      role: "Team",
      photo: null,
      bio: "Pranav is part of the small team building Meeticulous in India, working to make every booking feel simple for hosts and the people who book them.",
      socials: [{ type: "linkedin" }, { type: "sloth" }],
    },
    {
      name: "Tushar Malvi",
      position: "Team Member",
      role: "Team",
      photo: null,
      bio: "Tushar is part of the small team building Meeticulous in India, helping turn one booking link into calm, paid sessions for creators and pros.",
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
  ],
};

// Real hosts only (avatars in client/public/images/testimonials). Team members'
// quotes were removed — an About page can't present staff as customers.
export const testimonials = {
  heading: "What hosts tell us.",
  sub: "People who sell their time, on what changed once bookings and payments started running themselves.",
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
  sub: "The things people usually ask before setting up their booking page.",
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

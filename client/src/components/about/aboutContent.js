// All About-page copy + data. Round-2: replace placeholders / [bracketed] values + wire real photos.
// Swappable image/data slots are marked with a `swap` field rendered as data-swap="…".
// Find them all: grep -r 'data-swap' client/src/components/about

// Public company-assets bucket base for About-page imagery.
export const ABOUT_ASSETS = "https://company-assets.meeticulous.in/images/about";

export const hero = {
  leadPre: "Built for people who'd rather",
  // Typewriter cycles these one word at a time (type → hold → erase),
  // each word in its own brand colour (see HeroV2 TYPE_COLORS).
  typeWords: ["Create", "Teach", "Heal", "Coach", "Perform"],
  leadPost: "than run a front desk.",
  sub: "Meeticulous runs the machinery around your work — booking, payments and reminders — so you get booked and paid without chasing DMs or losing a cut to commission.",
  ctaPrimary: "Let's Get Started",
  ctaGhost: "See how it works",
  image: `${ABOUT_ASSETS}/book-a-sloth-about-hero.png`,
};

export const problem = {
  heading: "Getting booked shouldn't feel like a second job.",
  rows: [
    { pain: 'Endless "what time works?" DMs', fix: "One link. They pick. Done." },
    { pain: "Platforms taking a cut of every booking", fix: "0% commission. You keep it all." },
    { pain: "No-shows and forgotten sessions", fix: "Auto reminders + paid-upfront options." },
    { pain: "Your audience locked inside someone else's app", fix: "Your page, your customers, your data." },
  ],
};

export const beliefs = {
  heading: "What we believe.",
  items: [
    { title: "Time should never be wasted.", body: "Every tap removed is a minute given back." },
    { title: "Your craft is the valuable part.", body: "The machinery around it isn't your job — that part is ours." },
    { title: "Creators should own their audience.", body: "Your customers are yours. Always." },
    { title: "Automation should feel invisible.", body: "The best tool is the one you forget is there." },
    { title: "Calm beats hustle.", body: "Work slower. Earn smarter." },
    { title: "You keep what you earn.", body: "0% commission. Your money is yours." },
  ],
};

export const behind = {
  heading: "Made by people who hate busywork as much as you do.",
  sub: "No stock photos. Real workspace, real process — swap these for the real thing soon.",
  tiles: [
    { caption: "Whiteboard sessions", swap: "behind-1" },
    { caption: "Real support", swap: "behind-2" },
    { caption: "Shipping weekly", swap: "behind-3" },
  ],
};

// HONEST framing only — no invented customer counts. [bracketed] values swap with real data round-2.
export const stats = {
  heading: "The calm, by the numbers.",
  items: [
    { value: 0, suffix: "%", label: "commission, ever" },
    { value: "99.9", suffix: "%", label: "uptime" },
    { value: 24, prefix: "<", suffix: "h", label: "support response", swap: "stat-support" },
    { value: 1, suffix: "+", label: "countries ready", swap: "stat-countries" },
    { value: 1, suffix: "", label: "years building", swap: "stat-years" },
  ],
};

// Order is intentional (4 across, 2 rows):
//   Durga · Happy · Mohini · Sujata  /  Arjun · Sariga · Aastha · Shubham
// Photos live in company-assets/images/about. Members without a photo → initials fallback.
// Socials vary by profession; hrefs resolve to Meeticulous's own pages for now
// (TeamSocials fills the default per type) until individual links are provided.
export const team = {
  heading: "The people behind Meeticulous.",
  sub: "A small team that sweats the calm so you don't have to.",
  members: [
    {
      name: "Durga Laxne",
      position: "Social Media Manager",
      role: "Social",
      photo: `${ABOUT_ASSETS}/durga-laxne.jpg`,
      bio: "Durga tells the Meeticulous story across every feed, turning posts, reels and replies into calm moments that help the right creators find their home.",
      socials: [{ type: "linkedin" }, { type: "instagram" }, { type: "sloth" }],
    },
    {
      name: "Happy Singh",
      position: "Content Lead",
      role: "Content",
      photo: `${ABOUT_ASSETS}/happy-singh.jpg`,
      bio: "Happy turns the product into words people actually enjoy reading, shaping guides, emails and pages that respect your time and never waste a tap on it.",
      socials: [{ type: "instagram" }, { type: "x" }, { type: "sloth" }],
    },
    {
      name: "Mohini Daf",
      position: "Automation Engineer",
      role: "Automation",
      photo: `${ABOUT_ASSETS}/mohini-daf.jpg`,
      bio: "Mohini makes the boring parts quietly vanish, wiring up flows so reminders, payouts and follow-ups run by themselves while you focus on the real work.",
      socials: [{ type: "linkedin" }, { type: "x" }, { type: "sloth" }],
    },
    {
      name: "Sujata Mishra",
      position: "Director of Ops",
      role: "Operations",
      photo: `${ABOUT_ASSETS}/sujata-mishra.jpg`,
      bio: "Sujata keeps the whole machine humming behind the scenes steering the operations so no one slips through the cracks on any given day, week or quarter.",
      socials: [{ type: "linkedin" }, { type: "sloth" }],
    },
    {
      name: "Arjun Ravikumar",
      position: "Performance Marketer",
      role: "Performance",
      photo: `${ABOUT_ASSETS}/arjun-ravikumar.jpg`,
      bio: "Arjun finds calm creators wherever they scroll and brings them home, tuning every campaign so each rupee spent earns its keep, and then some more too.",
      socials: [{ type: "linkedin" }, { type: "instagram" }, { type: "x" }, { type: "sloth" }],
    },
    {
      name: "Sariga Suresh",
      position: "Admin Executive",
      role: "Admin",
      photo: `${ABOUT_ASSETS}/sariga-suresh.jpg`,
      bio: "Sariga keeps the back office spotless so the team stays on creators, handling payouts, paperwork and all the small stuff before it becomes a big mess.",
      socials: [{ type: "linkedin" }, { type: "sloth" }],
    },
    {
      name: "Aastha Nikhare",
      position: "Product Designer",
      role: "Product",
      photo: `${ABOUT_ASSETS}/aastha-nikhare.jpg`,
      bio: "Aastha obsesses over each tap so you never think twice, removing friction for a living and shaping a product that feels calm, quick and humane in use.",
      socials: [{ type: "linkedin" }, { type: "x" }, { type: "sloth" }],
    },
    {
      name: "Shubham",
      position: "Founding Engineer",
      role: "Engineering",
      photo: `${ABOUT_ASSETS}/shubham-datarkar.jpg`,
      bio: "Shubham builds all the calm under the hood, shipping fast reliable systems that stay quietly out of your way so booking and payments simply just work.",
      socials: [{ type: "linkedin" }, { type: "x" }, { type: "sloth" }],
    },
  ],
};

export const build = {
  heading: "How we build.",
  steps: [
    { title: "Listen", body: "Talk to creators. A lot." },
    { title: "Research", body: "Find the real friction." },
    { title: "Prototype", body: "Make it real fast." },
    { title: "Build", body: "Ship it small." },
    { title: "Launch", body: "Put it in your hands." },
    { title: "Improve", body: "Then do it again." },
  ],
};

export const trust = {
  heading: "Built to be trusted.",
  cards: [
    { title: "Encrypted by default", body: "Your data is protected in transit and at rest." },
    { title: "Payments you can trust", body: "Razorpay-secured. Money handled right." },
    { title: "Always backed up", body: "Regular backups. Nothing lost." },
    { title: "Privacy-first", body: "We never sell your data. Export anytime." },
  ],
};

export const faq = {
  heading: "Questions, answered.",
  items: [
    { q: "Who are you?", a: "A small team building the calmest way for creators to get booked and paid. [Swap with real team note round-2.]" },
    { q: "Where are you based?", a: "[Placeholder — add real HQ/location round-2.]" },
    { q: "How do you handle my data?", a: "Encrypted in transit and at rest, never sold, and exportable anytime." },
    { q: "Can I export everything?", a: "Yes. Your bookings and customer data are yours to take with you." },
    { q: "How fast is support?", a: "We aim to reply within a day. [Swap with real SLA round-2.]" },
    { q: "How often do you ship updates?", a: "Constantly — small improvements land every week." },
  ],
};

export const finalCta = {
  heading: "Your calmer booking business starts today.",
  sub: "Set up your page in minutes. Keep 100% of what you earn.",
  ctaPrimary: "Let's Get Started",
};

// Reused verbatim from homepage TESTIMONIALS (Home.jsx). Round-2: de-dup into a shared module.
export const testimonials = {
  heading: "Loved by the people who use it.",
  items: [
    { quote: "Half my day used to go in 'is a cabin free at 4?' WhatsApps. Now people just book it themselves.", name: "Mukesh Tidke", role: "Coworking Space Owner", avatar: "/images/testimonials/mukesh-tidke.webp" },
    { quote: "Clients book site-visit slots straight off my link and pay upfront. No more chasing dates over WhatsApp.", name: "Ar. Pranav Kadoo", role: "Architect", avatar: "/images/testimonials/pranav-kadoo.webp" },
    { quote: "I send the link, they pick a slot, payment's sorted before the call. No more awkward money talk.", name: "Vishal Chaware", role: "Salesforce Developer", avatar: "/images/testimonials/vishal-chaware.webp" },
    { quote: "Set up my weekend mentoring in one evening and kind of forgot about it. Slots fill, money's already in.", name: "Sangharata Somkuvar", role: "DevOps Engineer", avatar: "/images/testimonials/sangharata-somkuvar.webp" },
    { quote: "My patients forget appointments easily. The reminder texts have honestly been a lifesaver.", name: "Dr. Yukta Bawankar", role: "Physiotherapist", avatar: "/images/testimonials/yukta-bawankar.webp" },
    { quote: "Stuck the link in my Insta bio. Looks way better than sending a GPay QR after the call.", name: "Happy Singh", role: "Creative Lead", avatar: "/images/testimonials/happy-singh.webp" },
    { quote: "Honestly I picked it because 0% commission. I charge for audits and Sloth doesn't take a cut.", name: "Arjun Ravikumar", role: "Performance Marketeer", avatar: "/images/testimonials/arjun-ravikumar.webp" },
    { quote: "I run mentoring calls on the side — slots fill, payment's sorted, zero admin after work hours.", name: "Tushar Malvi", role: "Management Trainee, ECL", avatar: "/images/testimonials/tushar-malvi.webp" },
  ],
};

// Shared CTA destination — matches homepage ROUTE_START.
export const ROUTE_START = "/be-a-sloth";

// ── New rebuild sections (2026-06-26). [TBD] assets marked data-swap. ──

// Section 2 — logo marquee. PNG logos live in company-assets/images/about/brands.
// Greyscale by default, full colour on hover; single track scrolls right → left.
// Mix of top global + Indian brands across industries. Drop matching PNGs in the
// folder (transparent background preferred) — filenames below are the contract.
export const BRAND_ASSETS = `${ABOUT_ASSETS}/brands`;

export const logos = {
  eyebrow: "Used by people who work with",
  // Indian + foreign brands interleaved; the marquee duplicates this list
  // for a seamless infinite loop.
  brands: [
    { name: "Mahindra", file: "mahindra.png" },
    { name: "Apple", file: "apple.png" },
    { name: "Flipkart", file: "flipkart.png" },
    { name: "Google", file: "google.png" },
    { name: "Zomato", file: "zomato.png" },
    { name: "Microsoft", file: "microsoft.png" },
    { name: "PharmEasy", file: "pharmeasy.png" },
    { name: "Amazon", file: "amazon.png" },
    { name: "Blinkit", file: "blinkit.png" },
    { name: "Coca-Cola", file: "coca-cola.png" },
    { name: "Nike", file: "nike.png" },
    { name: "Samsung", file: "samsung.png" },
    { name: "Netflix", file: "netflix.png" },
    { name: "Spotify", file: "spotify.png" },
    { name: "Facebook", file: "facebook.png" },
  ].map((b) => ({ ...b, src: `${BRAND_ASSETS}/${b.file}` })),
};

// Section 3 — join / recruiting split (30/70). [COPY + IMAGE TBD]
export const join = {
  heading: "Join our team",
  body: "We're a small team building the calm way to get booked. Come build it with us.",
  cta: "Join the moment",
  href: "/careers",
  imageSwap: "join-hero",
  image: `${ABOUT_ASSETS}/book-a-sloth-about-team.png`,
};

// Section 4 — stacking cards. Big feature card + 4 sticky-stacking cards.
export const stackCards = {
  heading: "Everything you need. Nothing you don't.",
  feature: {
    title: "One calm link does the whole job.",
    body: "Publish your services, share one link, and let bookings, payments and reminders run themselves.",
    swap: "stack-feature",
  },
  cards: [
    { title: "Get booked", body: "Your page is live 24/7. Clients book while you sleep.", more: "Personal booking page, availability rules and two-way calendar sync — all in one place.", swap: "stack-1", image: `${ABOUT_ASSETS}/book-a-sloth-about-get-booked.png`, ctaPrimary: "Create my page", ctaSecondary: "See a sample page" },
    { title: "Get paid", body: "Money in before the session. No invoicing, no chasing.", more: "Razorpay UPI, cards and netbanking. Advance or full payment. Auto GST invoices.", swap: "stack-2", image: `${ABOUT_ASSETS}/book-a-sloth-about-get-paid.png`, ctaPrimary: "Start getting paid", ctaSecondary: "How payments work" },
    { title: "Stay organized", body: "Every client, booking and rupee in one place.", more: "Client history, private notes, and bookings & revenue reports — zero spreadsheets.", swap: "stack-3", image: `${ABOUT_ASSETS}/book-a-sloth-about-get-organized.jpg`, ctaPrimary: "Organize my work", ctaSecondary: "Tour the dashboard" },
    { title: "Reduce no-shows", body: "Gentle reminders go out automatically.", more: "Email + WhatsApp reminders, instant confirmations and post-session follow-ups.", swap: "stack-4", image: `${ABOUT_ASSETS}/book-a-sloth-about-getno-shows.jpg`, ctaPrimary: "Turn on reminders", ctaSecondary: "See reminder flow" },
  ],
};

// Section 5 — case studies asymmetric grid (top 70/30, bottom 30/30/30). [TBD]
export const caseStudies = {
  heading: "Stories from the calm.",
  tiles: [
    { title: "Coworking space cut no-shows", blurb: "Members book cabins themselves now.", swap: "case-1" },
    { title: "Clinic stopped chasing", blurb: "Patients pay upfront and turn up.", swap: "case-2" },
    { title: "Mentor on autopilot", blurb: "Weekend slots fill, money's in.", swap: "case-3" },
    { title: "GST season, sane", blurb: "Clients book instead of calling.", swap: "case-4" },
    { title: "One link in bio", blurb: "Looks better than a GPay QR.", swap: "case-5" },
  ],
};

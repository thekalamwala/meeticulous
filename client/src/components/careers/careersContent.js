// All Careers-page copy + open roles. Round-2: swap placeholder copy,
// real compensation bands, and culture photos before public launch.
import { Rocket, HeartHandshake, Sprout, Clock, Globe2, TrendingUp } from 'lucide-react';

// Live hiring inbox. Footer uses team@meeticulous.com; flip here if it changes.
export const HIRING_EMAIL = 'team@meeticulous.com';

export const company = {
  missionBlurb:
    'We help India’s creators and professionals get booked and paid — without losing a cut to commission. Come build the calm way to get booked.',
  values: [
    { icon: Rocket, title: 'Ship fast, stay calm', body: 'Small team, real ownership. You’ll see your work live in days, not quarters.' },
    { icon: HeartHandshake, title: 'Creators first', body: 'Every decision starts with the people who put food on the table with their craft.' },
    { icon: Sprout, title: 'Grow with us', body: 'Early team, wide scope. Your role expands as fast as you do.' },
  ],
  perks: [
    { icon: Globe2, title: 'Remote-first', body: 'Work from anywhere in India. We sync on outcomes, not desks.' },
    { icon: Clock, title: 'Flexible hours', body: 'Own your calendar. Deep work over status meetings.' },
    { icon: TrendingUp, title: 'Real upside', body: 'Competitive pay plus a stake in what we’re building together.' },
  ],
  // data-swap: replace with real culture photos in round-2.
  culture: [
    { img: '', alt: 'The Meeticulous team', caption: 'Building in the open.' },
    { img: '', alt: 'Creators we serve', caption: 'For India’s creators.' },
    { img: '', alt: 'Calm by design', caption: 'Calm by design.' },
  ],
  aboutTeam:
    'Meeticulous is a small, remote-first team building booking pages + payments for India’s creators and professionals. We move fast, care about craft, and keep things calm.',
};

export const jobs = [
  {
    slug: 'digital-marketeer',
    title: 'Digital Marketeer',
    team: 'Marketing',
    location: 'Remote / India',
    type: 'Full-time',
    comp: '₹6–9 LPA',
    summary:
      'Own paid + organic growth for Meeticulous — from ad campaigns to content that turns creators into customers.',
    responsibilities: [
      'Plan and run paid campaigns across Meta, Google, and emerging channels.',
      'Own the content calendar: landing pages, email, and social.',
      'Track funnels end-to-end and report on CAC, conversion, and retention.',
      'Partner with product on launches and lifecycle messaging.',
    ],
    requirements: [
      '2+ years in performance or growth marketing for a consumer/SaaS product.',
      'Hands-on with Meta Ads Manager, Google Ads, and analytics tools.',
      'Strong writing — you can turn a feature into a story.',
      'Comfortable owning numbers and reporting on them.',
    ],
    niceToHaves: [
      'Experience marketing to creators or SMBs in India.',
      'Basic design skills (Canva/Figma) for quick assets.',
      'SEO/content-led growth experience.',
    ],
    postedDate: '2026-06-26',
    validThrough: '2026-12-31T23:59:59+05:30',
    status: 'open',
  },
  {
    slug: 'mern-stack-developer',
    title: 'MERN Stack Developer',
    team: 'Engineering',
    location: 'Remote / India',
    type: 'Full-time',
    comp: '₹8–16 LPA',
    summary:
      'Build features end-to-end across our React frontend and Node/Express backend on Supabase — with real ownership from day one.',
    responsibilities: [
      'Ship features across the React (Vite) client and Node/Express API.',
      'Model data and write queries against Supabase (PostgreSQL).',
      'Integrate third-party services (payments, email, calendar).',
      'Write tests and review teammates’ code.',
    ],
    requirements: [
      '2+ years building production apps with React and Node.js.',
      'Solid SQL and REST API design.',
      'Comfortable owning a feature from schema to UI.',
      'Care about correctness, tests, and clean diffs.',
    ],
    niceToHaves: [
      'Experience with Supabase, Razorpay, or Google APIs.',
      'An eye for UI polish and motion.',
      'Worked on a payments or scheduling product.',
    ],
    postedDate: '2026-06-26',
    validThrough: '2026-12-31T23:59:59+05:30',
    status: 'open',
  },
  {
    slug: 'sales-associate',
    title: 'Sales Associate',
    team: 'Sales',
    location: 'Remote / India',
    type: 'Full-time',
    comp: '₹4–7 LPA + incentives',
    summary:
      'Be the first human creators meet — reach out, onboard, and turn interested hosts into thriving Meeticulous businesses.',
    responsibilities: [
      'Run outbound to creators and professionals across channels.',
      'Onboard new hosts and get them to their first booking.',
      'Gather feedback from the field and feed it back to product.',
      'Hit clear monthly activation and revenue targets.',
    ],
    requirements: [
      '1+ year in sales, partnerships, or community for a consumer product.',
      'Excellent spoken + written communication (English + Hindi a plus).',
      'Self-driven, organized, comfortable with targets.',
      'Genuine empathy for creators and small businesses.',
    ],
    niceToHaves: [
      'Existing network in the Indian creator economy.',
      'Experience with a CRM and outbound tooling.',
      'Regional language fluency.',
    ],
    postedDate: '2026-06-26',
    validThrough: '2026-12-31T23:59:59+05:30',
    status: 'open',
  },
];

export const getOpenJobs = () => jobs.filter((j) => j.status === 'open');
export const getJobBySlug = (slug) => jobs.find((j) => j.slug === slug);

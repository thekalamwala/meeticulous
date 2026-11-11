import ContributorProfile from '../../components/community/ContributorProfile';

// Founder's public community profile — /community/sndatarkar. Hand-written.

const DATA = {
  pageTitle: 'Shubham Datarkar — Founder · Meeticulous',
  name: 'Shubham Datarkar',
  avatar: { initial: 'S' },
  title: 'Founder',
  org: 'Meeticulous',
  verified: true,
  houseLabel: 'Founder',
  handle: '@sndatarkar',
  location: 'Nagpur, India',
  email: 'team@meeticulous.com',
  script: 'Build in the open.',
  bio: 'Founder of Meeticulous. I build in the open, read every piece of feedback, and hang around the community to hear what hosts and guests actually need next.',
  stats: [
    { value: 'Founder', label: 'Meeticulous' },
    { value: 'Open', label: 'Build in public' },
    { value: 'DMs', label: 'Always open' },
  ],
  badges: [
    { emoji: '🛠️', label: 'Builder' },
    { emoji: '👋', label: 'Talks to everyone' },
    { emoji: '📣', label: 'Ships weekly' },
  ],
  posts: [
    {
      category: 'Note',
      time: 'Pinned',
      title: 'What I want from this community',
      excerpt: "A warm room where hosts help hosts. Tell me what's missing — I read all of it, and a lot of it ships.",
    },
    {
      category: 'Build in public',
      title: 'Why Meeticulous exists',
      excerpt: 'Independent professionals deserve booking software that respects them and their guests. That is the whole bet.',
    },
  ],
  about: [
    "I'm Shubham, founder of Meeticulous. I started this to give independent professionals a booking platform that feels made for them, not bolted on.",
    'I spend real time in the community — answering, listening, and turning the good ideas into features.',
  ],
  links: [
    { label: 'Meeticulous community', href: '/community' },
    { label: 'Email the team', href: 'mailto:team@meeticulous.com' },
  ],
  tip: {
    vpa: '8637758344@ybl',
    payeeName: 'Shubham',
    note: 'Tip for Shubham',
    heading: 'Buy me a chai',
  },
};

export default function ContributorShubham() {
  return <ContributorProfile data={DATA} />;
}

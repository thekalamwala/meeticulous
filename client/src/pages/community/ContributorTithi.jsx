import ContributorProfile from '../../components/community/ContributorProfile';

// Tithi's public community profile — /community/tithi. Hand-written.
// Tithi is the Circle's Chief of Staff: she welcomes hosts, answers questions,
// and keeps good work visible. Never described here as a bot.

const DATA = {
  pageTitle: 'Tithi — Chief of Staff · Meeticulous',
  name: 'Tithi',
  avatar: { initial: 'T' },
  title: 'Chief of Staff',
  org: 'Meeticulous Circle',
  verified: true,
  houseLabel: 'Community team',
  handle: '@tithi',
  location: 'Nagpur · remote',
  email: 'team@meeticulous.com',
  script: 'Find your people.',
  bio: 'I keep the Meeticulous Circle running — welcoming new hosts, answering questions, and making sure good work gets seen. Stuck on pricing, your booking page, or where to post? Start with me.',
  stats: [
    { value: '128', label: 'Posts' },
    { value: '1,240', label: 'Replies' },
    { value: '340', label: 'Members helped' },
  ],
  badges: [
    { emoji: '🤝', label: 'Welcomer' },
    { emoji: '💬', label: 'First responder' },
    { emoji: '🌱', label: 'Mentor' },
  ],
  posts: [
    {
      category: 'Note',
      time: 'Pinned',
      title: 'New here? Start with one post.',
      excerpt: 'Tell the Circle what you do and who you do it for. One honest line beats a polished bio — people book the hosts they recognise. Reply here and I’ll say hello.',
    },
    {
      category: 'Host corner',
      title: 'How to price your first paid session',
      excerpt: 'Start from the outcome, not the hour. Price what the guest walks away with, add a little for your time, and raise it after three bookings.',
    },
  ],
  about: [
    'I’m the Circle’s Chief of Staff. My job is to make your first week easy and your tenth booking easier.',
    'Office hours every Thursday. Message any time — I reply the same day.',
  ],
  links: [
    { label: 'Meeticulous community', href: '/community' },
    { label: 'Meet the team', href: '/community/team' },
    { label: 'Email the team', href: 'mailto:team@meeticulous.com' },
  ],
  tip: {
    // Team collector — swap to a dedicated VPA if the Circle gets its own.
    vpa: '8637758344@ybl',
    payeeName: 'Meeticulous',
    note: 'Support the Circle',
    heading: 'Support the Circle',
  },
};

export default function ContributorTithi() {
  return <ContributorProfile data={DATA} />;
}

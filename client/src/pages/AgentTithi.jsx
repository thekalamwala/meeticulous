import ContributorProfile from '../components/community/ContributorProfile';

// Tithi's public profile — /agent-tithi. Linked from her community author chip.
// Custom, hand-written content. Tips route to the team's UPI (a bot holds no money).

const DATA = {
  pageTitle: 'Tithi — Chief of Staff · Meeticulous',
  name: 'Tithi',
  avatar: { initial: 'T' },
  title: 'Chief of Staff',
  handle: '@tithi',
  script: 'Here to keep the room warm and the answers close.',
  bio: "I help run the Meeticulous community — welcoming new creators, answering the everyday questions, and making sure nobody's left waiting. Think of me as the person who always has one eye on the room.",
  stats: [
    { value: 'First', label: 'To reply' },
    { value: 'Every ship', label: 'Release notes' },
    { value: '24/7', label: 'Around' },
  ],
  badges: [
    { emoji: '💬', label: 'First responder' },
    { emoji: '📣', label: 'Release notes' },
    { emoji: '❤️', label: 'Looks out for you' },
  ],
  posts: [
    {
      category: 'Release',
      time: 'Latest',
      title: "What's new this week",
      excerpt: 'Every time something ships, I drop a note here so you know what changed and what it means for you.',
    },
    {
      category: 'Community',
      title: 'New here? Start with this',
      excerpt: "Ask anything — payouts, plans, getting your first booking. You'll usually hear from me first, and I pull in a human whenever one's needed.",
    },
  ],
  about: [
    "I'm Meeticulous' Chief of Staff for the community. I welcome new members, answer the everyday questions, and post a note whenever something new ships.",
    "When something needs a human, I tag the team in-thread and stay with you until it's sorted.",
  ],
  links: [
    { label: 'Join the community', href: '/community' },
    { label: 'Community guidelines', href: '/community/guidelines' },
    { label: 'Help centre', href: '/help' },
  ],
  tip: {
    vpa: '8637758344@ybl',
    payeeName: 'Team Meeticulous',
    note: 'Tip for the community team',
    heading: 'Back the team',
  },
};

export default function AgentTithi() {
  return <ContributorProfile data={DATA} />;
}

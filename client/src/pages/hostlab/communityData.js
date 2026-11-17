// ─────────────────────────────────────────────────────────────────────────────
// Community — PROTOTYPE fixtures for Ananya Rao.
//
// Its own module, like intelData, because mockData.js is edited concurrently on
// this branch. Invented sample data: never sent to an API, never written to
// Supabase, never read by a production page.
//
// Every field here maps to a real column, so a screen that graduates from the
// lab swaps the fixture for the query without a rewrite:
//   community_spaces      key, name, description, post_policy, is_active
//   community_posts       kind, title, slug, like_count, comment_count,
//                         accepted_comment_id, mentions_host_id,
//                         verified_booking, is_pinned, last_activity_at
//   community_comments    post_id, body, like_count, created_at
//   community_members     post_count, comment_count, follower_count, badge, title
// The five spaces below are the five actually seeded in the database.
// ─────────────────────────────────────────────────────────────────────────────

/* ── The host's standing in the community (community_members) ──────────── */
export const me = {
  postCount: 14,
  commentCount: 63,
  followerCount: 88,
  badge: 'host',
  title: 'Nutritionist · Pune',
  acceptedAnswers: 9,
  likesReceived: 241,
  deltas: { posts: 16, comments: 24, followers: 11, likes: 31 },
  activity: [
    { label: 'Jun', value: 4 }, { label: 'Jul', value: 7 }, { label: 'Aug', value: 9 },
    { label: 'Sep', value: 12 }, { label: 'Oct', value: 18 }, { label: 'Nov', value: 23 },
  ],
};

/* ── The five seeded spaces, with their real post policies ─────────────── */
export const spaces = [
  { key: 'updates', name: 'Meeticulous Updates', description: 'Product news and announcements from the Meeticulous team.', policy: 'official', posts: 42, unread: 3 },
  { key: 'help', name: 'Help & Questions', description: 'Ask how things work and get answers from the community.', policy: 'everyone', posts: 318, unread: 11 },
  { key: 'ideas', name: 'Ideas & Feedback', description: 'Tell us what to build next.', policy: 'everyone', posts: 96, unread: 2 },
  { key: 'host-corner', name: 'Host Corner', description: 'Hosts talk shop: pricing, growth and what is working.', policy: 'hosts', posts: 174, unread: 6 },
  { key: 'general', name: 'General', description: 'Everything else.', policy: 'everyone', posts: 61, unread: 0 },
];

/* ── Open questions a host could answer (community_posts in `help` with no
 *   accepted_comment_id). Answering is the cheapest visibility there is. ── */
export const unanswered = [
  { slug: 'gst-on-cancelled-booking', title: 'Does GST still apply if I refund a cancelled session?', space: 'help', asked: '2h', replies: 0, views: 34, tag: 'payments' },
  { slug: 'diet-plan-pricing', title: 'What do you charge for a one-off diet plan with no follow-up?', space: 'host-corner', asked: '5h', replies: 2, views: 71, tag: 'pricing' },
  { slug: 'no-show-policy-wording', title: 'How do you word a no-show policy without sounding harsh?', space: 'help', asked: '1d', replies: 1, views: 58, tag: 'policy' },
  { slug: 'whatsapp-reminders-timing', title: 'Is a 1-hour reminder enough, or should I send two?', space: 'help', asked: '2d', replies: 0, views: 29, tag: 'reminders' },
];

/* ── Posts that name this host (community_posts.mentions_host_id) ──────── */
export const mentions = [
  { slug: 'who-do-you-see-for-sports-nutrition', title: 'Who do you see for sports nutrition in Pune?', by: 'Rhea Kulkarni', space: 'general', when: '6h', replies: 7, verifiedBooking: true, read: false },
  { slug: 'best-nutritionist-experience', title: 'Finally found a nutritionist who explains the why', by: 'Kabir Menon', space: 'general', when: '3d', replies: 12, verifiedBooking: true, read: true },
  { slug: 'recommendations-thread-nov', title: 'November recommendations thread', by: 'Meeticulous Updates', space: 'updates', when: '1w', replies: 31, verifiedBooking: false, read: true },
];

/* ── The host's own posts (community_posts by author) ──────────────────── */
export const myPosts = [
  { slug: 'protein-myths-india', title: 'Three protein myths I hear every single week', space: 'host-corner', when: '2d', likes: 34, replies: 11, accepted: false, pinned: true },
  { slug: 'how-i-price-followups', title: 'How I price follow-ups so people actually come back', space: 'host-corner', when: '1w', likes: 52, replies: 18, accepted: false, pinned: false },
  { slug: 'answer-gst-invoice', title: 'Re: Where do I find the GST invoice for a booking?', space: 'help', when: '1w', likes: 9, replies: 0, accepted: true, pinned: false },
  { slug: 'festive-season-slots', title: 'Opening festive-season slots: what worked', space: 'host-corner', when: '3w', likes: 27, replies: 6, accepted: false, pinned: false },
];

export default { me, spaces, unanswered, mentions, myPosts };

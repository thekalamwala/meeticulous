'use strict';
// Community JSON-LD (spec §15). Pure + deterministic: inputs are serializeItem/serializeComment
// output, never raw rows. The client mirror must reproduce tests/fixtures/community-jsonld.json
// exactly (values AND key order), so never add Date.now() or reorder keys here alone.

const MAX_COMMENTS = 20;
const MAX_SUGGESTED = 10;
const trimSlash = (s) => String(s || '').replace(/\/+$/, '');
const live = (comments) => (comments || []).filter((c) => c && c.status === 'visible'); // tombstones never appear

const headlineOf = (item) => item.title || String(item.body || '').replace(/\s+/g, ' ').trim().slice(0, 110);

// Guests: first name only, no url (spec §13). Hosts link to their public profile.
function person(author, site) {
  if (!author || author.role === 'deleted') return { '@type': 'Person', name: 'Deleted account' };
  return author.profile_url
    ? { '@type': 'Person', name: author.display_name, url: `${site}${author.profile_url}` }
    : { '@type': 'Person', name: author.display_name };
}

const counter = (type, n) => ({
  '@type': 'InteractionCounter', interactionType: `https://schema.org/${type}`, userInteractionCount: Number(n) || 0,
});

function discussionForumPostingJsonLd(item, comments, siteUrl) {
  const site = trimSlash(siteUrl);
  const url = `${site}${item.url}`;
  const replies = live(comments).slice(0, MAX_COMMENTS).map((c) => ({
    '@type': 'Comment',
    text: c.body,
    author: person(c.author, site),
    datePublished: c.created_at,
    url: `${url}#c-${c.id}`,
  }));
  const image = item.media?.[0]?.url;
  return {
    '@context': 'https://schema.org',
    '@type': 'DiscussionForumPosting',
    headline: headlineOf(item),
    text: item.body,
    url,
    datePublished: item.created_at,
    dateModified: item.edited_at || item.last_activity_at,
    author: person(item.author, site),
    interactionStatistic: [counter('LikeAction', item.like_count), counter('CommentAction', item.comment_count)],
    ...(replies.length ? { comment: replies } : {}),
    ...(image ? { image } : {}),
  };
}

// QAPage only for a question whose accepted reply is still visible; null otherwise.
function qaPageJsonLd(item, comments, siteUrl) {
  if (item.format !== 'question' || !item.accepted_comment_id) return null;
  const site = trimSlash(siteUrl);
  const url = `${site}${item.url}`;
  const visible = live(comments);
  const accepted = visible.find((c) => c.id === item.accepted_comment_id);
  if (!accepted) return null;
  const answer = (c) => ({
    '@type': 'Answer',
    text: c.body,
    author: person(c.author, site),
    dateCreated: c.created_at,
    url: `${url}#c-${c.id}`,
    upvoteCount: Number(c.like_count) || 0,
  });
  const suggested = visible.filter((c) => c.id !== accepted.id).slice(0, MAX_SUGGESTED).map(answer);
  return {
    '@context': 'https://schema.org',
    '@type': 'QAPage',
    mainEntity: {
      '@type': 'Question',
      name: headlineOf(item),
      text: item.body,
      answerCount: Number(item.comment_count) || 0,
      dateCreated: item.created_at,
      author: person(item.author, site),
      acceptedAnswer: answer(accepted),
      ...(suggested.length ? { suggestedAnswer: suggested } : {}),
    },
  };
}

// Community › Space › Item; either tail level is optional.
function communityBreadcrumbJsonLd(item, space, siteUrl) {
  const site = trimSlash(siteUrl);
  const crumbs = [['Community', `${site}/community`]];
  if (space) crumbs.push([space.name, `${site}/community/s/${space.key}`]);
  if (item) crumbs.push([headlineOf(item), `${site}${item.url}`]);
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map(([name, href], i) => ({ '@type': 'ListItem', position: i + 1, name, item: href })),
  };
}

module.exports = { discussionForumPostingJsonLd, qaPageJsonLd, communityBreadcrumbJsonLd, headlineOf };

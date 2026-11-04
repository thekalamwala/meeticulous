'use strict';
// JSON-LD builders vs the shared fixture. The client builders (later task) must reproduce the
// same fixture, so this compares serialized JSON: values AND key order.
const { cases } = require('../../fixtures/community-jsonld.json');
const { discussionForumPostingJsonLd, qaPageJsonLd, communityBreadcrumbJsonLd } = require('../../../services/community/jsonLd');

const same = (actual, expected) => expect(JSON.stringify(actual)).toBe(JSON.stringify(expected));

describe.each(cases)('$name', ({ siteUrl, item, comments, space, expected }) => {
  test('DiscussionForumPosting', () => same(discussionForumPostingJsonLd(item, comments, siteUrl), expected.posting));
  test('QAPage', () => same(qaPageJsonLd(item, comments, siteUrl), expected.qaPage));
  test('BreadcrumbList', () => same(communityBreadcrumbJsonLd(item, space, siteUrl), expected.breadcrumb));
});

describe('builder rules', () => {
  const [thread, question] = cases;

  test('caps comment[] at 20 and suggestedAnswer[] at 10', () => {
    const c = thread.comments[0];
    const many = Array.from({ length: 30 }, (_, i) => ({ ...c, id: `m${i}` }));
    expect(discussionForumPostingJsonLd(thread.item, many, thread.siteUrl).comment).toHaveLength(20);
    const qa = qaPageJsonLd(question.item, [...many, question.comments[1]], question.siteUrl);
    expect(qa.mainEntity.suggestedAnswer).toHaveLength(10);
  });

  test('no QAPage when the accepted reply is missing or a tombstone', () => {
    const { item, comments, siteUrl } = question;
    expect(qaPageJsonLd({ ...item, accepted_comment_id: null }, comments, siteUrl)).toBeNull();
    const gone = comments.map((c) => (c.id === 'c11' ? { ...c, status: 'removed', body: '' } : c));
    expect(qaPageJsonLd(item, gone, siteUrl)).toBeNull();
  });

  test('no QAPage for a non-question even with accepted_comment_id', () => {
    const { item, comments, siteUrl } = question;
    expect(qaPageJsonLd({ ...item, format: 'text' }, comments, siteUrl)).toBeNull();
  });

  test('Community-only and Community > Space breadcrumbs', () => {
    expect(communityBreadcrumbJsonLd(null, null, 'https://meeticulous.com').itemListElement).toEqual([
      { '@type': 'ListItem', position: 1, name: 'Community', item: 'https://meeticulous.com/community' },
    ]);
    expect(communityBreadcrumbJsonLd(null, { key: 'help', name: 'Help & Questions' }, 'https://meeticulous.com').itemListElement[1])
      .toEqual({ '@type': 'ListItem', position: 2, name: 'Help & Questions', item: 'https://meeticulous.com/community/s/help' });
  });
});

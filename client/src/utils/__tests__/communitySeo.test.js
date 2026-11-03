// Client JSON-LD builders vs the SAME fixture the server suite uses
// (server/tests/unit/community/jsonLd.test.js). Serialized compare = values AND key order.
import fixture from '../../../../server/tests/fixtures/community-jsonld.json';
import { discussionForumPostingJsonLd, qaPageJsonLd, communityBreadcrumbJsonLd } from '../communitySeo';

const same = (actual, expected) => expect(JSON.stringify(actual)).toBe(JSON.stringify(expected));

describe.each(fixture.cases)('$name', ({ siteUrl, item, comments, space, expected }) => {
  test('DiscussionForumPosting', () => same(discussionForumPostingJsonLd(item, comments, siteUrl), expected.posting));
  test('QAPage', () => same(qaPageJsonLd(item, comments, siteUrl), expected.qaPage));
  test('BreadcrumbList', () => same(communityBreadcrumbJsonLd(item, space, siteUrl), expected.breadcrumb));
});

test('breadcrumb with no item and no space is just Community', () => {
  expect(communityBreadcrumbJsonLd(null, null, 'https://meeticulous.com/').itemListElement).toEqual([
    { '@type': 'ListItem', position: 1, name: 'Community', item: 'https://meeticulous.com/community' },
  ]);
});

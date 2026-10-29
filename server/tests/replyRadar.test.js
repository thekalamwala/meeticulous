const { redditQueries, parseRedditAtom, canonicalPost, tagLinks, toMarkdown } = require('../scripts/replyRadar');

// Trimmed real Reddit search RSS entry (Atom, XML-escaped HTML body).
const ATOM = `<?xml version="1.0" encoding="UTF-8"?><feed xmlns="http://www.w3.org/2005/Atom"><title>freelance: search results</title>
<entry><author><name>/u/someone</name></author><category term="freelance" label="r/freelance"/><content type="html">&lt;!-- SC_OFF --&gt;&lt;div class=&quot;md&quot;&gt;&lt;p&gt;Here&amp;#39;s my situation &amp;amp; question.&lt;/p&gt; &lt;p&gt;Second para.&lt;/p&gt;&lt;/div&gt;&lt;!-- SC_ON --&gt; &amp;#32; submitted by &amp;#32; &lt;a href=&quot;https://www.reddit.com/user/someone&quot;&gt; /u/someone &lt;/a&gt;</content><id>t3_1wp9v5t</id><link href="https://www.reddit.com/r/freelance/comments/1wp9v5t/is_there/" /><updated>2026-09-24T18:39:46+00:00</updated><published>2026-09-24T18:39:46+00:00</published><title>Is there a point in negotiating &amp; walking away?</title></entry>
<entry><category term="freelance" label="r/freelance"/><content type="html"></content><id>t3_old</id><link href="https://www.reddit.com/r/freelance/comments/old/x/" /><published>2025-01-01T00:00:00+00:00</published><title>Old</title></entry>
</feed>`;

describe('replyRadar helpers', () => {
  test('redditQueries batches subreddits under the length cap', () => {
    const qs = redditQueries(['aaaa', 'bbbb', 'cccc'], ['x y', 'z'], 60);
    expect(qs[0]).toBe('(subreddit:aaaa OR subreddit:bbbb) ("x y" OR "z")');
    expect(qs).toHaveLength(2);
    expect(qs.every((q) => q.length <= 60)).toBe(true);
    expect(redditQueries(['a'], ['b'])).toEqual(['(subreddit:a) ("b")']);
  });

  test('parseRedditAtom decodes posts and drops ones older than the window', () => {
    const posts = parseRedditAtom(ATOM, Date.parse('2026-09-01'));
    expect(posts).toHaveLength(1);
    expect(posts[0]).toEqual({
      id: 'reddit:1wp9v5t',
      platform: 'reddit',
      where: 'r/freelance',
      title: 'Is there a point in negotiating & walking away?',
      body: "Here's my situation & question.\n\nSecond para.",
      url: 'https://www.reddit.com/r/freelance/comments/1wp9v5t/is_there/',
      created: '2026-09-24',
    });
  });

  test('canonicalPost normalises Reddit + Quora URLs and rejects non-posts', () => {
    expect(canonicalPost('https://old.reddit.com/r/freelance/comments/abc/slug/?x=1')).toMatchObject({ id: 'reddit:abc', where: 'r/freelance', url: 'https://www.reddit.com/r/freelance/comments/abc/' });
    expect(canonicalPost('https://www.reddit.com/r/freelance/')).toBeNull();
    expect(canonicalPost('https://www.quora.com/What-is-X/answer/Someone?ch=1')).toMatchObject({ id: 'quora:https://www.quora.com/What-is-X', where: 'Quora' });
    expect(canonicalPost('https://hi.quora.com/Kya-hai')).toMatchObject({ url: 'https://www.quora.com/Kya-hai' });
    expect(canonicalPost('https://www.quora.com/profile/Someone')).toBeNull();
    expect(canonicalPost('https://evilquora.com/x')).toBeNull();
    expect(canonicalPost('not a url')).toBeNull();
  });

  test('tagLinks UTM-tags homepage mentions (never ?ref=), leaves host pages alone', () => {
    const tagged = 'https://bookasloth.com/?utm_source=reddit&utm_medium=comment&utm_campaign=reply-radar';
    expect(tagLinks('Try bookasloth.com.', 'reddit')).toBe(`Try ${tagged}.`);
    expect(tagLinks('see https://www.bookasloth.com/ and BookASloth.com', 'reddit')).toBe(`see ${tagged} and ${tagged}`);
    expect(tagLinks('bookasloth.com', 'quora')).toContain('utm_source=quora');
    expect(tagLinks('my page bookasloth.com/jane', 'reddit')).toBe('my page bookasloth.com/jane');
    expect(tagLinks('x', 'reddit')).not.toContain('ref=');
  });

  test('toMarkdown groups by route, sorts by score, counts skips', () => {
    const row = { where: 'r/x', created: '2026-10-10', url: 'u', why: 'w', reply: 'r' };
    const md = toMarkdown([
      { ...row, route: 'lead', score: 4, title: 'low' },
      { ...row, route: 'lead', score: 9, title: 'high' },
      { ...row, route: 'skip', score: 1, title: 'nope' },
    ], '2026-10-10');
    expect(md).toContain('## Leads (2)');
    expect(md.indexOf('high')).toBeLessThan(md.indexOf('low'));
    expect(md).not.toContain('nope');
    expect(md).toContain('1 posts skipped');
  });
});

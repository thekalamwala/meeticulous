import { describe, it, expect, beforeEach, vi } from 'vitest';

// prerenderData caches the parsed blob per document, so each case loads a fresh module.
const load = async (json) => {
  document.head.innerHTML = '';
  if (json !== undefined) {
    const s = document.createElement('script');
    s.type = 'application/json';
    s.id = '__bas_data';
    s.textContent = json;
    document.head.appendChild(s);
  }
  vi.resetModules();
  return (await import('../prerenderData')).prerendered;
};

describe('prerendered()', () => {
  beforeEach(() => { document.head.innerHTML = ''; });

  it('returns the baked API body for a path', async () => {
    const prerendered = await load(JSON.stringify({ '/blogs/a': { post: { slug: 'a' } } }));
    expect(prerendered('/blogs/a')).toEqual({ post: { slug: 'a' } });
    expect(prerendered('/blogs/b')).toBeUndefined();
  });

  it('decodes the \\u003c escape the prerender writes', async () => {
    const prerendered = await load(JSON.stringify({ '/x': { html: '</script>' } }).replace(/</g, '\\u003c'));
    expect(prerendered('/x').html).toBe('</script>');
  });

  it('is empty (never throws) without the tag or on bad JSON', async () => {
    expect((await load())('/blogs/a')).toBeUndefined();
    expect((await load('{not json'))('/blogs/a')).toBeUndefined();
  });
});

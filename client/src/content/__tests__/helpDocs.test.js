import { describe, it, expect } from 'vitest';
import { readdirSync } from 'fs';
import { resolve } from 'path';
import { parseBlocks } from '../../components/common/Markdown';
import { HELP_SLUGS, HELP_CATEGORIES, HELP_DOCS } from '../helpDocsList';
import { loadedHelpSlugs, getHelpDoc, helpGroups } from '../helpDocs';

const sorted = (a) => [...a].sort();

describe('help docs manifest', () => {
  it('list, bundled markdown, and files on disk all agree (no drift)', () => {
    // Files actually in docs/help/ (vitest cwd is the client dir).
    const files = readdirSync(resolve(process.cwd(), '../docs/help'))
      .filter((f) => f.endsWith('.md'))
      .map((f) => f.replace(/\.md$/, ''));
    expect(sorted(HELP_SLUGS)).toEqual(sorted(files));       // list matches disk
    expect(sorted(loadedHelpSlugs())).toEqual(sorted(files)); // bundle matches disk
  });

  it('every doc has a title and a body, and a known category', () => {
    for (const { slug, category } of HELP_DOCS) {
      const doc = getHelpDoc(slug);
      expect(doc, slug).toBeTruthy();
      expect(doc.title.length, slug).toBeGreaterThan(0);
      expect(doc.body.length, slug).toBeGreaterThan(0);
      expect(HELP_CATEGORIES).toContain(category);
    }
  });

  it('groups cover every article', () => {
    const grouped = helpGroups().flatMap((g) => g.docs.map((d) => d.slug));
    expect(sorted(grouped)).toEqual(sorted(HELP_SLUGS));
  });
});

describe('markdown parseBlocks', () => {
  it('detects headings, lists, and paragraphs', () => {
    const blocks = parseBlocks('# Title\n\nA para.\n\n## Sub\n\n- one\n- two\n\n1. first\n2. second');
    expect(blocks[0]).toEqual({ type: 'h', level: 1, text: 'Title' });
    expect(blocks.find((b) => b.type === 'ul').items).toEqual(['one', 'two']);
    expect(blocks.find((b) => b.type === 'ol').items).toEqual(['first', 'second']);
    expect(blocks.some((b) => b.type === 'p' && b.text === 'A para.')).toBe(true);
  });

  it('joins wrapped lines into one paragraph and separates on blank lines', () => {
    const blocks = parseBlocks('line one\nline two\n\nnext para');
    const paras = blocks.filter((b) => b.type === 'p');
    expect(paras).toHaveLength(2);
    expect(paras[0].text).toBe('line one line two');
  });
});

import { describe, it, expect } from 'vitest';
import { activityRows, isOpenQuestion } from '../pages/grow/GrowCommunity';

const at = (d) => new Date(Date.UTC(2026, 10, d)).toISOString();
const data = {
  posts: [{ id: 1, title: 'P', body: 'b', like_count: 1, comment_count: 2, created_at: at(3), url: '/p' }],
  comments: [{ id: 2, body: 'c', like_count: 0, created_at: at(5), parent: { title: 'T', url: '/t' } }],
  mentions: [{ id: 3, author: { display_name: 'Ishita' }, post: { title: 'M', url: '/m' }, snippet: 's', created_at: at(4) }],
};

describe('activityRows', () => {
  it('merges posts, comments and mentions newest first', () => {
    expect(activityRows(data).map((r) => r.kind)).toEqual(['Comment', 'Mention', 'Post']);
  });
  it('filters to one kind, Mentions included', () => {
    expect(activityRows(data, 'mentions').map((r) => r.title)).toEqual(['M']);
    expect(activityRows(data, 'mentions')[0].meta).toBe('Ishita named you');
    expect(activityRows(data, 'posts')[0].meta).toBe('1 like · 2 replies');
    expect(activityRows(data, 'comments')[0].title).toBe('On: T');
  });
  it('copes with nothing', () => {
    expect(activityRows({})).toEqual([]);
  });
});

describe('isOpenQuestion', () => {
  it('keeps visible, unlocked questions with no accepted answer', () => {
    const q = { format: 'question', status: 'visible', locked: false, accepted_comment_id: null };
    expect(isOpenQuestion(q)).toBe(true);
    expect(isOpenQuestion({ ...q, accepted_comment_id: 'x' })).toBe(false);
    expect(isOpenQuestion({ ...q, format: 'post' })).toBe(false);
    expect(isOpenQuestion({ ...q, locked: true })).toBe(false);
  });
});

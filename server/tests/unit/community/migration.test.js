const fs = require('fs');
const path = require('path');

const sql = fs.readFileSync(path.join(__dirname, '../../../migrations/v3.185_community.sql'), 'utf8');
const tables = ['community_members', 'community_spaces', 'community_posts', 'community_comments',
  'community_media', 'community_embeds', 'community_polls', 'community_poll_options',
  'community_poll_votes', 'community_reactions', 'community_follows', 'community_blocks',
  'community_saves', 'community_mentions', 'community_hashtags', 'community_post_hashtags',
  'community_reports', 'community_ads'];

describe('v3.185 community migration (static)', () => {
  test.each(tables)('creates %s', (t) => {
    expect(sql).toContain(`CREATE TABLE IF NOT EXISTS ${t} (`);
  });
  test('RLS on all 18, no policies', () => {
    expect(sql.match(/ENABLE ROW LEVEL SECURITY/g)).toHaveLength(18);
    expect(sql).not.toMatch(/CREATE POLICY/);
  });
  const block = (t) => sql.slice(sql.indexOf(`CREATE TABLE IF NOT EXISTS ${t} (`)).split(');')[0];
  test.each([
    ['community_posts', 'author_id'],
    ['community_comments', 'author_id'],
    ['community_reports', 'reporter_id'],
  ])('%s.%s is ON DELETE SET NULL', (t, col) => {
    expect(block(t)).toMatch(new RegExp(`${col}\\s+uuid REFERENCES profiles\\(id\\) ON DELETE SET NULL`));
  });
  test.each([
    ['updates', 'official', 'everyone'], ['help', 'everyone', 'everyone'], ['ideas', 'everyone', 'everyone'],
    ['host-corner', 'hosts', 'hosts'], ['general', 'everyone', 'everyone'],
  ])('seeds space %s with policies %s/%s', (k, post, reply) => {
    expect(sql).toMatch(new RegExp(`\\('${k}',[^\\n]*,\\s*\\d,\\s*'${post}',\\s*'${reply}'\\)`));
  });
  test('every function pins search_path', () => {
    const fns = sql.match(/CREATE OR REPLACE FUNCTION/g).length;
    expect(sql.match(/SET search_path = public;/g)).toHaveLength(fns);
  });
  test('repost unique index ignores soft-deleted rows', () => {
    expect(sql).toMatch(/uq_community_repost[^;]*status <> 'deleted'/);
  });
  test('poll votes use composite FK and reject UPDATE', () => {
    expect(sql).toContain('FOREIGN KEY (option_id, post_id) REFERENCES community_poll_options(id, post_id)');
    expect(sql).toContain('BEFORE UPDATE ON community_poll_votes');
  });
  test('header names the DB', () => {
    expect(sql).toContain('APPLY TO the Meeticulous DB (spquowzrefozmrzoszkf)');
  });
  test.each(['updates', 'help', 'ideas', 'host-corner', 'general'])('seeds space %s', (k) => {
    expect(sql).toContain(`'${k}'`);
  });
  test.each(['COMMUNITY_REPLY', 'COMMUNITY_MENTION', 'COMMUNITY_CONTENT_REMOVED'])('seeds event %s', (k) => {
    expect(sql).toContain(`'${k}'`);
  });
});

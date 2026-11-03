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
  test('author/reporter FKs are SET NULL', () => {
    expect(sql).toMatch(/author_id\s+uuid REFERENCES profiles\(id\) ON DELETE SET NULL/);
    expect(sql).toMatch(/reporter_id\s+uuid REFERENCES profiles\(id\) ON DELETE SET NULL/);
    expect(sql.match(/ON DELETE SET NULL/g).length).toBeGreaterThanOrEqual(3);
  });
  test.each(['updates', 'help', 'ideas', 'host-corner', 'general'])('seeds space %s', (k) => {
    expect(sql).toContain(`'${k}'`);
  });
  test.each(['COMMUNITY_REPLY', 'COMMUNITY_MENTION', 'COMMUNITY_CONTENT_REMOVED'])('seeds event %s', (k) => {
    expect(sql).toContain(`'${k}'`);
  });
});

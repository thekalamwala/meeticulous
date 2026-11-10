'use strict';
// Seed Tithi's community identity: point this at an EXISTING account (her profile) and it
// names her "Tithi", gives her a community_members row as "Chief of Staff" (badge staff,
// early access, terms accepted) so she can post before launch. It does NOT create an auth
// user — create/choose Tithi's account first, then pass its id.
//
// Run locally from server/ (Render Free has no Shell — see memory):
//   node scripts/seedTithiCommunity.js <profile-user-id>
//   (or set COMMUNITY_TITHI_USER_ID and run with no arg)
// Then set COMMUNITY_TITHI_USER_ID=<that id> in the server env so Tithi posts as her.
// Optional: COMMUNITY_TITHI_AVATAR=<image url> sets her photo.
//
// Idempotent (upsert on user_id). Title is written only if the v3.199 column exists; if it
// doesn't yet, the row is seeded without it — apply v3.199 and re-run to add the title.

const { supabaseAdmin } = require('../config/supabase');
const { CURRENT_TERMS_VERSION } = require('../middleware/communityGate');

async function seedTithi(userId, { name = 'Tithi', avatar = process.env.COMMUNITY_TITHI_AVATAR || null } = {}) {
  if (!userId) throw new Error('user id required: node scripts/seedTithiCommunity.js <profile-user-id> (or set COMMUNITY_TITHI_USER_ID)');

  const { data: prof, error: pe } = await supabaseAdmin.from('profiles').select('id').eq('id', userId).maybeSingle();
  if (pe) throw pe;
  if (!prof) throw new Error(`no profiles row for ${userId} — create/choose Tithi's account first, then pass its id`);

  const pPatch = { name, first_name: name };
  if (avatar) pPatch.profile_image = avatar;
  const { error: upe } = await supabaseAdmin.from('profiles').update(pPatch).eq('id', userId);
  if (upe) throw upe;

  const base = {
    user_id: userId, badge: 'staff', early_access: true,
    terms_version: CURRENT_TERMS_VERSION, terms_accepted_at: new Date().toISOString(),
  };
  let titleApplied = true;
  let { error } = await supabaseAdmin.from('community_members').upsert({ ...base, title: 'Chief of Staff' }, { onConflict: 'user_id' });
  if (error && /title/i.test(error.message || '') && /column|could not find|does not exist/i.test(error.message || '')) {
    titleApplied = false; // v3.199 not applied yet — seed without the title
    ({ error } = await supabaseAdmin.from('community_members').upsert(base, { onConflict: 'user_id' }));
  }
  if (error) throw error;
  return { userId, name, title: titleApplied ? 'Chief of Staff' : null, titleApplied };
}

if (require.main === module) {
  seedTithi(process.argv[2] || process.env.COMMUNITY_TITHI_USER_ID)
    .then((r) => {
      console.log('✓ Tithi community identity seeded:', r);
      if (!r.titleApplied) console.log('  (title pending — apply migrations/v3.199_community_member_title.sql then re-run)');
      console.log(`  Next: set COMMUNITY_TITHI_USER_ID=${r.userId} in the server env.`);
      process.exit(0);
    })
    .catch((e) => { console.error('✗ seed failed:', e.message); process.exit(1); });
}

module.exports = { seedTithi };

/**
 * referralService.js — host-refers-host "Refer & Earn" (v3.77).
 *
 * State machine (one `referrals` row per referred host):
 *   pending → qualified → rewarded         (referred pays → hold survives → cash in balance)
 *           ↘ rejected                     (self-referral / monthly cap / referred churned)
 *
 * Attribution is captured at signup (a fresh host presents a ?ref username) and is
 * write-once (unique(referred_id)). Reward triggers ONLY on a real plan payment —
 * never on signup — so a fraudster must actually pay (plan >> reward) to farm one.
 * Retention-gating (min_qualifying_charges) makes monthly rewards wait for the Nth
 * charge. Config ("what's paid for what") lives in referral_reward_rules, admin-editable.
 */
'use strict';

const { supabaseAdmin } = require('../config/supabase');
const planService = require('./planService');

const nowIso = () => new Date().toISOString();

/** Active reward rule for a (plan, cadence), or null. */
async function getActiveRule(plan, cadence) {
  const { data } = await supabaseAdmin
    .from('referral_reward_rules')
    .select('*')
    .eq('referred_plan', plan)
    .eq('cadence', cadence)
    .eq('active', true)
    .maybeSingle();
  return data || null;
}

/** Count a host's real (paid) subscription charges — the retention counter. */
async function countPaidCharges(vendorId) {
  const { count } = await supabaseAdmin
    .from('subscription_payments')
    .select('id', { count: 'exact', head: true })
    .eq('vendor_id', vendorId)
    .eq('status', 'paid');
  return count || 0;
}

/**
 * Capture attribution for a freshly-signed-up host that presented a ?ref code.
 * Guards: referrer is an existing host, referrer ≠ referred, referred has not yet
 * converted (no paid charge — can't retro-attribute a conversion), and no prior
 * referral row (the unique constraint makes this idempotent/write-once).
 *
 * @param {object} p
 * @param {string} p.referredId  the new host's profile id
 * @param {string} p.ref         referrer's username (from ?ref=)
 * @returns {Promise<{captured:boolean, reason?:string}>}
 */
async function capture({ referredId, ref }) {
  const code = String(ref || '').trim().toLowerCase().replace(/^@/, '');
  if (!code || !referredId) return { captured: false, reason: 'no ref' };

  const { data: referrer } = await supabaseAdmin
    .from('profiles').select('id, is_host').eq('username', code).maybeSingle();
  if (!referrer || !referrer.is_host) return { captured: false, reason: 'unknown referrer' };
  if (referrer.id === referredId) return { captured: false, reason: 'self-referral' };

  if (await countPaidCharges(referredId) > 0) return { captured: false, reason: 'already converted' };

  const { error } = await supabaseAdmin.from('referrals').insert({
    referrer_id: referrer.id, referred_id: referredId, status: 'pending',
  });
  if (error) {
    if (error.code === '23505') return { captured: false, reason: 'already attributed' };
    console.error('referral capture insert failed:', error.message);
    return { captured: false, reason: error.message };
  }
  return { captured: true };
}

/**
 * Advance a referral toward its reward after a REAL plan charge for the referred
 * host. Called from recordSubscriptionCharge (which already filters ₹1 auth-token
 * charges). Qualifies once paid charges reach the rule's min_qualifying_charges,
 * subject to the referrer's monthly cap. Best-effort; never throws to the caller.
 *
 * @param {object} p
 * @param {string} p.referredId
 * @param {string} p.planSlug
 * @param {string} p.cadence     'monthly' | 'annual'
 * @returns {Promise<{qualified:boolean, reason?:string}>}
 */
async function onReferredCharge({ referredId, planSlug, cadence }) {
  const { data: ref } = await supabaseAdmin
    .from('referrals').select('*').eq('referred_id', referredId).eq('status', 'pending').maybeSingle();
  if (!ref) return { qualified: false, reason: 'no pending referral' };

  const plan = planService.normalizeSlug(planSlug);
  const rule = await getActiveRule(plan, cadence);
  if (!rule || Number(rule.reward_value) <= 0) return { qualified: false, reason: 'no active rule' };

  const paidCharges = await countPaidCharges(referredId);
  await supabaseAdmin.from('referrals')
    .update({ qualifying_charges: paidCharges, updated_at: nowIso() })
    .eq('id', ref.id).eq('status', 'pending');

  if (paidCharges < Number(rule.min_qualifying_charges || 1)) {
    return { qualified: false, reason: `awaiting retention (${paidCharges}/${rule.min_qualifying_charges})` };
  }

  // Monthly cap (0 = unlimited): rewards a referrer can earn per calendar month.
  if (Number(rule.monthly_cap) > 0) {
    const d = new Date();
    const monthStart = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
    const { count: recent } = await supabaseAdmin
      .from('referrals').select('id', { count: 'exact', head: true })
      .eq('referrer_id', ref.referrer_id)
      .in('status', ['qualified', 'rewarded'])
      .gte('qualified_at', monthStart);
    if ((recent || 0) >= Number(rule.monthly_cap)) {
      await supabaseAdmin.from('referrals')
        .update({ status: 'rejected', rejected_reason: 'monthly_cap', updated_at: nowIso() })
        .eq('id', ref.id).eq('status', 'pending');
      return { qualified: false, reason: 'monthly cap' };
    }
  }

  const releaseAt = new Date(Date.now() + Number(rule.hold_days || 0) * 86400000).toISOString();
  await supabaseAdmin.from('referrals').update({
    status: 'qualified',
    referred_plan: plan, cadence,
    reward_type: rule.reward_type, reward_value: rule.reward_value,
    qualifying_charges: paidCharges,
    qualified_at: nowIso(), release_at: releaseAt, updated_at: nowIso(),
  }).eq('id', ref.id).eq('status', 'pending');

  // Real-time CRM: a qualified referral makes the REFERRER an Ambassador (Champion
  // at 3+ qualified referrals), once they reach the ROI milestone. Best-effort; never breaks the
  // charge flow. resolveAccountStatus gates Marketing states behind the ROI milestone.
  try { await require('./crm/leadService').recomputeFromAccount(ref.referrer_id); } catch (_) { /* best-effort */ }
  return { qualified: true };
}

/**
 * Release cron: qualified referrals whose hold has passed and whose referred host
 * is STILL a paying customer become `rewarded` — posting the ledger expense and
 * crediting the referrer's withdrawable balance. Referred hosts that churned or
 * refunded inside the hold are clawed back (`rejected`). Idempotent.
 *
 * Ledger is posted BEFORE the status flip (mirrors payout release): a failed post
 * leaves the row `qualified` for retry; the post is idempotent on (REFERRAL_REWARD,id).
 *
 * @param {number} [nowMs] injectable clock for tests
 * @returns {Promise<{released:number, clawed:number}>}
 */
async function releaseDue(nowMs = Date.now()) {
  const ts = new Date(nowMs).toISOString();
  const { data: due } = await supabaseAdmin
    .from('referrals').select('*')
    .eq('status', 'qualified').lte('release_at', ts).limit(500);

  let released = 0, clawed = 0;
  for (const r of due || []) {
    const { data: refd } = await supabaseAdmin
      .from('profiles').select('plan, plan_expires_at, subscription_status').eq('id', r.referred_id).maybeSingle();
    const churned = !refd
      || planService.isFreeSlug(planService.resolveVendorPlan(refd))
      || refd.subscription_status === 'cancelled'
      || refd.subscription_status === 'halted';
    if (churned) {
      await supabaseAdmin.from('referrals')
        .update({ status: 'rejected', rejected_reason: 'referred_churned', updated_at: ts })
        .eq('id', r.id).eq('status', 'qualified');
      clawed++;
      continue;
    }

    // Only cash rewards post to the ledger + hit the payout rail. account_credit
    // (not yet spendable) would be released by a future credit-apply mechanism.
    if (r.reward_type === 'cash_inr' && Number(r.reward_value) > 0) {
      try {
        const { post } = require('./ledger/postingService');
        const { referralRewardEntry } = require('./ledger/journalTemplates');
        await post({
          sourceType: 'REFERRAL_REWARD', sourceId: r.id, journalDate: ts.slice(0, 10),
          template: referralRewardEntry({ host_id: r.referrer_id, amount: Number(r.reward_value) }),
        });
      } catch (e) {
        console.error(`referral ledger post failed (${r.id}), retry next run:`, e.message);
        continue; // stay qualified
      }
    }

    await supabaseAdmin.from('referrals')
      .update({ status: 'rewarded', rewarded_at: ts, updated_at: ts })
      .eq('id', r.id).eq('status', 'qualified');
    released++;

    // Tell the referrer they earned — the whole loop's payoff was invisible before.
    // Cash rewards only (account_credit isn't spendable yet). Best-effort; a notify
    // failure must not leave the row un-rewarded, so it's after the status flip.
    if (r.reward_type === 'cash_inr' && Number(r.reward_value) > 0) {
      try {
        const { data: referrer } = await supabaseAdmin
          .from('profiles').select('id, name, email').eq('id', r.referrer_id).maybeSingle();
        if (referrer) {
          const firstName = (referrer.name || '').split(' ')[0] || 'there';
          const amount = `₹${Number(r.reward_value).toLocaleString('en-IN')}`;
          await require('./notificationEngine').send({
            event: 'REFERRAL_REWARD_RELEASED',
            data: {
              email: referrer.email, name: referrer.name,
              recipientUserId: referrer.id,
              emailUser: { name: referrer.name, email: referrer.email },
              emailData: { first_name: firstName, reward_amount: amount },
              inApp: {
                title: 'Referral reward released',
                body: `You earned ${amount} — it's in your withdrawable balance.`,
                link: '/dashboard/referrals',
              },
            },
          });
        }
      } catch (e) { console.error(`referral reward notify failed (${r.id}):`, e.message); }
    }
  }
  return { released, clawed };
}

/** Host dashboard payload: referral code, stats, and the referral list. */
async function getMine(hostId) {
  const { data: me } = await supabaseAdmin
    .from('profiles').select('username').eq('id', hostId).maybeSingle();

  const { data: rows } = await supabaseAdmin
    .from('referrals')
    .select('id, status, referred_plan, cadence, reward_type, reward_value, created_at, qualified_at, rewarded_at')
    .eq('referrer_id', hostId)
    .order('created_at', { ascending: false })
    .limit(200);
  const list = rows || [];
  const sum = (pred) => list.filter(pred).reduce((s, r) => s + Number(r.reward_value || 0), 0);

  return {
    username: me?.username || null,
    stats: {
      total: list.length,
      pending: list.filter((r) => r.status === 'pending').length,       // signed up, not yet paid
      inHold: list.filter((r) => r.status === 'qualified').length,       // paid, in refund hold
      rewarded: list.filter((r) => r.status === 'rewarded').length,
      earned: sum((r) => r.status === 'rewarded'),                       // ₹ credited to balance
      pendingValue: sum((r) => r.status === 'qualified'),                // ₹ awaiting release
    },
    referrals: list,
  };
}

module.exports = { capture, onReferredCharge, releaseDue, getMine, getActiveRule, countPaidCharges };

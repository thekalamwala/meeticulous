'use strict';
/**
 * handoffService.js — cross-board team handoffs (P3).
 *
 * When a lead crosses a pipeline boundary INTO Customer Relations (on first
 * payment) or Marketing (on reaching the ROI milestone), the receiving team should own it.
 * onCrossBoard reassigns the lead to the least-loaded active member of that team,
 * records the handoff on the timeline (prev→new owner, trigger), and opens an SLA
 * follow-up whose existing reminder cron pings the new owner — so the handoff both
 * moves ownership and creates the work.
 *
 * Best-effort throughout: a handoff must never break the status change it hangs off.
 * The pure helpers (teamForPipeline / pickLeastLoaded) are unit-tested in isolation.
 */
const { supabaseAdmin } = require('../../config/supabase');
const rules = require('./lifecycleRules');
const followUpService = require('./followUpService');
const { logActivity } = require('./activity');

// Which team owns each board. Presale = Sales; Exit is nobody's handoff.
const TEAM_FOR = { presale: 'sales', relations: 'relations', marketing: 'marketing', exit: null };

// SLA the receiving team commits to when a lead lands on its board.
const SLA = {
  relations: { title: 'Onboard this new subscriber to their first booking', dueInDays: 7 },
  marketing: { title: 'Activate advocacy — referrals + testimonial', dueInDays: 14 },
};

const teamForPipeline = (pipeline) => TEAM_FOR[pipeline] || null;

/**
 * PURE. Choose the receiving owner. If the current owner is already on the team,
 * keep them (no churn). Otherwise pick the least-loaded member (fewest open leads);
 * ties break to array order. Returns an id, or null when the team has no members.
 * @param {Array<{id:string, load:number}>} members
 * @param {string|null} currentOwnerId
 */
function pickLeastLoaded(members = [], currentOwnerId = null) {
  if (!members.length) return null;
  if (currentOwnerId && members.some((m) => m.id === currentOwnerId)) return currentOwnerId;
  return members.reduce((best, m) => (m.load < best.load ? m : best), members[0]).id;
}

// Active members of a CRM team + their current open-lead load (for balancing).
async function loadTeamMembers(team) {
  const { data: admins } = await supabaseAdmin.from('admin_users')
    .select('id').eq('crm_team', team).eq('is_active', true);
  const ids = (admins || []).map((a) => a.id);
  if (!ids.length) return [];
  const { data: owned } = await supabaseAdmin.from('leads')
    .select('owner_admin_id').in('owner_admin_id', ids).not('status', 'in', rules.CLOSED_SQL);
  const load = new Map(ids.map((id) => [id, 0]));
  for (const r of owned || []) load.set(r.owner_admin_id, (load.get(r.owner_admin_id) || 0) + 1);
  return ids.map((id) => ({ id, load: load.get(id) || 0 }));
}

/**
 * Best-effort cross-board handoff. Runs after a lead's status is written (auto or
 * manual). No-op unless the move crosses INTO Relations or Marketing.
 *
 * @param {object} p
 * @param {string} p.leadId
 * @param {string} p.from   previous status
 * @param {string} p.to     new status
 * @param {string|null} [p.actorAdminId]  the human who moved it (null = system)
 * @returns {Promise<{handoff:boolean, team?:string, newOwner?:string|null}>}
 */
async function onCrossBoard({ leadId, from, to, actorAdminId = null } = {}) {
  try {
    const fromPipe = rules.pipelineOf(from);
    const toPipe = rules.pipelineOf(to);
    if (fromPipe === toPipe) return { handoff: false };

    const team = teamForPipeline(toPipe);
    // Only Relations / Marketing are receiving-team handoffs. Moves to Exit (or back
    // to Presale) don't reassign — Exit is nobody's queue, and a demotion keeps its owner.
    if (!team || !SLA[toPipe]) return { handoff: false };

    const { data: lead } = await supabaseAdmin.from('leads')
      .select('owner_admin_id').eq('id', leadId).maybeSingle();
    const prevOwner = lead?.owner_admin_id || null;

    const members = await loadTeamMembers(team);
    const newOwner = pickLeastLoaded(members, prevOwner);

    if (newOwner && newOwner !== prevOwner) {
      await supabaseAdmin.from('leads').update({ owner_admin_id: newOwner, updated_at: new Date().toISOString() }).eq('id', leadId);
    }

    await logActivity(leadId, 'handoff', {
      actorAdminId,
      title: `Handed off to ${team}`,
      meta: { from_pipeline: fromPipe, to_pipeline: toPipe, team, prev_owner: prevOwner, new_owner: newOwner || prevOwner, via: `${from}->${to}` },
    });

    // SLA task (inherits the lead's — now the new — owner via openAuto). Its reminder
    // cron emails the owner when due, so this is also the "notify the team" step.
    // Deduped by key so re-crossing never piles up duplicates.
    const sla = SLA[toPipe];
    await followUpService.openAuto({ leadId, key: `handoff:${toPipe}`, title: sla.title, dueInDays: sla.dueInDays });

    return { handoff: true, team, newOwner: newOwner || prevOwner };
  } catch (e) {
    console.warn('[crm] handoff failed (non-fatal):', e?.message || e);
    return { handoff: false };
  }
}

module.exports = { onCrossBoard, teamForPipeline, pickLeastLoaded, loadTeamMembers, TEAM_FOR, SLA };

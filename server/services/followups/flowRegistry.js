/**
 * flowRegistry.js — declarative follow-up flow definitions.
 *
 * Vertical-agnostic: a flow names its source_type, notification event, audience,
 * the ordered steps (offset in days from the source "completed" moment), and a
 * pure payload snapshot builder. followupService reads this registry to schedule
 * and fire. A new vertical adds a flow here — no scheduler/cron changes.
 */
const FLOWS = {
  rebook: {
    flow_key: 'rebook',
    source_type: 'booking',
    audience: 'customer',
    event: 'REBOOK_NUDGE_CUSTOMER',
    steps: [{ step: 1, offsetDays: 3 }, { step: 2, offsetDays: 21 }],
    // Snapshot only what the email/WhatsApp render needs — survives later edits
    // to the source booking/host/service.
    buildPayload: (b) => ({
      guest_name: b.guest_name,
      guest_email: b.guest_email,
      guest_phone: b.guest_phone,
      guest_id: b.guest_id,
      service_title: b.services?.title,
      host_name: b.profiles?.name,
      host_username: b.profiles?.username,
      host_id: b.host_id,
    }),
  },
};

const getFlow = (flowKey) => FLOWS[flowKey] || null;

// Entitled steps for a plan limit N. -1 = unlimited (all). Otherwise the first N
// steps by ascending step number. N<=0 = none.
const entitledSteps = (flow, limitN) => {
  const ordered = [...flow.steps].sort((a, b) => a.step - b.step);
  if (limitN < 0) return ordered;
  return ordered.slice(0, Math.max(0, limitN));
};

module.exports = { FLOWS, getFlow, entitledSteps };

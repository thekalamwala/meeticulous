/**
 * kycOnboarding.js — shared side-effects of an APPROVED host KYC, and the autopilot
 * switch.
 *
 * "Approved" happens two ways:
 *   • a human admin decides it (kycAdminController.decideKyc), or
 *   • autopilot auto-approves on submit (kycController.submitKyc) because Razorpay's
 *     Route linked-account activation IS the identity/bank verification, so the manual
 *     gate is duplicate work. Payout eligibility still gates on
 *     route_activation_status='activated' (payoutEligibility) — autopilot only removes
 *     the human bottleneck BEFORE Razorpay, not the verification itself.
 *
 * Both paths must do the same two things: notify the host, and create the Route linked
 * account. This centralises them so they can never drift.
 */
'use strict';

const { supabaseAdmin } = require('../config/supabase');
const NotificationEngine = require('./notificationEngine');
const { inAppNotify, resolveInApp } = require('../utils/inAppNotify');
const routeAccountService = require('./routeAccountService');
const platformConfig = require('./platformConfig');

/** Is KYC autopilot on? (auto-approve on submit; escalate-only humans.) Fail-safe off. */
async function isAutopilot() {
  try { return (await platformConfig.getConfig()).routeAutopilot === true; }
  catch { return false; }
}

/**
 * Fire the side-effects of an approved KYC: notify the host + create the Razorpay
 * Route linked account. Fire-and-forget; never throws into the caller.
 * @param {object} a  { userId, email, fullName, reviewNote }
 */
function onKycApproved({ userId, email, fullName, reviewNote } = {}) {
  if (!userId) return;

  NotificationEngine.send({
    event: 'KYC_APPROVED',
    data: {
      email,
      name: fullName,
      emailData: {
        first_name: (fullName || '').split(' ')[0],
        review_note: reviewNote || 'Please review the requirements and resubmit.',
        support_email: 'hello@meeticulous.com',
      },
      emailUser: { name: fullName, email },
      recipientUserId: userId,
    },
  }).catch((e) => console.error('KYC approved notify failed:', e.message));

  inAppNotify({
    userId,
    role: 'host',
    type: 'KYC_APPROVED',
    title: 'KYC approved',
    body: 'Your identity verification was approved. Payouts are unlocked.',
    link: '/dashboard/payments/payouts',
  });

  // A prior "KYC rejected" bell no longer applies now that it's approved — resolve
  // it so it stops nagging (clears from unread + stamps resolved_at).
  resolveInApp({ userId, type: 'KYC_REJECTED' });

  // Create the Route linked account (needs the full encrypted row for PAN/bank/address).
  // Self-gating + idempotent (routeAccountService no-ops in fee-only mode / when already
  // onboarded). A failure is retried by the payout reconciler's account-creation sweep.
  supabaseAdmin
    .from('kyc_submissions').select('*').eq('user_id', userId).maybeSingle()
    .then(({ data: full }) => (full ? routeAccountService.createLinkedAccount(full) : null))
    .catch((e) => console.error('Route linked-account onboarding failed:', e.message));

  // CRM: stamp the Verified badge on the host's lead (KYC-approved ⇒ payout-eligible).
  // Best-effort + schema-fallback safe (leads.verified_at ships in migration v3.126).
  supabaseAdmin
    .from('leads').update({ verified_at: new Date().toISOString() })
    .eq('profile_id', userId).is('verified_at', null)
    .then(() => {})
    .catch((e) => console.error('[crm] verified badge stamp failed (non-fatal):', e.message));
}

module.exports = { isAutopilot, onKycApproved };

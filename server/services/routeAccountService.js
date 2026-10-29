/**
 * routeAccountService.js — Razorpay Route onboarding: turn an approved KYC
 * submission into a fully-configured Route LINKED ACCOUNT ready to receive
 * TRANSFER-FROM-BALANCE payouts in a later phase. It configures the destination
 * account; it never moves money and never creates a transfer.
 *
 * The onboarding chain (each payload validated against the live Route test API):
 *   1. accounts.create ................ identity: name/email/phone + registered address
 *   2. stakeholders.create ............ the individual's PAN (rejected on the account
 *                                       itself for business_type 'individual')
 *   3. products.requestProductConfiguration ... enable the 'route' product
 *   4. products.edit .................. settlement bank account (from KYC bank fields)
 *
 * Guardrails:
 *   • DORMANT while fee_only_mode is true. fee_only_mode defaults true and fails
 *     safe (platformConfig), so nothing here runs until an admin flips it false on
 *     payout go-live. This mirrors every other host-money path in the codebase.
 *   • RESUMABLE + idempotent — every step is skipped when its id is already stored,
 *     so a partial run (e.g. account created, settlement failed) resumes cleanly.
 *     A fully-onboarded row is a no-op.
 *   • Never throws to its caller. The KYC-approval hook is fire-and-forget; a
 *     Route failure must never fail (or roll back) an admin's approval decision.
 *   • Schema-fallback — the v3.95 / v3.97 columns may not be applied yet on a given
 *     DB. A "column not found" degrades to a logged no-op, never a crash.
 */
'use strict';

const razorpayConfig = require('./razorpayConfig');
const { supabaseAdmin } = require('../config/supabase');
const { decrypt } = require('../utils/kycCrypto');
const { securityLog } = require('../utils/logger');

// Route account defaults. Individual hosts (not registered businesses) are the
// norm on the platform; category/subcategory are Razorpay's MCC-style taxonomy.
// Kept here as constants so Phase 0 has no new admin surface; promote to
// platform_settings later if hosts need per-account business types.
const ACCOUNT_DEFAULTS = Object.freeze({
  type: 'route',
  business_type: 'individual',
  category: 'services',
  subcategory: 'consulting',
});

// Postgres "column does not exist" — the v3.95 migration isn't applied on this DB.
const isMissingColumn = (err) => {
  const msg = (err?.message || err?.details || '').toLowerCase();
  return err?.code === '42703' || /column .* does not exist|could not find the .* column/.test(msg);
};

// Razorpay caps reference_id at 20 chars. Our host ids are 36-char UUIDs, so we
// send a compact deterministic ref ('h' + 19 hex of the dash-stripped uuid). The
// full acc_... <-> host mapping is stored on the kyc row, so nothing is lost.
function shortHostRef(userId) {
  return `h${String(userId || '').replace(/-/g, '').slice(0, 19)}`;
}

// A Route linked account requires a registered address. We source it from the
// host's KYC address columns (v3.96). Returns null when incomplete — the caller
// then skips creation (an old KYC row without an address is not an error).
function registeredAddress(kyc) {
  const street1 = (kyc.addr_street1 || '').trim();
  const city = (kyc.addr_city || '').trim();
  const state = (kyc.addr_state || '').trim();
  const postal_code = String(kyc.addr_postal_code || '').trim();
  if (!street1 || !city || !state || !postal_code) return null;
  return {
    street1,
    // Razorpay Route requires street2. Newer KYC rows enforce it at submit, but
    // legacy rows (and any blank) fall back to street1 so onboarding never 400s.
    street2: (kyc.addr_street2 || '').trim() || street1,
    city,
    state,
    postal_code,
    country: (kyc.addr_country || 'IN').trim().toUpperCase(),
  };
}

// Build the Razorpay v2 Accounts create payload from a KYC row.
//   • reference_id — compact (<=20 chars), see shortHostRef.
//   • NO legal_info — for business_type 'individual', legal_info.pan is the
//     COMPANY pan and Razorpay rejects it. The individual's PAN is attached later
//     via the stakeholder API (a Phase 0.5 step), not at account create.
//   • profile.addresses.registered — REQUIRED by Razorpay; from KYC address cols.
// Returns null when the KYC row has no usable registered address.
function buildAccountPayload(kyc) {
  const registered = registeredAddress(kyc);
  if (!registered) return null;
  const contactName = (kyc.full_name || kyc.holder_name || '').trim();
  return {
    email: kyc.email,
    phone: kyc.phone ? String(kyc.phone) : undefined,
    type: ACCOUNT_DEFAULTS.type,
    reference_id: shortHostRef(kyc.user_id),
    legal_business_name: contactName || kyc.email,
    business_type: ACCOUNT_DEFAULTS.business_type,
    contact_name: contactName || kyc.email,
    profile: {
      category: ACCOUNT_DEFAULTS.category,
      subcategory: ACCOUNT_DEFAULTS.subcategory,
      addresses: { registered },
    },
  };
}

// Stakeholder payload — the individual's PAN lives here, NOT on the account
// (Razorpay rejects legal_info.pan for business_type 'individual'). PAN is
// decrypted from KYC here (never logged).
function buildStakeholderPayload(kyc) {
  const name = (kyc.full_name || kyc.holder_name || '').trim() || kyc.email;
  const pan = decrypt(kyc.pan_number) || undefined;
  const payload = { name, email: kyc.email };
  if (pan) payload.kyc = { pan };
  return payload;
}

// Settlement bank config for the Route product, from the host's KYC bank fields.
// account_number is decrypted here. Returns null when any part is missing so the
// caller skips the settlement step rather than sending a broken config.
function buildSettlementConfig(kyc) {
  const account_number = decrypt(kyc.account_number) || '';
  const ifsc_code = (kyc.ifsc || '').trim().toUpperCase();
  const beneficiary_name = (kyc.holder_name || kyc.full_name || '').trim();
  if (!account_number || !ifsc_code || !beneficiary_name) return null;
  return { account_number, ifsc_code, beneficiary_name };
}

// Persist Route bookkeeping onto the KYC row. Swallows a missing-column error
// (migration not yet applied) so onboarding degrades gracefully.
async function persistRouteState(kycId, patch) {
  const { error } = await supabaseAdmin
    .from('kyc_submissions')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', kycId);
  if (error) {
    if (isMissingColumn(error)) {
      securityLog('route_schema_fallback', { kycId, reason: 'v3.95 columns missing' });
      return;
    }
    throw error;
  }
}

/**
 * Onboard an approved KYC submission onto Razorpay Route: create the linked
 * account, attach the stakeholder PAN, enable the 'route' product, and set the
 * settlement bank account. Resumable — each already-completed step is skipped.
 * No-op (returns a reason) when disabled or ineligible.
 *
 * @param {object} kyc  the full kyc_submissions row (approved).
 * @returns {Promise<{ ok, accountId?, stakeholderId?, productId?, skipped?, error? }>}
 */
async function createLinkedAccount(kyc) {
  try {
    if (!kyc || !kyc.id) return { ok: false, skipped: 'no_kyc' };
    if (kyc.status !== 'approved') return { ok: false, skipped: 'not_approved' };

    // Fully onboarded already → nothing to do.
    if (kyc.razorpay_account_id && kyc.razorpay_stakeholder_id && kyc.razorpay_product_id) {
      return {
        ok: true,
        accountId: kyc.razorpay_account_id,
        stakeholderId: kyc.razorpay_stakeholder_id,
        productId: kyc.razorpay_product_id,
        skipped: 'already_onboarded',
      };
    }

    // Dormant until payout go-live (per-host: a paid-enabled pilot host onboards
    // even while the platform is globally in fee-only mode).
    if (await require('./paidMode').feeOnlyForHost(kyc.user_id)) return { ok: false, skipped: 'fee_only_mode' };

    if (!(await razorpayConfig.isConfigured())) return { ok: false, skipped: 'razorpay_unconfigured' };
    if (!kyc.email) return { ok: false, skipped: 'missing_email' };

    // Razorpay requires a registered address; an older KYC row without one is
    // skipped (not errored) so it can be onboarded later once the host adds it.
    const payload = buildAccountPayload(kyc);
    if (!payload) return { ok: false, skipped: 'missing_address' };

    const razorpay = await razorpayConfig.getClient();
    const now = () => new Date().toISOString();

    // 1) Linked account (identity + address).
    let accountId = kyc.razorpay_account_id;
    if (!accountId) {
      await persistRouteState(kyc.id, { route_status: 'pending', route_error: null });
      const account = await razorpay.accounts.create(payload);
      accountId = account?.id;
      if (!accountId) throw new Error('Razorpay account create returned no id');
      await persistRouteState(kyc.id, {
        razorpay_account_id: accountId, route_status: 'created', route_error: null, route_synced_at: now(),
      });
    }

    // 2) Stakeholder (individual PAN).
    let stakeholderId = kyc.razorpay_stakeholder_id;
    if (!stakeholderId) {
      const sh = await razorpay.stakeholders.create(accountId, buildStakeholderPayload(kyc));
      stakeholderId = sh?.id;
      if (stakeholderId) await persistRouteState(kyc.id, { razorpay_stakeholder_id: stakeholderId });
    }

    // 3) Request the 'route' product configuration.
    let productId = kyc.razorpay_product_id;
    if (!productId) {
      const prod = await razorpay.products.requestProductConfiguration(accountId, {
        product_name: 'route', tnc_accepted: true,
      });
      productId = prod?.id;
      if (productId) {
        await persistRouteState(kyc.id, {
          razorpay_product_id: productId, route_activation_status: prod?.activation_status || null,
        });
      }
    }

    // 4) Set the settlement bank account on the product (from KYC bank fields).
    const settlements = buildSettlementConfig(kyc);
    if (productId && settlements) {
      const updated = await razorpay.products.edit(accountId, productId, { settlements, tnc_accepted: true });
      await persistRouteState(kyc.id, {
        route_activation_status: updated?.activation_status || null, route_error: null, route_synced_at: now(),
      });
    }

    return { ok: true, accountId, stakeholderId, productId };
  } catch (err) {
    // Razorpay surfaces a structured { error: { description } }; fall back to message.
    const reason = err?.error?.description || err?.message || 'unknown error';
    securityLog('route_linked_account_error', { kycId: kyc?.id, reason });
    try {
      await persistRouteState(kyc.id, { route_status: 'error', route_error: reason.slice(0, 500) });
    } catch (_) { /* best effort; original error already logged */ }
    return { ok: false, error: reason };
  }
}

module.exports = {
  createLinkedAccount,
  buildAccountPayload,
  buildStakeholderPayload,
  buildSettlementConfig,
  ACCOUNT_DEFAULTS,
};

/**
 * kycController.js — host-facing KYC: submit, read own status, upload docs.
 *
 * SECURITY:
 *  - PAN / Aadhaar / account number are encrypted at rest (kycCrypto) and are
 *    NEVER returned raw. GET /me returns masked values only.
 *  - A host can only read/write their OWN submission (scoped by req.user.id).
 *  - Documents go to the PRIVATE 'kyc' bucket; only storage keys are stored.
 */
const { supabaseAdmin } = require('../config/supabase');
const { safeError } = require('../utils/httpError');
const { encrypt, maskPan, maskAadhaar, maskAccount, maskPhone, RE } = require('../utils/kycCrypto');
// Selfie must be an image; PAN/Aadhaar docs may be image or PDF (allowPdf).
const { sniff } = require('../utils/fileSniff');

const KYC_BUCKET = 'kyc';
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB — KYC docs (scans/photos) are larger than avatars

// POST /api/kyc/upload?type=selfie|pan|aadhaar  (multipart field "file")
// Returns { key } — the private-bucket storage key to send back in POST /api/kyc.
const uploadKycFile = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file provided' });
    const type = ['selfie', 'pan', 'aadhaar'].includes(req.query.type) ? req.query.type : null;
    if (!type) return res.status(400).json({ message: 'Invalid document type.' });

    const { size, buffer } = req.file;
    if (size > MAX_SIZE_BYTES) return res.status(400).json({ message: 'File size must be under 5MB' });

    const sniffed = sniff(buffer, type !== 'selfie'); // selfie = image only; docs allow PDF
    if (!sniffed) {
      return res.status(400).json({
        message: type === 'selfie'
          ? 'Selfie must be a JPG, PNG or WEBP image.'
          : 'Document must be a JPG, PNG, WEBP or PDF.',
      });
    }

    const rand = Math.random().toString(36).slice(2, 8);
    const key = `${req.user.id}/${type}_${Date.now()}_${rand}.${sniffed.ext}`;
    const { error } = await supabaseAdmin.storage
      .from(KYC_BUCKET)
      .upload(key, buffer, { contentType: sniffed.mime, upsert: true, contentDisposition: 'attachment' });
    if (error) return safeError(res, error, 500, 'Document upload failed. Please try again.');

    res.json({ key, type });
  } catch (error) {
    safeError(res, error);
  }
};

// GET /api/kyc/me — own status + masked, non-sensitive fields. Never raw PII.
const getMyKyc = async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('kyc_submissions').select('*').eq('user_id', req.user.id).maybeSingle();
    if (error) throw error;

    // Phase 2 nudge: how much the host has earned but not yet been paid, and
    // whether their Route payout account is ready. Drives the "finish KYC to
    // receive ₹X" banner. Best-effort — never fails the KYC read. Computed even
    // when there is NO submission yet (deferred KYC): a host who earned before
    // starting KYC still needs the dashboard nudge.
    let pending_earnings = 0;
    let payouts_ready = !!data?.razorpay_account_id;
    try {
      const { computeSettlementBalance } = require('../services/settlementService');
      const platformConfig = require('../services/platformConfig');
      const { clearingDays } = await platformConfig.getConfig();
      const bal = await computeSettlementBalance(req.user.id, clearingDays);
      pending_earnings = Math.round(((bal.available || 0) + (bal.clearing || 0) + (bal.pendingCompletion || 0)) * 100) / 100;
    } catch (_) { /* non-fatal */ }

    // No submission row yet → not_started, but still carry the earnings signal.
    if (!data) return res.json({ status: 'not_started', pending_earnings, payouts_ready });

    res.json({
      status: data.status,
      pending_earnings,
      payouts_ready,
      full_name: data.full_name,
      email: data.email,
      phone: maskPhone(data.phone),
      pan_number: maskPan(data.pan_number),
      aadhaar_number: maskAadhaar(data.aadhaar_number),
      holder_name: data.holder_name,
      bank_name: data.bank_name,
      account_number: maskAccount(data.account_number),
      ifsc: data.ifsc,
      branch: data.branch,
      account_type: data.account_type,
      addr_street1: data.addr_street1,
      addr_street2: data.addr_street2,
      addr_city: data.addr_city,
      addr_state: data.addr_state,
      addr_postal_code: data.addr_postal_code,
      addr_country: data.addr_country,
      has_selfie: !!data.selfie_url,
      has_pan_doc: !!data.pan_doc_url,
      has_aadhaar_doc: !!data.aadhaar_doc_url,
      review_note: data.review_note,
      reviewed_at: data.reviewed_at,
      created_at: data.created_at,
    });
  } catch (error) {
    safeError(res, error);
  }
};

// POST /api/kyc — create/replace the caller's submission. Sets status='pending'.
const submitKyc = async (req, res) => {
  try {
    const b = req.body || {};
    const errors = [];

    const fullName = String(b.full_name || '').trim();
    const email = String(b.email || '').trim();
    const phone = String(b.phone || '').replace(/\D/g, '');
    const pan = String(b.pan_number || '').trim().toUpperCase();
    const aadhaar = String(b.aadhaar_number || '').replace(/\D/g, '');

    if (!fullName) errors.push('Full name is required.');
    if (!RE.email.test(email)) errors.push('Valid email is required.');
    if (!RE.phone.test(phone)) errors.push('Valid phone number is required.');
    if (!RE.pan.test(pan)) errors.push('PAN must match ABCDE1234F.');
    // Aadhaar is OPTIONAL — Razorpay Route verifies PAN + bank, not Aadhaar.
    // Validate the format only if one is supplied.
    if (aadhaar && !RE.aadhaar.test(aadhaar)) errors.push('Aadhaar must be 12 digits.');

    const holderName = String(b.holder_name || '').trim();
    const bankName = String(b.bank_name || '').trim();
    const account = String(b.account_number || '').replace(/\s/g, '');
    const ifsc = String(b.ifsc || '').trim().toUpperCase();
    const branch = String(b.branch || '').trim();
    const accountType = String(b.account_type || '').trim();

    if (!holderName) errors.push('Account holder name is required.');
    if (!bankName) errors.push('Bank name is required.');
    if (!/^[0-9]{6,18}$/.test(account)) errors.push('Valid account number is required.');
    if (!RE.ifsc.test(ifsc)) errors.push('IFSC must match ABCD0123456.');
    if (!['savings', 'current'].includes(accountType.toLowerCase())) errors.push('Account type must be savings or current.');

    // Registered address — REQUIRED for the Razorpay Route linked account
    // (profile.addresses.registered). Razorpay requires street2 too; country defaults IN.
    const addrStreet1 = String(b.addr_street1 || '').trim();
    const addrStreet2 = String(b.addr_street2 || '').trim();
    const addrCity = String(b.addr_city || '').trim();
    const addrState = String(b.addr_state || '').trim();
    const addrPostal = String(b.addr_postal_code || '').replace(/\s/g, '');
    const addrCountry = String(b.addr_country || 'IN').trim().toUpperCase() || 'IN';

    if (!addrStreet1) errors.push('Address line 1 is required.');
    // Razorpay Route rejects a linked account without street2, so require it here.
    if (!addrStreet2) errors.push('Address line 2 is required.');
    if (!addrCity) errors.push('City is required.');
    if (!addrState) errors.push('State is required.');
    if (!/^[0-9]{6}$/.test(addrPostal)) errors.push('PIN code must be 6 digits.');

    // Documents (selfie / PAN / Aadhaar photos) are OPTIONAL — Razorpay Route
    // verifies the PAN number + bank directly, so uploads aren't required. If a key
    // IS supplied it must belong to the caller (can't attach someone else's upload).
    const ownKey = (k) => typeof k === 'string' && k.startsWith(`${req.user.id}/`);
    for (const k of ['selfie_url', 'pan_doc_url', 'aadhaar_doc_url']) {
      if (b[k] && !ownKey(b[k])) errors.push('Invalid document reference.');
    }

    if (errors.length) return res.status(400).json({ message: errors[0], errors });

    // Autopilot: auto-approve on submit and let Razorpay Route activation be the
    // verifier (see kycOnboarding). Off by default → the manual admin-review path.
    const { isAutopilot, onKycApproved } = require('../services/kycOnboarding');
    const autopilot = await isAutopilot();
    const AUTO_NOTE = 'Auto-approved (autopilot): identity + bank verification delegated to Razorpay Route activation.';

    const payload = {
      user_id: req.user.id,
      full_name: fullName,
      email,
      phone,
      pan_number: encrypt(pan),
      aadhaar_number: aadhaar ? encrypt(aadhaar) : null,
      holder_name: holderName,
      bank_name: bankName,
      account_number: encrypt(account),
      ifsc,
      branch,
      account_type: accountType.toLowerCase(),
      addr_street1: addrStreet1,
      addr_street2: addrStreet2 || null,
      addr_city: addrCity,
      addr_state: addrState,
      addr_postal_code: addrPostal,
      addr_country: addrCountry,
      selfie_url: b.selfie_url || null,
      pan_doc_url: b.pan_doc_url || null,
      aadhaar_doc_url: b.aadhaar_doc_url || null,
      status: autopilot ? 'approved' : 'pending',
      review_note: autopilot ? AUTO_NOTE : null,
      reviewed_by: null,
      reviewed_at: autopilot ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    };

    // One row per user (user_id UNIQUE) — upsert so re-submission after a
    // rejection overwrites and returns to 'pending'.
    const { error } = await supabaseAdmin
      .from('kyc_submissions').upsert(payload, { onConflict: 'user_id' });
    if (error) throw error;

    const base = process.env.CLIENT_URL || 'https://bookasloth.com';
    if (autopilot) {
      // No human review needed — notify the host + kick off Route onboarding now.
      // A failed create is retried by the payout reconciler's account sweep.
      onKycApproved({ userId: req.user.id, email, fullName, reviewNote: AUTO_NOTE });
      // Informational ping to admins (not an action item); throttled per-user.
      require('../utils/adminAlert').adminAlert({
        key: `kyc_autopilot:${req.user.id}`,
        subject: `KYC auto-approved (autopilot): ${fullName || email}`,
        lines: [`Name: ${fullName || '—'}`, `Email: ${email}`, `Bank: ${bankName}`, 'Onboarding to Razorpay Route; escalations alert separately.'],
        link: `${base}/admin/kyc/approved`,
      });
      return res.status(201).json({ status: 'approved' });
    }

    // Manual mode: alert admins to review. Fire-and-forget; key per-user throttles
    // rapid re-submits into one email. Never blocks the response.
    require('../utils/adminAlert').adminAlert({
      key: `kyc_submit:${req.user.id}`,
      subject: `KYC submitted: ${fullName || email}`,
      lines: [`Name: ${fullName || '—'}`, `Email: ${email}`, `PAN: ${pan}`, `Bank: ${bankName}`],
      link: `${base}/admin/kyc/pending`,
    });

    // Acknowledge to the host that their documents landed — the submit used to be
    // silent (only admins were pinged), so hosts re-uploaded out of anxiety.
    require('../utils/inAppNotify').inAppNotify({
      userId: req.user.id, role: 'host', type: 'KYC_SUBMITTED',
      title: 'Documents received',
      body: "We're reviewing your verification — usually within 48 hours.",
      link: '/dashboard/kyc',
    });

    res.status(201).json({ status: 'pending' });
  } catch (error) {
    safeError(res, error);
  }
};

module.exports = { uploadKycFile, getMyKyc, submitKyc };

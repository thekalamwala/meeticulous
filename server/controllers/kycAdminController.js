/**
 * kycAdminController.js — admin review of host KYC submissions.
 * Gated by requireAdmin('kyc.view' | 'kyc.decide') in adminRoutes.
 * Sensitive numbers stay masked even for admins; verification is done by eye
 * against the document images (served as short-lived signed URLs).
 */
const { supabaseAdmin } = require('../config/supabase');
const { safeError } = require('../utils/httpError');
const { maskPan, maskAadhaar, maskAccount, maskPhone } = require('../utils/kycCrypto');
const NotificationEngine = require('../services/notificationEngine');
const { inAppNotify } = require('../utils/inAppNotify');

const KYC_BUCKET = 'kyc';

// GET /api/admin/kyc/stats — ops centre: counts, throughput/SLA, recent activity.
const getStats = async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('kyc_submissions')
      .select('id, full_name, email, status, created_at, reviewed_at');
    if (error) throw error;
    const rows = data || [];

    const counts = { pending: 0, approved: 0, rejected: 0 };
    let decidedCount = 0, decidedMs = 0, todayDecisions = 0;
    const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
    let oldestPendingAgeMs = 0;

    for (const r of rows) {
      counts[r.status] = (counts[r.status] || 0) + 1;
      if (r.reviewed_at) {
        decidedCount += 1;
        decidedMs += new Date(r.reviewed_at) - new Date(r.created_at);
        if (new Date(r.reviewed_at) >= startOfDay) todayDecisions += 1;
      } else if (r.status === 'pending') {
        const age = Date.now() - new Date(r.created_at);
        if (age > oldestPendingAgeMs) oldestPendingAgeMs = age;
      }
    }

    const total = rows.length;
    const decided = counts.approved + counts.rejected;
    const recent = rows
      .filter((r) => r.reviewed_at)
      .sort((a, b) => new Date(b.reviewed_at) - new Date(a.reviewed_at))
      .slice(0, 8)
      .map((r) => ({ id: r.id, full_name: r.full_name, email: r.email, status: r.status, reviewed_at: r.reviewed_at }));

    res.json({
      counts: { ...counts, total },
      throughput: {
        avgDecisionMs: decidedCount ? Math.round(decidedMs / decidedCount) : null,
        oldestPendingAgeMs,
        approvalRate: decided ? Math.round((counts.approved / decided) * 100) : null,
        todayDecisions,
      },
      recent,
    });
  } catch (error) {
    safeError(res, error);
  }
};

// GET /api/admin/kyc?status=pending|approved|rejected
const listKyc = async (req, res) => {
  try {
    const status = ['pending', 'approved', 'rejected'].includes(req.query.status) ? req.query.status : 'pending';
    const { data, error } = await supabaseAdmin
      .from('kyc_submissions')
      .select('id, user_id, full_name, email, phone, status, created_at, reviewed_at')
      .eq('status', status)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json((data || []).map((r) => ({ ...r, phone: maskPhone(r.phone) })));
  } catch (error) {
    safeError(res, error);
  }
};

// GET /api/admin/kyc/:id — masked identity + signed document URLs (60s).
const getKyc = async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('kyc_submissions').select('*').eq('id', req.params.id).maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ message: 'KYC submission not found.' });

    const sign = async (key) => {
      if (!key) return null;
      const { data: s } = await supabaseAdmin.storage.from(KYC_BUCKET).createSignedUrl(key, 60);
      return s?.signedUrl || null;
    };

    res.json({
      id: data.id,
      user_id: data.user_id,
      status: data.status,
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
      selfie_url: await sign(data.selfie_url),
      pan_doc_url: await sign(data.pan_doc_url),
      aadhaar_doc_url: await sign(data.aadhaar_doc_url),
      review_note: data.review_note,
      reviewed_at: data.reviewed_at,
      created_at: data.created_at,
    });
  } catch (error) {
    safeError(res, error);
  }
};

// PATCH /api/admin/kyc/:id  { status: 'approved'|'rejected', note? }
const decideKyc = async (req, res) => {
  try {
    const status = req.body?.status;
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'status must be approved or rejected.' });
    }
    const { data, error } = await supabaseAdmin
      .from('kyc_submissions')
      .update({
        status,
        review_note: String(req.body?.note || '').trim() || null,
        reviewed_by: req.admin.id,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .select('id, status, user_id, email, full_name, review_note')
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ message: 'KYC submission not found.' });

    // Notify the host — email (NotificationEngine) + in-app bell. Fire-and-forget:
    // a notification failure must never fail the admin's decision.
    if (status === 'approved') {
      // Notify the host + create the Route linked account. Shared with autopilot
      // (kycOnboarding.onKycApproved) so the manual and auto paths never drift.
      require('../services/kycOnboarding').onKycApproved({
        userId: data.user_id, email: data.email, fullName: data.full_name, reviewNote: data.review_note,
      });
    } else {
      NotificationEngine.send({
        event: 'KYC_REJECTED',
        data: {
          email: data.email,
          name: data.full_name,
          emailData: {
            first_name: (data.full_name || '').split(' ')[0],
            review_note: data.review_note || 'Please review the requirements and resubmit.',
            support_email: 'bolt@bookasloth.in',
          },
          emailUser: { name: data.full_name, email: data.email },
          recipientUserId: data.user_id,
        },
      }).catch((e) => console.error('KYC reject notify failed:', e.message));
      inAppNotify({
        userId: data.user_id,
        role: 'host',
        type: 'KYC_REJECTED',
        title: 'KYC needs attention',
        body: data.review_note || 'Your KYC could not be approved. Please review and resubmit.',
        link: '/dashboard/kyc',
      });
    }

    res.json({ id: data.id, status: data.status });
  } catch (error) {
    safeError(res, error);
  }
};

module.exports = { getStats, listKyc, getKyc, decideKyc };

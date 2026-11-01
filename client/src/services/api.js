import axios from 'axios';
import { getAttribution } from '../utils/attribution';
import { batchedImport } from '../utils/batchImport';

const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  timeout: 30000, // give up on a stalled request instead of hanging forever
});

// Principle #4 — control the data exchange: retry transient failures.
// SECURITY/MONEY: only idempotent reads (GET/HEAD) are ever retried. A retried
// POST could double-book a slot or double-charge a card, so mutations get ONE
// shot and their error propagates untouched.
export function shouldRetry(error, method) {
  const m = (method || 'get').toLowerCase();
  if (m !== 'get' && m !== 'head') return false;
  const status = error?.response?.status;
  const noResponse = !error?.response;          // network failure
  const timedOut   = error?.code === 'ECONNABORTED';
  const serverErr  = status >= 500 && status <= 599;
  return noResponse || timedOut || serverErr;
}
const MAX_RETRIES = 2;

API.interceptors.request.use((config) => {
  // SECURITY: Admin routes ONLY use the isolated 'bas_admin' session.
  // There is NO fallback to the vendor/user session.
  // A vendor token sent to an admin route will be rejected server-side.
  const isAdminRoute = config.url?.startsWith('/admin') || config.url?.startsWith('/admin-auth');
  const key     = isAdminRoute ? 'bas_admin' : 'user';
  const session = JSON.parse(localStorage.getItem(key) || 'null');
  if (session?.token) config.headers.Authorization = `Bearer ${session.token}`;
  return config;
});

// BUG-08 fixed: intercept 401s, try to refresh the token, retry once, else logout
import { getSupabase } from './supabaseClient';
let isRefreshing = false;
let refreshQueue = [];

API.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;

      // SECURITY: Admin route 401 → clear admin session, redirect to admin login.
      // Never attempt Supabase token refresh for admin routes.
      const isAdminRoute = original.url?.startsWith('/admin') || original.url?.startsWith('/admin-auth');
      if (isAdminRoute) {
        localStorage.removeItem('bas_admin');
        window.location.href = '/backstage';
        return Promise.reject(error);
      }

      // Vendor/user 401 → try Supabase token refresh
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          refreshQueue.push({ resolve, reject });
        }).then((token) => {
          original.headers.Authorization = `Bearer ${token}`;
          return API.request(original);
        });
      }
      isRefreshing = true;
      try {
        const stored = JSON.parse(localStorage.getItem('user'));
        if (stored?.refresh_token) {
          const sb = await getSupabase();
          const { data, error: refreshError } = await sb.auth.refreshSession({
            refresh_token: stored.refresh_token,
          });
          if (!refreshError && data.session) {
            const updated = {
              ...stored,
              token: data.session.access_token,
              refresh_token: data.session.refresh_token,
            };
            localStorage.setItem('user', JSON.stringify(updated));
            const newToken = data.session.access_token;
            refreshQueue.forEach((p) => p.resolve(newToken));
            refreshQueue = [];
            original.headers.Authorization = `Bearer ${newToken}`;
            return API.request(original);
          }
        }
      } catch (_) {
        // fall through to logout
      } finally {
        isRefreshing = false;
      }
      // Route by capability: an expired host always lands on the host login
      // door, never the generic guest /login.
      const expired = JSON.parse(localStorage.getItem('user') || 'null');
      const wasHost = expired?.is_host === true || expired?.role === 'host' || expired?.role === 'superadmin';
      localStorage.removeItem('user');
      refreshQueue.forEach((p) => p.reject(new Error('Session expired')));
      refreshQueue = [];
      window.location.href = wasHost ? '/login-as-vendor' : '/login';
    }

    // Retry idempotent reads on transient failures (network / timeout / 5xx),
    // with exponential backoff. Mutations are excluded by shouldRetry().
    if (original && shouldRetry(error, original.method)) {
      original._retryCount = (original._retryCount || 0) + 1;
      if (original._retryCount <= MAX_RETRIES) {
        const backoff = 300 * 2 ** (original._retryCount - 1); // 300ms, 600ms
        await new Promise((r) => setTimeout(r, backoff));
        return API.request(original);
      }
    }

    return Promise.reject(error);
  }
);

// ── Auth ──────────────────────────────────────────────────────
export const registerUser     = (data)         => API.post('/auth/register/user', data);
export const loginUser        = (data)         => API.post('/auth/login', data);
// Unified login door (Phase B): { identifier (email|phone), password }, any role
export const loginUnified     = (data)         => API.post('/auth/login-unified', data);
export const getMe            = ()             => API.get('/auth/me');
export const updateMe         = (data)         => API.put('/auth/me', data);
export const getGoogleAuthUrl = ()             => API.get('/auth/google');
// Vendor Google auth (public): one consent screen = identity + calendar scopes.
// Attribution rides along as query params so a host who arrived from an ad/campaign
// is stamped with their acquisition source (CRM Phase 2b).
export const getVendorGoogleUrl = (intent = 'login', invite) => API.get('/auth/google/vendor', { params: { intent, ...(invite ? { invite } : {}), ...(getAttribution() || {}) } });
export const sendOtp          = (data)         => API.post('/auth/send-otp', data);
export const verifyOtp        = (data)         => API.post('/auth/verify-otp', data);
// Phone-primary user login
export const loginWithPhone   = (data)         => API.post('/auth/login-phone', data);
export const verifyOtpLogin   = (data)         => API.post('/auth/verify-otp-login', data);
export const setUserPassword  = (data)         => API.post('/auth/set-password', data);
// Unified identity: add hosting capability to the current account.
export const becomeHost       = ()             => API.post('/auth/become-host');
export const cancelHosting    = ()             => API.post('/auth/cancel-hosting');
export const verifyLinkedin   = ()             => API.post('/auth/linkedin/verify');
export const forgotPassword   = (data)         => API.post('/auth/forgot-password', data);
export const resetPassword    = (data)         => API.post('/auth/reset-password', data);

// ── Newsletter (public) — POST /email/subscribe records the address as a
// campaign contact AND a CRM lead server-side. Callers stay best-effort: on a
// network failure they still stash the address client-side so it is never lost.
export const subscribeNewsletter = (email)     => API.post('/email/subscribe', { email, attribution: getAttribution() });

// ── Contact form (public) ─────────────────────────────────────
export const sendContactMessage = (data) => API.post('/contact', data);
export const submitEnterpriseLead = (data) => API.post('/enterprise-lead', { ...data, attribution: getAttribution() });

// ── /become-a-host "Book a Demo" lead form (public, phone-OTP) ────
export const sendDemoLeadOtp   = (data) => API.post('/demo-lead/send-otp', { ...data, attribution: getAttribution() });
export const submitDemoLead = (data) => API.post('/demo-lead', { ...data, attribution: getAttribution() });

// ── Bolt support bot (public) ─────────────────────────────────
export const askBot = (data) => API.post('/bot/ask', data);
export const sendBotFeedback = (data) => API.post('/bot/feedback', data);
// Anonymous escalation: verify a WhatsApp number / email before handing to support.
export const botEscalateSendOtp = (data) => API.post('/bot/escalate/send-otp', data);
export const botEscalateVerifyOtp = (data) => API.post('/bot/escalate/verify-otp', data);
export const botEscalateRating = (data) => API.post('/bot/escalate/rating', data);

// ── Support chat (host/guest ↔ Bolt → human) ──────────────────
export const getSupportUnread   = ()         => API.get('/support/unread');
export const getSupportHours    = ()         => API.get('/support/hours');
export const getSupportThread   = ()         => API.get('/support/thread');
export const getSupportThreads  = ()         => API.get('/support/threads');
export const startSupportTopic  = ()         => API.post('/support/thread/new');
export const getSupportMessages = (id)       => API.get(`/support/thread/${id}/messages`);
export const sendSupportMessage = (id, data) => API.post(`/support/thread/${id}/messages`, data);
export const uploadSupportAttachment = (id, file) => {
  const fd = new FormData();
  fd.append('image', file);
  return API.post(`/support/thread/${id}/attachment`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
};
export const escalateSupport    = (id, data) => API.post(`/support/thread/${id}/escalate`, data || {});
export const rateSupportThread  = (id, data) => API.post(`/support/thread/${id}/rating`, data);
export const markSupportRead    = (id)       => API.post(`/support/thread/${id}/read`);

// Streaming ask over SSE. Uses fetch (axios can't stream response bodies in the
// browser). Calls onDelta(text) per chunk, onDone({escalate, cited_sources,
// conversationId, messageId}) at the end, onError({message}) on failure. Returns a
// promise that resolves when the stream closes; pass an AbortSignal to cancel.
export async function streamBot({ question, conversationId, visitorId, pageUrl }, { onDelta, onDone, onError, signal } = {}) {
  const base = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
  const session = JSON.parse(localStorage.getItem('user') || 'null');
  const headers = { 'Content-Type': 'application/json' };
  if (session?.token) headers.Authorization = `Bearer ${session.token}`;

  let res;
  try {
    res = await fetch(`${base}/bot/ask/stream`, {
      method: 'POST', headers, body: JSON.stringify({ question, conversationId, visitorId, pageUrl }), signal,
    });
  } catch (e) {
    if (e.name !== 'AbortError') onError?.({ message: 'network' });
    return;
  }
  if (!res.ok || !res.body) { onError?.({ message: 'network' }); return; }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  const dispatch = (frame) => {
    let event = 'message';
    const dataLines = [];
    for (const line of frame.split('\n')) {
      if (line.startsWith('event:')) event = line.slice(6).trim();
      else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
    }
    if (!dataLines.length) return;
    let data; try { data = JSON.parse(dataLines.join('\n')); } catch { return; }
    if (event === 'delta') onDelta?.(data.text);
    else if (event === 'done') onDone?.(data);
    else if (event === 'error') onError?.(data);
  };

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buf.indexOf('\n\n')) >= 0) {
        const frame = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        if (frame.trim()) dispatch(frame);
      }
    }
  } catch (e) {
    if (e.name !== 'AbortError') onError?.({ message: 'network' });
  }
}

// ── Email preferences (public, signed-token gated) ────────────
export const getUnsubscribeStatus = (token)    => API.get('/email/unsubscribe', { params: { token } });
export const unsubscribeEmail     = (token)    => API.post('/email/unsubscribe', { token });
export const resubscribeEmail     = (token)    => API.post('/email/resubscribe', { token });

// ── Admin Auth (separate endpoint — /backstage login) ───────
// Single-step login: username/email + password -> isolated admin session token.
export const adminLoginUser   = (data)         => API.post('/admin-auth/login', data);
export const adminChangePassword = (data)      => API.post('/admin-auth/change-password', data);
export const adminGetMe       = ()             => API.get('/admin-auth/me');
// 2FA (TOTP) — pending_token from login travels in the body, not the auth header.
export const admin2faSetup    = (data)         => API.post('/admin-auth/2fa-setup', data);
export const admin2faConfirm  = (data)         => API.post('/admin-auth/2fa-confirm', data);
export const admin2faVerify   = (data)         => API.post('/admin-auth/2fa-verify', data);

// ── Admin: Operations Center ──────────────────────────────────
export const adminOpsSummary  = ()             => API.get('/admin/ops/summary');

// ── Admin: image upload (badges, branding, CMS) ───────────────
// Sends multipart/form-data; the request interceptor attaches the bas_admin token.
export const adminUploadImage = (file, folder = 'badges') => {
  const fd = new FormData();
  fd.append('image', file);
  return API.post(`/admin/upload/image?folder=${encodeURIComponent(folder)}`, fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

// ── Appearance — navbar logo ──────────────────────────────────
export const getAppearance         = ()            => API.get('/appearance');            // public
export const adminGetAppearance    = ()            => API.get('/admin/appearance');
export const adminUpdateAppearance = (data)        => API.put('/admin/appearance', data);

// ── Admin: Staff & Roles (Super Admin only) ───────────────────
export const adminListRoles        = ()            => API.get('/admin/roles');
export const adminListStaff        = ()            => API.get('/admin/staff');
export const adminGetStaff         = (id)          => API.get(`/admin/staff/${id}`);
export const adminCreateStaff      = (data)        => API.post('/admin/staff', data);
export const adminUpdateStaff      = (id, data)    => API.put(`/admin/staff/${id}`, data);
export const adminSetStaffActive   = (id, active)  => API.patch(`/admin/staff/${id}/status`, { is_active: active });
export const adminResetStaffPass   = (id, data)    => API.post(`/admin/staff/${id}/reset-password`, data || {});

// ── Admin: Audit log ──────────────────────────────────────────
export const adminAuditLogs    = (params)      => API.get('/admin/audit', { params });
export const adminAuditActions = ()            => API.get('/admin/audit/actions');

// ── Financial ledger (P1) ──
export const adminFinanceSummary      = ()            => API.get('/admin/finance/summary');
export const adminFinanceAccounts     = ()            => API.get('/admin/finance/accounts');
export const adminFinanceJournals     = (params)      => API.get('/admin/finance/journals', { params });
export const adminFinanceJournal      = (id)          => API.get(`/admin/finance/journals/${id}`);
export const adminFinanceLedger       = (accountId, params) => API.get(`/admin/finance/ledger/${accountId}`, { params });
export const adminFinanceAdjustment   = (data)        => API.post('/admin/finance/adjustment', data);
export const adminFinanceReversal     = (data)        => API.post('/admin/finance/reversal', data);
export const adminFinanceBankTransfer = (data)        => API.post('/admin/finance/bank-transfer', data);
export const adminFinanceRefund       = (data)        => API.post('/admin/finance/refund', data);
// Execute a real Razorpay refund from the booking view. mode: 'tiered' | 'full'.
export const adminExecuteRefund       = (data)        => API.post('/admin/finance/refund/execute', data);

// Admin — GST command center (/admin/gst). All figures derive from the invoices
// table server-side; these are read-only for P2 (overview/transactions/invoices).
export const adminGstOverview      = (params)      => API.get('/admin/gst/overview', { params });
export const adminGstTransactions  = (params)      => API.get('/admin/gst/transactions', { params });
export const adminGstInvoices      = (params)      => API.get('/admin/gst/invoices', { params });
export const adminGstInvoice       = (id)          => API.get(`/admin/gst/invoices/${id}`);
// Printable tax invoice (HTML) — returns a blob for browser download.
export const adminGstInvoiceDownload = (id)        => API.get(`/admin/gst/invoices/${id}/download`, { responseType: 'blob' });
// CSV export of a report (transactions/sales-register) — returns a blob.
export const adminGstReportCsv     = (type, params) => API.get(`/admin/gst/reports/${type}`, { params: { ...params, format: 'csv' }, responseType: 'blob' });
// GST — action center, reconciliation, ITC, returns, reports, settings (P3).
export const adminGstIssues        = (params)      => API.get('/admin/gst/issues', { params });
export const adminGstSetIssueStatus = (data)       => API.post('/admin/gst/issues/status', data);
export const adminGstReconciliation = (params)     => API.get('/admin/gst/reconciliation', { params });
export const adminGstItc            = (params)      => API.get('/admin/gst/itc', { params });
export const adminGstReturns        = (params)      => API.get('/admin/gst/returns', { params });
export const adminGstSetReturnStatus = (data)      => API.post('/admin/gst/returns/status', data);
export const adminGstReport         = (type, params) => API.get(`/admin/gst/reports/${type}`, { params });
export const adminGstSettings       = ()           => API.get('/admin/gst/settings');
export const adminGstExports        = ()           => API.get('/admin/gst/exports');
export const adminGstCreateExport   = (data)       => API.post('/admin/gst/exports', data);
export const adminGstDownloadExport = (id)         => API.get(`/admin/gst/exports/${id}/download`);

// Admin — SEO audit dashboard (/admin/seo). Read-only crawl findings.
export const adminSeoOverview     = ()        => API.get('/admin/seo/overview');
export const adminSeoIssues       = (params)  => API.get('/admin/seo/issues', { params });
export const adminSeoIssue        = (id)      => API.get(`/admin/seo/issues/${id}`);
export const adminSeoPages        = (params)  => API.get('/admin/seo/pages', { params });
export const adminSeoPage         = (id)      => API.get(`/admin/seo/pages/${id}`);
export const adminSeoCategories   = (params)  => API.get('/admin/seo/categories', { params });
export const adminSeoReports      = (params)  => API.get('/admin/seo/reports', { params });
export const adminSeoChanges      = ()        => API.get('/admin/seo/changes');
export const adminSeoFixes        = (params)  => API.get('/admin/seo/fixes', { params });
export const adminSeoFix          = (id)      => API.get(`/admin/seo/fixes/${id}`);
export const adminSeoGenerateFixes = (data)   => API.post('/admin/seo/fixes/generate', data || {});
export const adminSeoDecideFix    = (id, data) => API.post(`/admin/seo/fixes/${id}/decide`, data);
export const adminSeoApplyFix     = (id)      => API.post(`/admin/seo/fixes/${id}/apply`);
export const adminSeoMarkApplied  = (id, data) => API.post(`/admin/seo/fixes/${id}/mark-applied`, data);
export const adminSeoRollbackFix  = (id)      => API.post(`/admin/seo/fixes/${id}/rollback`);
export const adminSeoRetestFix    = (id)      => API.post(`/admin/seo/fixes/${id}/retest`);
export const adminSeoRunCrawl     = ()        => API.post('/admin/seo/crawl');
export const adminSeoCrawlStatus  = (id)      => API.get(`/admin/seo/crawl/${id}`);
export const adminSeoMuteIssue    = (id, data) => API.post(`/admin/seo/issues/${id}/mute`, data);
export const adminSeoScoreHistory = ()        => API.get('/admin/seo/scores/history');
export const adminSeoGsc          = (params)  => API.get('/admin/seo/gsc', { params });
export const adminSeoGscStatus    = ()        => API.get('/admin/seo/gsc/status');
export const adminSeoGscSync      = ()        => API.post('/admin/seo/gsc/sync');
// v2 control center: list-first views, dashboard, opportunities, page inspector.
export const adminSeoList         = (params)  => API.get('/admin/seo/list', { params });
export const adminSeoDashboard    = (params)  => API.get('/admin/seo/dashboard', { params });
export const adminSeoOpportunities = (params) => API.get('/admin/seo/opportunities', { params });
export const adminSeoLinkGraph    = (params)  => API.get('/admin/seo/link-graph', { params });

// Admin — Payout approval
export const adminGetPayouts     = (status)         => API.get('/admin/payouts', { params: status ? { status } : {} });
export const adminApprovePayout  = (id)             => API.post(`/admin/payouts/${id}/approve`);
export const adminRejectPayout   = (id, reason)     => API.post(`/admin/payouts/${id}/reject`, { reason });
export const adminMarkPayoutPaid = (id, reference)  => API.post(`/admin/payouts/${id}/pay`, { payment_reference: reference });
export const adminReleasePayoutRoute = (id)         => API.post(`/admin/payouts/${id}/pay-route`);
export const adminGetPayoutClearing = ()            => API.get('/admin/payouts/clearing');
export const adminRunPayoutReconcile = ()           => API.post('/admin/payouts/reconcile');
export const adminGetDisputes       = (status)      => API.get('/admin/disputes', { params: status ? { status } : {} });
export const adminResolveDispute    = (id, resolution) => API.post(`/admin/disputes/${id}/resolve`, { resolution });
export const adminReverseBookingPayout = (id, reason)  => API.post(`/admin/bookings/${id}/reverse-payout`, { reason });

// Refer & Earn config ("what's paid for what, per plan+cadence") + ledger view.
export const adminGetReferralRules  = ()            => API.get('/admin/referral-rules');
export const adminUpdateReferralRule = (id, data)   => API.patch(`/admin/referral-rules/${id}`, data);
export const adminGetReferrals      = (status)      => API.get('/admin/referrals', { params: status ? { status } : {} });

// Invite links (lead-source attribution) — public + admin.
export const getInviteConfig       = (slug)      => API.get(`/invite/${slug}`);
export const recordInviteVisit     = (slug)      => API.post(`/invite/${slug}/visit`);
export const adminGetInviteLinks   = ()          => API.get('/admin/invite-links');
export const adminCreateInviteLink = (data)      => API.post('/admin/invite-links', data);
export const adminUpdateInviteLink = (slug, d)   => API.patch(`/admin/invite-links/${slug}`, d);

// Admin — Reviews moderation
export const adminGetReviews     = (params)         => API.get('/admin/reviews', { params });
export const adminModerateReview = (id, data)       => API.patch(`/admin/reviews/${id}`, data);
export const adminDeleteReview   = (id)             => API.delete(`/admin/reviews/${id}`);

// ── Vendor Onboarding (Google-first flow) ─────────────────────
// Removed in onboarding reshape (server endpoints deleted):
//   sendOnboardingOtp, verifyOnboardingOtp, createVendorAccount, checkSlugAvailable
export const checkOnboardingSlug  = (slug)             => API.post('/onboarding/slug-available', { slug });
export const claimOnboardingSlug  = (slug)             => API.post('/onboarding/claim-slug', { slug });
export const updateOnboardingStep = (data)             => API.post('/onboarding/update-step', data);
export const saveOnboardingPersona = (primary_category) => API.post('/onboarding/save-persona', { primary_category });
export const saveOnboardingDetails = (data)             => API.post('/onboarding/save-details', data);
export const getOnboardingStatus  = ()                 => API.get('/onboarding/status');
export const whatsappSendOtp      = (phone)            => API.post('/whatsapp/send-otp', { phone });
export const whatsappVerifyOtp    = (phone, otp)       => API.post('/whatsapp/verify-otp', { phone, otp });
export const activateFreePlan     = ()                 => API.post('/onboarding/activate-free');
export const advanceToLive        = ()                 => API.post('/onboarding/advance-to-live');
export const markOnboardingComplete = ()               => API.post('/onboarding/mark-complete');

// ── Categories / professions ──────────────────────────────────
export const getCategories       = ()        => API.get('/categories');
export const suggestCategory     = (label)   => API.post('/categories/suggest', { label });
export const adminListCategories = (params)  => API.get('/admin/categories', { params });
export const adminCreateCategory = (data)    => API.post('/admin/categories', data);
export const adminUpdateCategory = (id, data) => API.put(`/admin/categories/${id}`, data);
export const adminDeleteCategory = (id)      => API.delete(`/admin/categories/${id}`);

// ── Service Categories (admin CRUD + public picker) ───────────
export const adminListServiceCategories    = (primary)    => API.get('/admin/service-categories', { params: primary ? { primary } : {} });
export const adminCreateServiceCategory    = (d)          => API.post('/admin/service-categories', d);
export const adminUpdateServiceCategory    = (id, d)      => API.put(`/admin/service-categories/${id}`, d);
export const adminDeleteServiceCategory    = (id)         => API.delete(`/admin/service-categories/${id}`);
export const adminReorderServiceCategories = (rows)       => API.put('/admin/service-categories/reorder', { rows });
// Profession-scoped: pass the host's primary_category slug to get its service list.
export const listServiceCategories         = (primary)    => API.get('/service-categories', { params: primary ? { primary } : {} });
// Host suggests a new subcategory for their profession (pending admin approval).
export const hostSuggestServiceCategory    = (data)       => API.post('/service-categories/suggest', data);

// ── Services Directory (public SEO — /services, /services/:profession) ──
export const getServicesDirectory   = ()     => API.get('/services-directory');
export const getProfessionServices  = (slug) => API.get(`/services-directory/${slug}`);

export const hostGetCategories      = ()         => API.get('/host/categories');
export const hostUpdateCategories   = (payload)  => API.put('/host/categories', payload);
export const adminSetUserCategories = (id, data) => API.patch(`/admin/users/${id}/categories`, data);

// ── Host ──────────────────────────────────────────────────────
export const getHostProfile   = (username)       => API.get(`/host/${username}`);
export const getServiceBySlug = (username, slug) => API.get(`/host/${username}/${slug}`);
export const updateProfile    = (data)           => API.put('/host/profile', data);
// Permanent username (gated: WhatsApp-verified, max 2/365d, 6-month gap).
export const changeUsername   = (username)       => API.put('/host/username', { username });
export const checkUsername    = (slug)           => API.get(`/username/check/${encodeURIComponent(slug)}`);
export const getMyServices    = ()               => API.get('/host/services');
export const updateService    = (id, data)       => API.put(`/host/services/${id}`, data);
export const deleteService    = (id)             => API.delete(`/host/services/${id}`);
export const setAvailability  = (data)           => API.put('/host/availability', data);
export const getAvailability  = ()               => API.get('/host/availability');
export const searchVendors    = (q)              => API.get('/host/search', { params: { q } });

// ── Bookings ──────────────────────────────────────────────────
export const createBooking     = (data)            => API.post('/bookings', data);
export const getHostBookings   = ()                => API.get('/bookings/host');
export const getGuestBookings  = ()                => API.get('/bookings/guest');
export const cancelBooking     = (id)              => API.put(`/bookings/${id}/cancel`);
// Public token-authed guest self-service (no session) — /manage-booking/:token (#516)
export const getManageBooking    = (token)         => API.get(`/manage-booking/${token}`);
export const cancelManageBooking = (token)         => API.post(`/manage-booking/${token}/cancel`);
// F7: resume payment for the one booking the token authorizes (recovery-email link).
export const payManageBooking    = (token, body)   => API.post(`/manage-booking/${token}/pay-order`, body || {});
export const completeBooking   = (id)              => API.put(`/bookings/${id}/complete`);
export const guestCompleteBooking = (id)           => API.put(`/bookings/${id}/guest-complete`);
export const guestReportProblem   = (id, reason)   => API.put(`/bookings/${id}/report-problem`, { reason });
export const markNoShow        = (id)              => API.put(`/bookings/${id}/no-show`);
export const rescheduleBooking = (id, data)        => API.put(`/bookings/${id}/reschedule`, data);
export const getBookedSlots    = (host_id, date)   => API.get('/bookings/slots', { params: { host_id, date } });
// v2.5: server-computed availability (working hours − bookings − Google busy − blocked dates)
export const getAvailableSlots = (host_id, service_id, date) =>
  API.get('/bookings/available-slots', { params: { host_id, service_id, date } });

// ── Payments ──────────────────────────────────────────────────
export const createPaymentOrder   = (data) => API.post('/payment/create-order', data);
export const verifyPayment        = (data) => API.post('/payment/verify', data);
export const subscribePlan        = (data) => API.post('/payment/subscribe', data);
export const verifySubscription   = (data) => API.post('/payment/verify-subscription', data);
// Auto-renewing subscriptions (Razorpay Subscriptions)
export const createSubscription   = (data) => API.post('/payment/subscription/create', data);
export const syncSubscription     = ()     => API.post('/payment/subscription/sync');
export const cancelSubscription   = ()     => API.post('/payment/subscription/cancel');
export const createProductOrder   = (data) => API.post('/payment/create-product-order', data);
export const verifyProductPayment = (data) => API.post('/payment/verify-product', data);

// ── Reviews ───────────────────────────────────────────────────
export const createReview       = (data)      => API.post('/reviews', data);
export const updateReview       = (id, data)  => API.put(`/reviews/booking/${id}`, data);
export const getReceivedReviews = (direction) => API.get('/reviews/received', { params: direction ? { direction } : {} });
export const getHostReviews     = (username)  => API.get(`/reviews/${username}`);
export const getBookingReview   = (id)        => API.get(`/reviews/booking/${id}`);

// ── Vendor feedback ──────────────────────────────────────────
export const submitFeedback  = (data)   => API.post('/feedback', data);
export const getMyFeedback   = ()       => API.get('/feedback/mine');

// ── Upload ────────────────────────────────────────────────────
export const uploadImage = (formData, folder = 'uploads') =>
  API.post(`/upload/image?folder=${folder}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

// Uploads a single product file (field "file") to the products bucket.
// Returns { data: { url, name, size } }.
export const uploadProductFile = (file) => {
  const fd = new FormData();
  fd.append('file', file);
  return API.post('/upload/product-file', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

// ── Vendor dashboard ──────────────────────────────────────────
// Activation funnel: stamp the host's first link-share (fire-and-forget, never blocks UX).
export const markLinkShared     = ()          => API.post('/vendor/share-signal').catch(() => {});
// Dashboard "Next step" nudge — server-tracked dismissal (cross-device).
export const getHostNudges      = ()           => API.get('/host/nudges');
export const dismissHostNudge   = (key)        => API.post(`/host/nudges/${key}/dismiss`);
export const getTransactions    = (params)    => API.get('/vendor/transactions', { params });
export const getPayoutBalance   = ()          => API.get('/vendor/payout/balance');
export const getPayoutRequests  = ()          => API.get('/vendor/payout/requests');
export const requestPayout      = (data)      => API.post('/vendor/payout/request', data);
export const toggleService      = (id)        => API.put(`/vendor/services/${id}/toggle`);

// ── Refer & Earn (host-refers-host) ───────────────────────────
export const captureReferral    = (data)      => API.post('/referrals/capture', data); // { ref }
export const getMyReferrals      = ()          => API.get('/referrals/mine');

// ── KYC (host identity verification) ──────────────────────────
export const getMyKyc   = ()     => API.get('/kyc/me');
export const submitKyc  = (data) => API.post('/kyc', data);
export const uploadKycFile = (file, type) => {
  const fd = new FormData();
  fd.append('file', file);
  return API.post(`/kyc/upload?type=${encodeURIComponent(type)}`, fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};
// Admin
export const adminKycStats  = ()           => API.get('/admin/kyc/stats');
export const adminListKyc   = (status)     => API.get('/admin/kyc', { params: { status } });
export const adminGetKyc    = (id)         => API.get(`/admin/kyc/${id}`);
export const adminDecideKyc = (id, data)   => API.patch(`/admin/kyc/${id}`, data);

// ── Digital Products ──────────────────────────────────────────
export const createProduct       = (data)     => API.post('/products', data);
export const getMyProducts       = ()         => API.get('/products/mine/all');
export const updateProduct       = (id, data) => API.put(`/products/${id}`, data);
export const deleteProduct       = (id)       => API.delete(`/products/${id}`);
export const getHostProducts     = (username) => API.get(`/products/host/${username}`);
export const getProduct          = (id)       => API.get(`/products/${id}`);
// Slug-first public detail (host username + slug-or-id); themed + fee included.
export const getProductPublic    = (username, key) => API.get(`/products/p/${encodeURIComponent(username)}/${encodeURIComponent(key)}`);
export const downloadProduct     = (token)    => API.get(`/products/download/${token}`);
export const freeDownloadProduct = (data)     => API.post('/products/free-download', data);
// Re-issue a lapsed download link (OTP-gated server-side).
export const resendProductLink   = (data)     => API.post('/products/resend-link', data);

// ── Admin ─────────────────────────────────────────────────────
export const adminGetStats       = ()          => API.get('/admin/stats');
export const adminGetInsights    = ()          => API.get('/admin/insights/kpis');
export const adminGetActivation  = (all)        => API.get('/admin/activation', { params: all ? { all: 1 } : {} });
export const adminTestNudges     = (body)       => API.post('/admin/activation/test-send', body);
export const adminGetProviderPlanAnalytics = (params) => API.get('/admin/provider-plan-analytics', { params });
export const adminGetProviderOverview = ()      => API.get('/admin/provider-overview');
export const adminGetRevenueTrend = ()          => API.get('/admin/revenue-trend');
export const adminGetRevenueBreakdown = ()      => API.get('/admin/revenue-breakdown');
export const adminGetUsers       = (params)    => API.get('/admin/users', { params });
export const adminGetUser        = (id)        => API.get(`/admin/users/${id}`);
export const adminUpdateUser     = (id, data)  => API.put(`/admin/users/${id}`, data);
export const adminDeleteUser     = (id)        => API.delete(`/admin/users/${id}`);
export const adminGetBookings    = (params)    => API.get('/admin/bookings', { params });
export const adminUpdateBooking  = (id, data)  => API.put(`/admin/bookings/${id}`, data);
export const adminDeleteBooking  = (id)        => API.delete(`/admin/bookings/${id}`);
export const adminGetServices    = ()          => API.get('/admin/services');
export const adminUpdateService  = (id, data)  => API.put(`/admin/services/${id}`, data);
export const adminDeleteService  = (id)        => API.delete(`/admin/services/${id}`);
export const adminUpdateServiceSeo  = (id, data) => API.put(`/admin/services/${id}/seo`, data);
export const adminUpdateProviderSeo = (id, data) => API.put(`/admin/providers/${id}/seo`, data);
export const adminGetSettings    = ()          => API.get('/admin/settings');
export const adminUpdateSettings = (data)      => API.put('/admin/settings', data);

// ── Admin: Notification System ───────────────────────────────
export const adminGetNotifProvider    = ()         => API.get('/admin/notifications/provider');
export const adminUpdateNotifProvider = (data)     => API.put('/admin/notifications/provider', data);
export const adminTestNotifProvider   = ()         => API.post('/admin/notifications/provider/test');
export const adminGetNotifEvents      = ()         => API.get('/admin/notifications/events');
export const adminUpdateNotifEvent    = (id, data) => API.put(`/admin/notifications/events/${id}`, data);
export const adminTestNotifSend       = (data)     => API.post('/admin/notifications/test-send', data);
export const adminGetNotifLogs        = (params)   => API.get('/admin/notifications/logs', { params });
export const adminRetryNotifLog       = (id)       => API.post(`/admin/notifications/logs/${id}/retry`);

// ── Admin: Badge System ──────────────────────────────────────
export const adminGetBadgeMeta     = ()           => API.get('/admin/badges/meta');
export const adminListBadges       = (params)     => API.get('/admin/badges', { params });
export const adminGetBadge         = (id)         => API.get(`/admin/badges/${id}`);
export const adminCreateBadge      = (data)       => API.post('/admin/badges', data);
export const adminUpdateBadge      = (id, data)   => API.put(`/admin/badges/${id}`, data);
export const adminBadgeStatus      = (id, status) => API.patch(`/admin/badges/${id}/status`, { status });
export const adminPreviewBadge     = (id)         => API.get(`/admin/badges/${id}/preview`);
export const adminPreviewRules     = (data)       => API.post('/admin/badges/preview', data);
export const adminRunBadgeEval     = ()           => API.post('/admin/badges/evaluate');
export const adminVendorBadges     = (vendorId)         => API.get(`/admin/vendors/${vendorId}/badges`);
export const adminAssignBadge      = (vendorId, data)   => API.post(`/admin/vendors/${vendorId}/badges`, data);
export const adminRevokeBadge      = (vendorId, badgeId, reason) => API.delete(`/admin/vendors/${vendorId}/badges/${badgeId}`, { data: { reason } });

// ── Admin: Subscription Plans ────────────────────────────────
export const adminListPlans    = ()         => API.get('/admin/plans');
export const adminCreatePlan   = (data)     => API.post('/admin/plans', data);
export const adminUpdatePlan   = (id, data) => API.put(`/admin/plans/${id}`, data);
export const adminArchivePlan  = (id)       => API.patch(`/admin/plans/${id}/archive`);
export const adminRestorePlan  = (id)       => API.patch(`/admin/plans/${id}/restore`);
export const adminClonePlan    = (id)       => API.post(`/admin/plans/${id}/clone`);
export const adminReorderPlans = (order)    => API.patch('/admin/plans/reorder', { order });
export const adminAssignPlan   = (data)     => API.post('/admin/plans/assign', data);

// ── Admin: payment (Razorpay) settings ────────────────────────
export const adminGetRazorpay    = ()     => API.get('/admin/settings/payment/razorpay');
export const adminUpdateRazorpay = (data) => API.put('/admin/settings/payment/razorpay', data);
export const adminTestRazorpay   = (data) => API.post('/admin/settings/payment/razorpay/test', data);
export const getPublicPlans    = ()         => API.get('/plans');

// ── Admin: Reserved Slugs ────────────────────────────────────
export const getReservedSlugs     = ()      => API.get('/admin/reserved-slugs');
export const createReservedSlug   = (payload) => API.post('/admin/reserved-slugs', payload);
export const releaseReservedSlug  = (id)    => API.delete(`/admin/reserved-slugs/${id}`);
export const checkReservedSlug    = (slug)  => API.get(`/admin/reserved-slugs/check/${encodeURIComponent(slug)}`);

// ── Admin: Email Communication Engine ────────────────────────
export const adminEmailTemplates   = (params)   => API.get('/admin/email/templates', { params });
export const adminEmailTemplate    = (id)       => API.get(`/admin/email/templates/${id}`);
export const adminEmailCreate      = (data)     => API.post('/admin/email/templates', data);
export const adminEmailUpdate      = (id, data) => API.put(`/admin/email/templates/${id}`, data);
export const adminEmailDuplicate   = (id)       => API.post(`/admin/email/templates/${id}/duplicate`);
export const adminEmailArchive     = (id)       => API.patch(`/admin/email/templates/${id}/archive`);
export const adminEmailPreview     = (id, data) => API.post(`/admin/email/templates/${id}/preview`, { data });
export const adminEmailTest        = (id, to)   => API.post(`/admin/email/templates/${id}/test`, { to });
export const adminEmailLogs        = (params)   => API.get('/admin/email/logs', { params });
export const adminEmailLog         = (id)       => API.get(`/admin/email/logs/${id}`);
export const adminEmailRetry       = (id)       => API.post(`/admin/email/logs/${id}/retry`);
export const adminEmailSettings    = ()         => API.get('/admin/email/settings');
export const adminEmailSaveSettings= (data)     => API.put('/admin/email/settings', data);
export const adminEmailEvents      = ()         => API.get('/admin/email/events');

// ── Admin: Campaigns (Phase 1: email) ────────────────────────
export const adminCampContacts     = (params)   => API.get('/admin/campaigns/contacts', { params });
export const adminCampSyncContacts = ()         => API.post('/admin/campaigns/contacts/sync');
export const adminCampSuppress     = (id, data) => API.patch(`/admin/campaigns/contacts/${id}`, data);
export const adminCampSegments     = ()         => API.get('/admin/campaigns/segments');
export const adminCampCreateSegment = (data)    => API.post('/admin/campaigns/segments', data);
export const adminCampSegPreview   = (definition, channel = 'email') => API.post('/admin/campaigns/segments/preview', { definition, channel });
export const adminCampResolveAudience = (data)  => API.post('/admin/campaigns/audience/resolve', data);
export const adminCampTest          = (data)     => API.post('/admin/campaigns/test', data);
export const adminCampaigns        = ()         => API.get('/admin/campaigns');
export const adminCampPreview      = (data)     => API.post('/admin/campaigns/preview', data);
export const adminCampCreate       = (data)     => API.post('/admin/campaigns', data);
export const adminCampGet          = (id)       => API.get(`/admin/campaigns/${id}`);
export const adminCampRecipients   = (id)       => API.get(`/admin/campaigns/${id}/recipients`);
export const adminCampUpdate       = (id, data) => API.put(`/admin/campaigns/${id}`, data);
export const adminCampLaunch       = (id)       => API.post(`/admin/campaigns/${id}/launch`);
// WhatsApp template registry (AiSensy approved templates + variable mapping)
export const adminCampWaTemplates  = ()         => API.get('/admin/campaigns/wa-templates');
export const adminCampWaCreate     = (data)     => API.post('/admin/campaigns/wa-templates', data);
export const adminCampWaUpdate     = (id, data) => API.put(`/admin/campaigns/wa-templates/${id}`, data);

// ── Public: Badge Showcase ───────────────────────────────────
export const getVendorBadges       = (username)         => API.get(`/vendors/${username}/badges`);
export const getVendorBadgeDetail  = (username, badgeId) => API.get(`/vendors/${username}/badges/${badgeId}`);

export default API;

// ── Service Module v2 ─────────────────────────────────────────
export const svcCreate              = (data)                   => API.post('/services', data);
export const svcGetAll              = ()                       => API.get('/services');
export const svcGetById             = (id)                     => API.get(`/services/${id}`);
export const svcUpdate              = (id, data)               => API.put(`/services/${id}`, data);
export const svcDelete              = (id)                     => API.delete(`/services/${id}`);
export const svcDuplicate           = (id)                     => API.post(`/services/${id}/duplicate`);
export const svcToggle              = (id)                     => API.put(`/services/${id}/toggle`);
export const svcGetPublic           = (slug)                   => API.get(`/services/public/${slug}`);
// Clean URL: resolves service by both profileSlug + serviceSlug (validates vendor ownership)
export const svcGetPublicByProfile  = (profileSlug, serviceSlug) => API.get(`/services/public/${profileSlug}/${serviceSlug}`);

// ── AI: Write with Bolt ───────────────────────────────────────
export const aiGenerateListing      = (data)                   => API.post('/services/ai/listing', data);

// Advisory price benchmark — what comparable hosts charge (data, not an LLM guess).
export const getPriceBenchmark      = (category)               => API.get('/services/price-benchmark', { params: category ? { category } : {} });

// ── Blog (public) ─────────────────────────────────────────────
export const getBlogs       = ()     => API.get('/blogs');
export const getBlogBySlug  = (slug) => API.get(`/blogs/${slug}`);

// ── Explore (public) ──────────────────────────────────────────
// Ranked SERVICE listing. `config` carries an AbortController signal so a newer
// keystroke can cancel an in-flight request.
export const getExploreServices   = (params, config = {}) => API.get('/explore', { params, ...config });
// Fire-and-forget click log via sendBeacon (survives the page navigation the click triggers).
export const logExploreClick = (payload) => {
  try {
    const base = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/$/, '');
    const body = new Blob([JSON.stringify(payload)], { type: 'application/json' });
    if (navigator.sendBeacon) navigator.sendBeacon(`${base}/explore/click`, body);
  } catch { /* analytics best-effort */ }
};
export const getExploreFeatured   = ()        => API.get('/explore/featured');
export const getExploreCategories = ()        => API.get('/explore/categories');
export const getExploreCollections= ()        => API.get('/explore/collections');
export const getExploreSponsored  = (keyword) => API.get('/explore/sponsored', { params: { keyword } });

// ── Explore (admin) ───────────────────────────────────────────
export const adminGetExploreFeatured        = ()         => API.get('/admin/explore/featured');
export const adminCreateExploreFeatured     = (data)     => API.post('/admin/explore/featured', data);
export const adminUpdateExploreFeatured     = (id, data) => API.put(`/admin/explore/featured/${id}`, data);
export const adminDeleteExploreFeatured     = (id)       => API.delete(`/admin/explore/featured/${id}`);

export const adminGetExploreCollections     = ()         => API.get('/admin/explore/collections');
export const adminCreateExploreCollection   = (data)     => API.post('/admin/explore/collections', data);
export const adminUpdateExploreCollection   = (id, data) => API.put(`/admin/explore/collections/${id}`, data);
export const adminAddToExploreCollection    = (id, data) => API.post(`/admin/explore/collections/${id}/vendors`, data);
export const adminRemoveFromExploreCollection = (id, vendorId) => API.delete(`/admin/explore/collections/${id}/vendors/${vendorId}`);

export const adminGetExploreBoosts          = ()         => API.get('/admin/explore/boosts');
export const adminCreateExploreBoost        = (data)     => API.post('/admin/explore/boosts', data);
export const adminRevokeExploreBoost        = (id)       => API.delete(`/admin/explore/boosts/${id}`);

export const adminGetExploreVerified        = ()         => API.get('/admin/explore/verified');
export const adminGrantExploreVerified      = (data)     => API.post('/admin/explore/verified', data);
export const adminRevokeExploreVerified     = (id)       => API.delete(`/admin/explore/verified/${id}`);

export const adminGetExploreKeywords        = ()         => API.get('/admin/explore/keywords');
export const adminCreateExploreKeyword      = (data)     => API.post('/admin/explore/keywords', data);
export const adminRevokeExploreKeyword      = (id)       => API.delete(`/admin/explore/keywords/${id}`);

// ── Feature flags ─────────────────────────────────────────────
export const getFeatureFlags    = ()             => API.get('/feature-flags');
export const adminGetFeatures   = ()             => API.get('/admin/features');
export const adminToggleFeature = (key, enabled) => API.patch(`/admin/features/${key}`, { enabled });
export const adminCreateFeature = (payload)      => API.post('/admin/features', payload);

// ── Admin: Sales CRM (/admin/crm) ────────────────────────────
export const crmDashboard        = ()            => API.get('/admin/crm/dashboard');
export const crmPipeline         = ()            => API.get('/admin/crm/pipeline');
export const crmReports          = ()            => API.get('/admin/crm/reports');
export const crmGetDesk          = (limit)       => API.get('/admin/crm/desk', { params: limit ? { limit } : {} });
// Relationship Desk — "who to talk to today" (open touch recommendations).
export const crmGetRelationships     = (limit)   => API.get('/admin/crm/recommendations', { params: limit ? { limit } : {} });
export const crmRecommendationDone   = (id, data) => API.post(`/admin/crm/recommendations/${id}/done`, data || {});
export const crmRecommendationSnooze = (id, until) => API.post(`/admin/crm/recommendations/${id}/snooze`, { until });
export const crmRecommendationDismiss = (id)     => API.post(`/admin/crm/recommendations/${id}/dismiss`);
// Public intent-event sink — fire on identified buying-intent (has email/phone).
export const trackIntent         = (data)        => API.post('/events/intent', data);
export const crmListLeads        = (params)      => API.get('/admin/crm/leads', { params });
export const crmCreateLead       = (data)        => API.post('/admin/crm/leads', data);
export const crmGetLead          = (id)          => API.get(`/admin/crm/leads/${id}`);
export const crmUpdateLead       = (id, data)    => API.patch(`/admin/crm/leads/${id}`, data);
export const crmLeadTimeline     = (id)          => API.get(`/admin/crm/leads/${id}/timeline`);
export const crmLeadMessages     = (id)          => API.get(`/admin/crm/leads/${id}/messages`);
export const crmSetStatus        = (id, status, reason)  => API.post(`/admin/crm/leads/${id}/status`, { status, reason });
export const crmSetOwner         = (id, ownerAdminId) => API.post(`/admin/crm/leads/${id}/owner`, { ownerAdminId });
// Merge this lead (id, the duplicate) into `into` (the lead kept). Deletes id.
export const crmMergeLead        = (id, into)    => API.post(`/admin/crm/leads/${id}/merge`, { into });
export const crmAddTag           = (id, tag)     => API.post(`/admin/crm/leads/${id}/tags`, { tag });
export const crmRemoveTag        = (id, tag)     => API.delete(`/admin/crm/leads/${id}/tags/${encodeURIComponent(tag)}`);
export const crmSetDnc           = (id, value)   => API.post(`/admin/crm/leads/${id}/dnc`, { value });
export const crmAddLeadNote      = (id, body)    => API.post(`/admin/crm/leads/${id}/notes`, { body });
export const crmLogCall          = (id, data)    => API.post(`/admin/crm/leads/${id}/call`, data);
export const crmSendWhatsApp     = (id, data)    => API.post(`/admin/crm/leads/${id}/whatsapp`, data);
export const crmSendEmail        = (id, data)    => API.post(`/admin/crm/leads/${id}/email`, data);
export const crmListFollowUps    = (params)      => API.get('/admin/crm/follow-ups', { params });
export const crmCreateFollowUp   = (id, data)    => API.post(`/admin/crm/leads/${id}/follow-ups`, data);
export const crmCompleteFollowUp = (id)          => API.post(`/admin/crm/follow-ups/${id}/complete`);
export const crmCancelFollowUp   = (id)          => API.post(`/admin/crm/follow-ups/${id}/cancel`);
export const crmListSequences    = (audience)    => API.get('/admin/crm/sequences', { params: audience ? { audience } : {} });
export const crmCreateSequence   = (data)        => API.post('/admin/crm/sequences', data);
export const crmEnroll           = (id, sequenceId) => API.post(`/admin/crm/leads/${id}/enroll`, { sequenceId });
export const crmBulk             = (data)        => API.post('/admin/crm/leads/bulk', data);
export const crmImportPreview    = (rows)        => API.post('/admin/crm/import/preview', { rows });
// Batches large imports (see utils/batchImport) so the payload never trips the
// server's JSON body limit — both import modals call this and get it for free.
export const crmImportCommit     = (rows, listId) =>
  batchedImport((body) => API.post('/admin/crm/import/commit', body), rows, listId);
export const crmLeadsExportCsv   = (params)      => API.get('/admin/crm/leads/export.csv', { params, responseType: 'blob' });
export const crmRefreshAttribution = ()          => API.post('/admin/crm/attribution/refresh');
export const crmListTemplates    = (channel)     => API.get('/admin/crm/templates', { params: channel ? { channel } : {} });
export const crmCreateTemplate   = (data)        => API.post('/admin/crm/templates', data);
export const crmUpdateTemplate   = (id, data)    => API.patch(`/admin/crm/templates/${id}`, data);
export const crmDeleteTemplate   = (id)          => API.delete(`/admin/crm/templates/${id}`);
export const crmListViews        = ()            => API.get('/admin/crm/views');
export const crmCreateView       = (data)        => API.post('/admin/crm/views', data);
export const crmDeleteView       = (id)          => API.delete(`/admin/crm/views/${id}`);
export const crmListLists        = ()            => API.get('/admin/crm/lists');
export const crmCreateList       = (data)        => API.post('/admin/crm/lists', data);
export const crmGetList          = (id)          => API.get(`/admin/crm/lists/${id}`);
// Cold Calling tab — call queue, batched CSV import, outcome (+ follow-ups), reminders.
export const crmColdCallQueue    = (listId)      => API.get('/admin/crm/cold-calls/queue', { params: { listId } });
export const crmColdCallStats    = (days = 7)    => API.get('/admin/crm/cold-calls/stats', { params: { days } });
export const crmColdCallFollowUps = (params)    => API.get('/admin/crm/cold-calls/follow-ups', { params });
export const crmColdCallSetFollowUp = (leadId, data) => API.post(`/admin/crm/cold-calls/${leadId}/follow-up`, data);
export const crmColdCallHistory  = (params)      => API.get('/admin/crm/cold-calls/history', { params });
export const crmColdCallReports  = (params)      => API.get('/admin/crm/cold-calls/reports', { params });
export const crmColdCallSearch   = (q)           => API.get('/admin/crm/cold-calls/search', { params: { q } });
export const crmColdCallImport   = (rows, listId, listName) =>
  batchedImport((body) => API.post('/admin/crm/cold-calls/import', { ...body, listName }), rows, listId);
export const crmColdCallOutcome  = (leadId, data) => API.post(`/admin/crm/cold-calls/${leadId}/outcome`, data);
export const crmColdCallRemind   = (leadId, data) => API.post(`/admin/crm/cold-calls/${leadId}/remind`, data);
export const crmColdCallSend     = (leadId, data) => API.post(`/admin/crm/cold-calls/${leadId}/send`, data);
export const crmColdCallDetails  = (leadId, data) => API.post(`/admin/crm/cold-calls/${leadId}/details`, data);
export const crmListTags         = ()            => API.get('/admin/crm/tags');
export const crmCreateTag        = (data)        => API.post('/admin/crm/tags', data);
export const crmUpdateTag        = (id, data)    => API.patch(`/admin/crm/tags/${id}`, data);
export const crmDeleteTag        = (id)          => API.delete(`/admin/crm/tags/${id}`);
// ── Admin: Feedback ──────────────────────────────────────────
export const adminListFeedback   = (params)   => API.get('/admin/feedback', { params });
export const adminUpdateFeedback = (id, data) => API.patch(`/admin/feedback/${id}`, data);

// Bolt support console — knowledge gaps + FAQ layer
export const adminListBotGaps  = (params)   => API.get('/admin/bot/gaps', { params });
export const adminResolveBotGap = (id, data) => API.patch(`/admin/bot/gaps/${id}`, data);
export const adminListBotFaqs  = ()         => API.get('/admin/bot/faqs');
export const adminCreateBotFaq = (data)     => API.post('/admin/bot/faqs', data);
export const adminUpdateBotFaq = (id, data) => API.patch(`/admin/bot/faqs/${id}`, data);
export const adminDeleteBotFaq = (id)       => API.delete(`/admin/bot/faqs/${id}`);
export const adminBotAnalytics = ()         => API.get('/admin/bot/analytics');
export const adminBotGraph     = ()         => API.get('/admin/bot/graph');
export const adminListBotCache = ()         => API.get('/admin/bot/cache');
export const adminDeleteBotCache = (id)     => API.delete(`/admin/bot/cache/${id}`);
// Support chat inbox — live host/guest ↔ admin threads (filter: waiting|mine|all)
export const adminSupportQueue     = (filter)     => API.get('/admin/support/queue', { params: { filter } });
export const adminGetSupportThread = (id)         => API.get(`/admin/support/thread/${id}`);
export const adminSupportContext   = (id)         => API.get(`/admin/support/thread/${id}/context`);
export const adminReplySupport     = (id, data)   => API.post(`/admin/support/thread/${id}/reply`, data);
export const adminAssignSupport    = (id, data)   => API.post(`/admin/support/thread/${id}/assign`, data || {});
export const adminResolveSupport   = (id, data)   => API.post(`/admin/support/thread/${id}/resolve`, data || {});
export const adminSupportInsights  = (days)       => API.get('/admin/support/insights', { params: { days } });
export const adminSupportReasons   = ()           => API.get('/admin/support/reasons');
// Escalations (human handoffs) — list, thread, reply, status
export const adminListEscalations  = (params)   => API.get('/admin/bot/escalations', { params });
export const adminGetEscalation    = (id)       => API.get(`/admin/bot/escalations/${id}`);
export const adminReplyEscalation  = (id, data) => API.post(`/admin/bot/escalations/${id}/reply`, data);
export const adminUpdateEscalation = (id, data) => API.patch(`/admin/bot/escalations/${id}`, data);
// ── Reschedule fee ────────────────────────────────────────────
export const createRescheduleFeeOrder = (bookingId) => API.post('/payment/reschedule-fee/create-order', { booking_id: bookingId });

// ── In-app Notifications ──────────────────────────────────────
export const getNotifications         = (role) => API.get('/notifications', { params: { role } });
export const getNotificationChannel   = ()     => API.get('/notifications/channel');
export const markAllNotificationsRead = (role) => API.post('/notifications/read-all', null, { params: { role } });
export const markNotificationRead     = (id)   => API.patch(`/notifications/${id}/read`);

// ── Admin: IP blocking (super-only) ───────────────────────────
export const adminGetBlockedIps     = ()      => API.get('/admin/security/blocked-ips');
export const adminCreateBlockedIp   = (data)  => API.post('/admin/security/blocked-ips', data);
export const adminDeleteBlockedIp   = (ip)    => API.delete(`/admin/security/blocked-ips/${encodeURIComponent(ip)}`);
export const adminGetAllowlist      = ()      => API.get('/admin/security/allowlist');
export const adminCreateAllowlistIp = (data)  => API.post('/admin/security/allowlist', data);
export const adminDeleteAllowlistIp = (ip)    => API.delete(`/admin/security/allowlist/${encodeURIComponent(ip)}`);

// Absolute URL to a GST tax invoice (token-gated public view; opens print dialog).
export const invoiceUrl = (id, token) =>
  `${API.defaults.baseURL.replace(/\/$/, '')}/invoices/${id}?token=${encodeURIComponent(token)}`;

// The logged-in user's own GST invoices (subscriptions + bookings billed to them).
export const getMyInvoices = () => API.get('/invoices/mine');

// ── Studio Client CRM (Host 360) ──────────────────────────────
// Every route is Studio-gated server-side (requireCrm); a non-Studio host gets
// a 403 { upgrade_required: true } which the pages show as an upsell.
export const crmGetCustomers      = (params)         => API.get('/crm/customers', { params });
export const crmGetCustomer       = (id)             => API.get(`/crm/customers/${id}`);
// Blob response — caller builds an object URL and triggers the download.
export const crmExportCsv         = ()               => API.get('/crm/customers.csv', { responseType: 'blob' });
// A client with id:null has no persisted row yet — resolve it to a UUID handle
// before navigating to the detail page (ensureCustomer is idempotent server-side).
export const crmResolveCustomer   = (customer_key)   => API.post('/crm/customers/resolve', { customer_key });
export const crmGetNotes          = (id)             => API.get(`/crm/customers/${id}/notes`);
export const crmAddNote           = (id, body)       => API.post(`/crm/customers/${id}/notes`, { body });
export const crmDeleteNote        = (id, noteId)     => API.delete(`/crm/customers/${id}/notes/${noteId}`);
export const crmUpdateAttributes  = (id, data)       => API.patch(`/crm/customers/${id}/attributes`, data);

// ── Admin: Host 360° ──────────────────────────────────────────
// Super-admin operational command-center for a single host. All routes are
// requireAdmin(<perm>)-gated server-side; the bas_admin token is attached
// automatically by the request interceptor for /admin* URLs.
export const adminHost360List       = (params)          => API.get('/admin/host360', { params });
export const adminHost360Managers   = ()                => API.get('/admin/host360/account-managers');
export const adminHost360CreateManager = (data)         => API.post('/admin/host360/account-managers', data);
export const adminHost360UpdateManager = (id, data)     => API.patch(`/admin/host360/account-managers/${id}`, data);
export const adminHost360Get        = (id)              => API.get(`/admin/host360/${id}`);
export const adminHost360Usage      = (id)              => API.get(`/admin/host360/${id}/usage`);
export const adminHost360Billing    = (id)              => API.get(`/admin/host360/${id}/billing`);
export const adminHost360Timeline   = (id, params)     => API.get(`/admin/host360/${id}/timeline`, { params });
export const adminHost360Customers  = (id)              => API.get(`/admin/host360/${id}/customers`);
export const adminHost360Support    = (id)              => API.get(`/admin/host360/${id}/support`);
export const adminHost360Documents  = (id)              => API.get(`/admin/host360/${id}/documents`);
// Admin paperwork against a host (contracts/agreements) — multipart field "file",
// stored in the private kyc bucket. Needs documents.manage (v3.81).
export const adminHost360UploadDoc  = (id, file, docType) => {
  const fd = new FormData();
  fd.append('file', file);
  if (docType) fd.append('doc_type', docType);
  return API.post(`/admin/host360/${id}/documents`, fd);
};
export const adminHost360DeleteDoc  = (id, docId)      => API.delete(`/admin/host360/${id}/documents/${docId}`);
// Unmasked KYC PAN/Aadhaar/bank. Needs kyc.decide and is audited server-side on
// every call — only fetch it in response to a deliberate admin action.
export const adminHost360RevealKyc  = (id)             => API.get(`/admin/host360/${id}/documents/reveal`);
export const adminHost360Notes      = (id)              => API.get(`/admin/host360/${id}/notes`);
export const adminHost360AddNote    = (id, body)       => API.post(`/admin/host360/${id}/notes`, body);
export const adminHost360UpdateNote = (id, noteId, body) => API.put(`/admin/host360/${id}/notes/${noteId}`, body);
export const adminHost360DeleteNote = (id, noteId)     => API.delete(`/admin/host360/${id}/notes/${noteId}`);
export const adminHost360Suspend    = (id, body)       => API.post(`/admin/host360/${id}/actions/suspend`, body);
export const adminHost360SetPlan    = (id, body)       => API.post(`/admin/host360/${id}/actions/plan`, body);
export const adminHost360AssignAm   = (id, body)       => API.post(`/admin/host360/${id}/actions/assign-am`, body);
export const adminHost360SendEmail  = (id, body)       => API.post(`/admin/host360/${id}/actions/email`, body);

// Guest 360 (read-only) — key is a CRM customer key ('p:<10>' | 'e:<email>'), URL-encoded.
export const adminGuest360List = (params)  => API.get('/admin/guest360', { params });
export const adminGuest360Get  = (key)     => API.get(`/admin/guest360/${encodeURIComponent(key)}`);
const g360 = (key) => `/admin/guest360/${encodeURIComponent(key)}`;
export const adminGuest360Notes     = (key)          => API.get(`${g360(key)}/notes`);
export const adminGuest360AddNote   = (key, body)    => API.post(`${g360(key)}/notes`, { body });
export const adminGuest360DeleteNote= (key, noteId)  => API.delete(`${g360(key)}/notes/${noteId}`);
export const adminGuest360Email     = (key, body)    => API.post(`${g360(key)}/actions/email`, body);
export const adminGuest360Suspend   = (key, body)    => API.post(`${g360(key)}/actions/suspend`, body);

const express = require('express');
const multer  = require('multer');
const router  = express.Router();

// SECURITY: every admin route is gated by the isolated RBAC middleware.
// requireAdmin(permission) verifies the super-admin-secret JWT, rejects any
// non-admin token, then checks the embedded permission array. A vendor JWT can
// never pass. requireSuperAdmin requires the wildcard (super role) outright.
const { requireAdmin, requireSuperAdmin } = require('../middleware/adminMiddleware');

const {
  getStats, getProviderPlanAnalytics, getProviderOverview, getRevenueTrend, getRevenueBreakdown, getUsers, getUserById, updateUser, deleteUser, adminSetUserCategories,
  getAllBookings, updateBooking, deleteBooking, getBookingPaymentEvents,
  getAllServices, updateService, deleteService, updateServiceSeo, updateProviderSeo,
  getSettings, updateSettings,
} = require('../controllers/adminController');

// ── Operations Center ──────────────────────────────────────────
const ops = require('../controllers/opsAdminController');
router.get('/stats',                    requireAdmin('ops.view'),             getStats);
router.get('/provider-plan-analytics',  requireAdmin('professionals.view'),   getProviderPlanAnalytics);
router.get('/provider-overview',        requireAdmin('professionals.view'),   getProviderOverview);
router.get('/revenue-trend',            requireAdmin('analytics.view'),      getRevenueTrend);
router.get('/revenue-breakdown',        requireAdmin('analytics.view'),      getRevenueBreakdown);

// ── TDS (194-O) / TCS (§52) filing exports — 26Q + GSTR-8 (v4) ──
// Gated on commission.view (finance + operations), NOT analytics.view: this
// report decrypts every host's PAN (a government ID) for filing, and
// analytics.view is also held by the marketing role, which has no business
// reading PAN. commission.view excludes marketing + support; the roles it keeps
// already see PAN via kyc.view, so this is consistent, not a new grant.
const withholding = require('../controllers/withholdingAdminController');
router.get('/reports/withholding',      requireAdmin('commission.view'),     withholding.getWithholdingReport);

// ── GST command center — /api/admin/gst/* (docs/gst-finance-module-architecture.md) ──
// Derives all figures from the invoices table (source of truth); own gst.* RBAC.
router.use('/gst', require('./gstRoutes'));
router.use('/seo', require('./seoRoutes'));

// ── Marketing / performance insights (owned KPI tiles, Postgres-first) ──
const insights = require('../controllers/insightsAdminController');
router.get('/insights/kpis', requireAdmin('analytics.view'), insights.getKpis);
router.get('/activation', requireAdmin('analytics.view'), insights.getActivationFunnel);
router.post('/activation/test-send', requireAdmin('settings.manage'), insights.testSendActivationNudges);
router.get('/ops/summary',  requireAdmin('ops.view'), ops.getSummary);

// ── Image upload (admin session) — badges, branding, CMS, etc. ─
// Reuses the shared uploadImage handler; admin uploader id comes from req.admin.
const { uploadImage } = require('../controllers/uploadController');
const adminUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });
router.post('/upload/image', requireAdmin(), adminUpload.single('image'), uploadImage);

// ── Users ──────────────────────────────────────────────────────
router.get('/users',        requireAdmin('users.view'),   getUsers);
router.get('/users/:id',    requireAdmin('users.view'),   getUserById);
router.put('/users/:id',    requireAdmin('users.edit'),   updateUser);
router.delete('/users/:id', requireAdmin('users.delete'), deleteUser);
router.patch('/users/:id/categories', requireAdmin('users.edit'), adminSetUserCategories);

// ── Bookings ───────────────────────────────────────────────────
router.get('/bookings',        requireAdmin('bookings.view'), getAllBookings);
router.get('/bookings/:id/payment-events', requireAdmin('bookings.view'), getBookingPaymentEvents); // F15
router.put('/bookings/:id',    requireAdmin('bookings.edit'), updateBooking);
router.delete('/bookings/:id', requireAdmin('bookings.edit'), deleteBooking);

// ── Services ───────────────────────────────────────────────────
router.get('/services',         requireAdmin('services.view'),   getAllServices);
router.put('/services/:id/seo',  requireAdmin('services.manage'), updateServiceSeo);
router.put('/services/:id',      requireAdmin('services.manage'), updateService);
router.delete('/services/:id',  requireAdmin('services.manage'), deleteService);

// ── Provider (host) SEO — providers are users with role='host' ─
router.put('/providers/:id/seo', requireAdmin('users.edit'), updateProviderSeo);

// ── Platform settings (system) ─────────────────────────────────
router.get('/settings', requireAdmin('settings.manage'), getSettings);
router.put('/settings', requireAdmin('settings.manage'), updateSettings);

// ── Reserved namespace — L2 slug reservations (admin / premium / prefix) ──
const reservedSlugs = require('../controllers/reservedSlugAdminController');
router.get('/reserved-slugs',             requireAdmin('settings.manage'), reservedSlugs.list);
router.post('/reserved-slugs',            requireAdmin('settings.manage'), reservedSlugs.create);
router.get('/reserved-slugs/check/:slug', requireAdmin('settings.manage'), reservedSlugs.check);
router.delete('/reserved-slugs/:id',      requireAdmin('settings.manage'), reservedSlugs.release);

// ── KYC — host identity verification review ────────────────────
const kycAdmin = require('../controllers/kycAdminController');
router.get('/kyc/stats',  requireAdmin('kyc.view'),   kycAdmin.getStats);
router.get('/kyc',        requireAdmin('kyc.view'),   kycAdmin.listKyc);
router.get('/kyc/:id',    requireAdmin('kyc.view'),   kycAdmin.getKyc);
router.patch('/kyc/:id',  requireAdmin('kyc.decide'), kycAdmin.decideKyc);

// ── Appearance — navbar logo (mode + image URLs) ───────────────
const appearance = require('../controllers/appearanceController');
router.get('/appearance', requireAdmin('settings.manage'), appearance.getAdmin);
router.put('/appearance', requireAdmin('settings.manage'), appearance.update);

// ── Payment settings — Razorpay credentials (encrypted at rest) ─
const paymentSettings = require('../controllers/paymentSettingsAdminController');
router.get('/settings/payment/razorpay',       requireAdmin('settings.manage'), paymentSettings.getRazorpay);
router.put('/settings/payment/razorpay',        requireAdmin('settings.manage'), paymentSettings.updateRazorpay);
router.post('/settings/payment/razorpay/test',  requireAdmin('settings.manage'), paymentSettings.testRazorpay);

// ── Feature flags ──────────────────────────────────────────────
const features = require('../controllers/featureFlagController');
router.get('/features',        requireAdmin('settings.manage'), features.getFlags);
router.post('/features',       requireAdmin('settings.manage'), features.createFlag);
router.patch('/features/:key', requireAdmin('settings.manage'), features.toggleFlag);

// ── Staff & roles (Super Admin only) ──
// Enforced structurally with requireSuperAdmin (wildcard) rather than a
// 'staff.manage' permission string. staff CRUD can mint a 'super' account and
// reset admin passwords, so it must never become grantable to a non-super role
// by a future admin_roles DB edit — a permission-string gate would silently
// escalate that role. super still passes (it holds the wildcard).
const staff = require('../controllers/staffAdminController');
router.get('/roles',                       requireSuperAdmin, staff.listRoles);
router.get('/staff',                       requireSuperAdmin, staff.listStaff);
router.post('/staff',                      requireSuperAdmin, staff.createStaff);
router.get('/staff/:id',                   requireSuperAdmin, staff.getStaff);
router.put('/staff/:id',                   requireSuperAdmin, staff.updateStaff);
router.patch('/staff/:id/status',          requireSuperAdmin, staff.setStaffActive);
router.post('/staff/:id/reset-password',   requireSuperAdmin, staff.resetStaffPassword);

// ── Audit log viewer ───────────────────────────────────────────
const auditCtrl = require('../controllers/auditAdminController');
router.get('/audit',         requireAdmin('audit.view'), auditCtrl.listAudit);
router.get('/audit/actions', requireAdmin('audit.view'), auditCtrl.listActions);

// ── Notification system (WhatsApp / AiSensy) ───────────────────
const notif = require('../controllers/notificationAdminController');
router.get('/notifications/provider',        requireAdmin('notifications.view'), notif.getProvider);
router.put('/notifications/provider',        requireAdmin('whatsapp.manage'),    notif.updateProvider);
router.post('/notifications/provider/test',  requireAdmin('whatsapp.manage'),    notif.testProvider);
router.get('/notifications/events',          requireAdmin('notifications.view'), notif.getEvents);
router.put('/notifications/events/:id',      requireAdmin('whatsapp.manage'),    notif.updateEvent);
router.post('/notifications/test-send',      requireAdmin('whatsapp.manage'),    notif.testSend);
router.get('/notifications/logs',            requireAdmin('notifications.view'), notif.getLogs);
router.post('/notifications/logs/:id/retry', requireAdmin('whatsapp.manage'),    notif.retryLog);

// ── Reviews moderation (Support) ───────────────────────────────
const reviewsAdmin = require('../controllers/reviewAdminController');
router.get('/reviews',           requireAdmin('reviews.moderate'), reviewsAdmin.listReviews);
router.patch('/reviews/:id',     requireAdmin('reviews.moderate'), reviewsAdmin.moderateReview);
router.delete('/reviews/:id',    requireAdmin('reviews.moderate'), reviewsAdmin.deleteReview);

// ── Vendor feedback (triage) ───────────────────────────────────
const feedbackAdmin = require('../controllers/feedbackAdminController');
router.get('/feedback',         requireAdmin('feedback.view'),   feedbackAdmin.listFeedback);
router.patch('/feedback/:id',   requireAdmin('feedback.manage'), feedbackAdmin.updateFeedbackStatus);

// ── Bolt support console (knowledge gaps + FAQ layer) ──────────
const supportAdmin = require('../controllers/supportAdminController');
router.get('/support/queue',              requireAdmin('support.view'),   supportAdmin.queue);
router.get('/support/insights',           requireAdmin('support.view'),   supportAdmin.insights);
router.get('/support/reasons',            requireAdmin('support.view'),   supportAdmin.reasons);
router.get('/support/thread/:id',         requireAdmin('support.view'),   supportAdmin.getThread);
router.get('/support/thread/:id/context', requireAdmin('support.view'),   supportAdmin.threadContext);
router.post('/support/thread/:id/reply',  requireAdmin('support.assign'), supportAdmin.reply);
router.post('/support/thread/:id/assign', requireAdmin('support.assign'), supportAdmin.assign);
router.post('/support/thread/:id/resolve', requireAdmin('support.assign'), supportAdmin.resolve);

const botAdmin = require('../controllers/botAdminController');
router.get('/bot/gaps',         requireAdmin('support.view'),   botAdmin.listGaps);
router.patch('/bot/gaps/:id',   requireAdmin('support.assign'), botAdmin.updateGap);
router.get('/bot/faqs',         requireAdmin('support.view'),   botAdmin.listFaqs);
router.post('/bot/faqs',        requireAdmin('support.assign'), botAdmin.createFaq);
router.patch('/bot/faqs/:id',   requireAdmin('support.assign'), botAdmin.updateFaq);
router.delete('/bot/faqs/:id',  requireAdmin('support.assign'), botAdmin.deleteFaq);
router.get('/bot/analytics',    requireAdmin('support.view'),   botAdmin.analytics);
router.get('/bot/graph',        requireAdmin('support.view'),   botAdmin.graph);
router.get('/bot/cache',        requireAdmin('support.view'),   botAdmin.listCache);
router.delete('/bot/cache/:id', requireAdmin('support.assign'), botAdmin.deleteCache);
router.get('/bot/escalations',              requireAdmin('support.view'),   botAdmin.listEscalations);
router.get('/bot/escalations/:id',          requireAdmin('support.view'),   botAdmin.getEscalation);
router.post('/bot/escalations/:id/reply',   requireAdmin('support.assign'), botAdmin.replyEscalation);
router.patch('/bot/escalations/:id',        requireAdmin('support.assign'), botAdmin.updateEscalation);

// ── Badge system ───────────────────────────────────────────────
const badges = require('../controllers/badgeAdminController');
router.get('/badges/meta',                requireAdmin('badges.manage'), badges.getMeta);
router.post('/badges/preview',            requireAdmin('badges.manage'), badges.previewRules);
router.post('/badges/evaluate',           requireAdmin('badges.manage'), badges.runEvaluation);
router.post('/badges/evaluate/:vendorId', requireAdmin('badges.manage'), badges.runEvaluation);
router.get('/badges',                     requireAdmin('badges.manage'), badges.listBadges);
router.post('/badges',                    requireAdmin('badges.manage'), badges.createBadge);
router.get('/badges/:id',                 requireAdmin('badges.manage'), badges.getBadge);
router.put('/badges/:id',                 requireAdmin('badges.manage'), badges.updateBadge);
router.patch('/badges/:id/status',        requireAdmin('badges.manage'), badges.updateBadgeStatus);
router.get('/badges/:id/preview',         requireAdmin('badges.manage'), badges.previewBadge);
router.get('/vendors/:id/badges',         requireAdmin('badges.manage'), badges.getVendorBadges);
router.post('/vendors/:id/badges',        requireAdmin('badges.manage'), badges.assignBadge);
router.delete('/vendors/:id/badges/:badgeId', requireAdmin('badges.manage'), badges.revokeBadge);

// ── Referral program (Refer & Earn config) ────────────────────
const referralAdmin = require('../controllers/referralAdminController');
router.get('/referral-rules',       requireAdmin('referrals.view'),   referralAdmin.listRules);
router.patch('/referral-rules/:id', requireAdmin('referrals.manage'), referralAdmin.updateRule);
router.get('/referrals',            requireAdmin('referrals.view'),   referralAdmin.listReferrals);

// ── Invite links (lead-source attribution — reuses referrals.* perms) ──────────
const inviteAdmin = require('../controllers/inviteAdminController');
router.get('/invite-links',         requireAdmin('referrals.view'),   inviteAdmin.list);
router.post('/invite-links',        requireAdmin('referrals.manage'), inviteAdmin.create);
router.patch('/invite-links/:slug', requireAdmin('referrals.manage'), inviteAdmin.update);

// ── Payout approval ────────────────────────────────────────────
const payouts = require('../controllers/payoutAdminController');
router.get('/payouts/clearing',     requireAdmin('payouts.view'),    payouts.listClearing);

// ── Disputes queue + manual payout hold ────────────────────────
const disputes = require('../controllers/disputeAdminController');
router.get('/disputes',                    requireAdmin('payouts.view'),    disputes.listDisputes);
router.post('/disputes/:id/resolve',       requireAdmin('payouts.release'), disputes.resolveDispute);
router.post('/bookings/:id/reverse-payout',requireAdmin('payouts.release'), disputes.reverseBookingPayout);
router.post('/payouts/reconcile',   requireAdmin('payouts.release'), payouts.runReconcile);
router.get('/payouts',              requireAdmin('payouts.view'),    payouts.listPayouts);
router.post('/payouts/:id/approve', requireAdmin('payouts.approve'), payouts.approvePayout);
router.post('/payouts/:id/reject',  requireAdmin('payouts.approve'), payouts.rejectPayout);
router.post('/payouts/:id/pay',     requireAdmin('payouts.release'), payouts.markPayoutPaid);
router.post('/payouts/:id/pay-route', requireAdmin('payouts.release'), payouts.releasePayoutViaRoute);

// ── Subscription plans ─────────────────────────────────────────
const plans = require('../controllers/planAdminController');
router.get('/plans',                 requireAdmin('plans.view'),   plans.listPlans);
router.post('/plans',                requireAdmin('plans.manage'), plans.createPlan);
router.patch('/plans/reorder',       requireAdmin('plans.manage'), plans.reorderPlans);
router.post('/plans/assign',         requireAdmin('plans.manage'), plans.assignPlan);
router.put('/plans/:id',             requireAdmin('plans.manage'), plans.updatePlan);
router.patch('/plans/:id/archive',   requireAdmin('plans.manage'), plans.setPlanActive);
router.patch('/plans/:id/restore',   requireAdmin('plans.manage'), plans.setPlanActive);
router.post('/plans/:id/clone',      requireAdmin('plans.manage'), plans.clonePlan);

// ── Categories / professions registry ──────────────────────────
const categories = require('../controllers/categoryController');
router.get('/categories',        requireAdmin('settings.manage'), categories.adminList);
router.post('/categories',       requireAdmin('settings.manage'), categories.adminCreate);
router.put('/categories/:id',    requireAdmin('settings.manage'), categories.adminUpdate);
router.delete('/categories/:id', requireAdmin('settings.manage'), categories.adminDelete);

// ── Email Communication Engine ─────────────────────────────────
const email = require('../controllers/emailAdminController');
router.get('/email/templates',                requireAdmin('email.manage'), email.listTemplates);
router.post('/email/templates',               requireAdmin('email.manage'), email.createTemplate);
router.get('/email/templates/:id',            requireAdmin('email.manage'), email.getTemplate);
router.put('/email/templates/:id',            requireAdmin('email.manage'), email.updateTemplate);
router.post('/email/templates/:id/duplicate', requireAdmin('email.manage'), email.duplicateTemplate);
router.patch('/email/templates/:id/archive',  requireAdmin('email.manage'), email.archiveTemplate);
router.post('/email/templates/:id/preview',   requireAdmin('email.manage'), email.previewTemplate);
router.post('/email/templates/:id/test',      requireAdmin('email.manage'), email.testTemplate);
router.post('/email/test-provider',           requireAdmin('email.manage'), email.testProvider);
router.get('/email/logs',                     requireAdmin('email.manage'), email.listLogs);
router.get('/email/logs/:id',                 requireAdmin('email.manage'), email.getLog);
router.post('/email/logs/:id/retry',          requireAdmin('email.manage'), email.retryLog);
router.get('/email/settings',                 requireAdmin('email.manage'), email.getSettings);
router.put('/email/settings',                 requireAdmin('email.manage'), email.updateSettings);
router.get('/email/events',                   requireAdmin('email.manage'), email.listEvents);

// ── Campaigns (Phase 1: email) ─────────────────────────────────
// Static sub-paths (contacts, segments) are registered BEFORE '/campaigns/:id'
// so Express does not match them as an :id param.
const campaigns = require('../controllers/campaignAdminController');
router.get('/campaigns/contacts',          requireAdmin('campaigns.view'),   campaigns.listContacts);
router.post('/campaigns/contacts/sync',    requireAdmin('campaigns.manage'), campaigns.syncContacts);
router.patch('/campaigns/contacts/:id',    requireAdmin('campaigns.manage'), campaigns.suppressContact);
router.get('/campaigns/segments',          requireAdmin('campaigns.view'),   campaigns.listSegments);
router.post('/campaigns/segments/preview', requireAdmin('campaigns.view'),   campaigns.previewSegment);
router.post('/campaigns/segments',         requireAdmin('campaigns.manage'), campaigns.createSegment);
router.post('/campaigns/audience/resolve', requireAdmin('campaigns.view'),   campaigns.resolveAudience);
router.post('/campaigns/test',             requireAdmin('campaigns.manage'), campaigns.testCampaign);
router.get('/campaigns/wa-templates',      requireAdmin('campaigns.view'),   campaigns.listWaTemplates);
router.post('/campaigns/wa-templates',     requireAdmin('campaigns.manage'), campaigns.createWaTemplate);
router.put('/campaigns/wa-templates/:id',  requireAdmin('campaigns.manage'), campaigns.updateWaTemplate);
router.post('/campaigns/preview',          requireAdmin('campaigns.view'),   campaigns.previewCampaign);
router.get('/campaigns',                   requireAdmin('campaigns.view'),   campaigns.listCampaigns);
router.post('/campaigns',                  requireAdmin('campaigns.manage'), campaigns.createCampaign);
router.get('/campaigns/:id',               requireAdmin('campaigns.view'),   campaigns.getCampaign);
router.get('/campaigns/:id/recipients',    requireAdmin('campaigns.view'),   campaigns.campaignRecipients);
router.put('/campaigns/:id',               requireAdmin('campaigns.manage'), campaigns.updateCampaign);
router.post('/campaigns/:id/launch',       requireAdmin('campaigns.manage'), campaigns.launchCampaign);

// ── Financial ledger (P1) ──────────────────────────────────────
const finance = require('../controllers/financeAdminController');
router.get('/finance/summary',            requireAdmin('finance.view'),   finance.getSummary);
router.get('/finance/accounts',           requireAdmin('finance.view'),   finance.getAccounts);
router.get('/finance/journals',           requireAdmin('finance.view'),   finance.listJournals);
router.get('/finance/journals/:id',       requireAdmin('finance.view'),   finance.getJournal);
router.get('/finance/ledger/:accountId',  requireAdmin('finance.view'),   finance.getLedger);
router.post('/finance/adjustment',        requireAdmin('finance.manage'), finance.postAdjustment);
router.post('/finance/reversal',          requireAdmin('finance.manage'), finance.postReversal);
router.post('/finance/bank-transfer',     requireAdmin('finance.manage'), finance.postBankTransfer);
router.post('/finance/refund',            requireAdmin('finance.manage'), finance.postRefund);
router.post('/finance/refund/execute',    requireAdmin('finance.manage'), finance.executeRefund);
router.post('/finance/resend-subscription-receipt', requireAdmin('finance.manage'), finance.resendSubscriptionReceipt);


// ── Explore Page Revenue Management ───────────────────────────
const explore = require('../controllers/exploreController');
// Featured slots
router.get('/explore/featured',                             requireAdmin('settings.manage'), explore.adminListFeatured);
router.post('/explore/featured',                            requireAdmin('settings.manage'), explore.adminCreateFeatured);
router.put('/explore/featured/:id',                         requireAdmin('settings.manage'), explore.adminUpdateFeatured);
router.delete('/explore/featured/:id',                      requireAdmin('settings.manage'), explore.adminDeleteFeatured);
// Collections
router.get('/explore/collections',                          requireAdmin('settings.manage'), explore.adminListCollections);
router.post('/explore/collections',                         requireAdmin('settings.manage'), explore.adminCreateCollection);
router.put('/explore/collections/:id',                      requireAdmin('settings.manage'), explore.adminUpdateCollection);
router.post('/explore/collections/:id/vendors',             requireAdmin('settings.manage'), explore.adminAddToCollection);
router.delete('/explore/collections/:id/vendors/:vendorId', requireAdmin('settings.manage'), explore.adminRemoveFromCollection);
// Boosts
router.get('/explore/boosts',                               requireAdmin('settings.manage'), explore.adminListBoosts);
router.post('/explore/boosts',                              requireAdmin('settings.manage'), explore.adminCreateBoost);
router.delete('/explore/boosts/:id',                        requireAdmin('settings.manage'), explore.adminRevokeBoost);
// Verified badges
router.get('/explore/verified',                             requireAdmin('settings.manage'), explore.adminListVerified);
router.post('/explore/verified',                            requireAdmin('settings.manage'), explore.adminGrantVerified);
router.delete('/explore/verified/:id',                      requireAdmin('settings.manage'), explore.adminRevokeVerified);
// Sponsored keywords
router.get('/explore/keywords',                             requireAdmin('settings.manage'), explore.adminListKeywords);
router.post('/explore/keywords',                            requireAdmin('settings.manage'), explore.adminCreateKeyword);
router.delete('/explore/keywords/:id',                      requireAdmin('settings.manage'), explore.adminRevokeKeyword);

module.exports = router;

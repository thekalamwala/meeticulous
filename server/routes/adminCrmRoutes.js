'use strict';
/**
 * adminCrmRoutes.js — Admin Sales CRM (/api/admin/crm).
 *
 * Mounted under adminLimiter in server.js. Read routes require `leads.view`;
 * every mutation, send, import and bulk op requires `leads.manage`. Sends are
 * additionally gated at runtime by the `crm_admin_sends` kill-switch (default
 * OFF) inside MessageService.
 */
const express = require('express');
const { requireAdmin } = require('../middleware/adminMiddleware');
const c = require('../controllers/adminCrmController');

const router = express.Router();
const view = requireAdmin('leads.view');
const manage = requireAdmin('leads.manage');

// Dashboard
router.get('/dashboard', view, c.dashboard);
router.get('/pipeline', view, c.pipeline);
router.get('/reports', view, c.reports); // attribution + funnel + timing analytics
router.get('/desk', view, c.getDesk); // Sales Desk: five auto-populated queues

// Follow-ups (collection-level) + sequences list
router.get('/follow-ups', view, c.listFollowUps);
router.post('/follow-ups/:id/complete', manage, c.completeFollowUp);
router.post('/follow-ups/:id/cancel', manage, c.cancelFollowUp);
router.get('/sequences', view, c.listSequences);
router.post('/sequences', manage, c.createSequence);

// Saved views (shared team lenses)
router.get('/views', view, c.listViews);
router.post('/views', manage, c.createView);
router.delete('/views/:id', manage, c.deleteView);

// Tag catalog (coloured tags)
router.get('/tags', view, c.listTags);
router.post('/tags', manage, c.createTag);
router.patch('/tags/:id', manage, c.updateTag);
router.delete('/tags/:id', manage, c.deleteTag);

// Message templates (approved WhatsApp + reusable email)
router.get('/templates', view, c.listTemplates);
router.post('/templates', manage, c.createTemplate);
router.patch('/templates/:id', manage, c.updateTemplate);
router.delete('/templates/:id', manage, c.deleteTemplate);

// Import / export / bulk / attribution
router.post('/import/preview', manage, c.importPreview);
router.post('/import/commit', manage, c.importCommit);
router.get('/leads/export.csv', view, c.exportCsv);
router.post('/leads/bulk', manage, c.bulk);
router.post('/attribution/refresh', manage, c.refreshAttribution);

// Lists (cold contact pools)
router.get('/lists', view, c.listLists);
router.post('/lists', manage, c.createList);
router.get('/lists/:id', view, c.getListById);

// Leads
router.get('/leads', view, c.listLeads);
router.post('/leads', manage, c.createLead);
router.get('/leads/:id', view, c.getLead);
router.patch('/leads/:id', manage, c.updateLead);
router.get('/leads/:id/timeline', view, c.getTimeline);
router.get('/leads/:id/messages', view, c.leadMessages);

// Lead actions
router.post('/leads/:id/status', manage, c.setStatus);
router.post('/leads/:id/owner', manage, c.setOwner);
router.post('/leads/:id/merge', manage, c.mergeLead);
router.post('/leads/:id/tags', manage, c.addTag);
router.delete('/leads/:id/tags/:tag', manage, c.removeTag);
router.post('/leads/:id/dnc', manage, c.setDnc);
router.post('/leads/:id/notes', manage, c.addNote);
router.post('/leads/:id/call', manage, c.logCall);
router.post('/leads/:id/whatsapp', manage, c.sendWhatsApp);
router.post('/leads/:id/email', manage, c.sendEmail);
router.post('/leads/:id/follow-ups', manage, c.createFollowUp);
router.post('/leads/:id/enroll', manage, c.enroll);

// Relationship Desk — "who to talk to today" (open recs ranked by priority + health).
router.get('/recommendations', view, c.getRelationships);
// Relationship touch recommendations — act on a rec (done records the touch + closes it).
router.post('/recommendations/:id/done', manage, c.completeRecommendation);
router.post('/recommendations/:id/snooze', manage, c.snoozeRecommendation);
router.post('/recommendations/:id/dismiss', manage, c.dismissRecommendation);

// Cold Calling — call queue, outcomes (+ one-click follow-ups), reminders.
router.get('/cold-calls/queue', view, c.coldCallQueue);
router.get('/cold-calls/stats', view, c.coldCallStats);
router.get('/cold-calls/follow-ups', view, c.coldCallFollowUps);
router.get('/cold-calls/history', view, c.coldCallHistory);
router.get('/cold-calls/reports', view, c.coldCallReports);
router.get('/cold-calls/search', view, c.coldCallSearch);
router.post('/cold-calls/import', manage, c.coldCallImport);
router.post('/cold-calls/:leadId/outcome', manage, c.coldCallOutcome);
router.post('/cold-calls/:leadId/send', manage, c.coldCallSend);
router.post('/cold-calls/:leadId/details', manage, c.coldCallDetails);
router.post('/cold-calls/:leadId/remind', manage, c.coldCallRemind);
router.post('/cold-calls/:leadId/follow-up', manage, c.coldCallSetFollowUp);

module.exports = router;

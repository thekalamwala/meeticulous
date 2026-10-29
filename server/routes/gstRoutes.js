'use strict';
/**
 * gstRoutes.js — GST command center, mounted at /api/admin/gst (see adminRoutes).
 * Every route is gated by the admin RBAC middleware with a gst.* permission.
 * Reads need gst.view; workflow writes need gst.manage / gst.returns.*; export
 * generation needs gst.export. Reconciliation view needs gst.reconcile.
 */
const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../middleware/adminMiddleware');
const c = require('../controllers/gstAdminController');

// Overview + registers
router.get('/overview', requireAdmin('gst.view'), c.getOverview);
router.get('/transactions', requireAdmin('gst.view'), c.getTransactions);
router.get('/invoices', requireAdmin('gst.view'), c.listInvoices);
router.get('/invoices/:id', requireAdmin('gst.view'), c.getInvoiceDetail);
router.get('/invoices/:id/download', requireAdmin('gst.view'), c.downloadInvoice);

// Action center
router.get('/issues', requireAdmin('gst.view'), c.getIssues);
router.post('/issues/status', requireAdmin('gst.manage'), c.setIssueStatus);

// Reconciliation + ITC
router.get('/reconciliation', requireAdmin('gst.reconcile'), c.getReconciliation);
router.get('/itc', requireAdmin('gst.view'), c.getItc);

// Returns
router.get('/returns', requireAdmin('gst.view'), c.getReturns);
router.post('/returns/status', requireAdmin('gst.returns_prepare'), c.setReturnStatus);

// Reports + exports + settings
router.get('/reports/:type', requireAdmin('gst.view'), c.getReport);
router.get('/exports', requireAdmin('gst.view'), c.listExports);
router.post('/exports', requireAdmin('gst.export'), c.createExport);
router.get('/exports/:id/download', requireAdmin('gst.export'), c.downloadExport);
router.get('/settings', requireAdmin('gst.view'), c.getSettings);

module.exports = router;

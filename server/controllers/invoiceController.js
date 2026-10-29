'use strict';
const { supabaseAdmin } = require('../config/supabase');
const { buildTaxInvoiceHTML } = require('../services/invoiceHtml');

// Public, token-gated: the invoice's unguessable access_token authorises viewing
// (same model as product download tokens) so the emailed link works without login.
async function getInvoice(req, res) {
  try {
    const { id } = req.params;
    const token = req.query.token;
    const { data: inv } = await supabaseAdmin
      .from('invoices').select('*').eq('id', id).maybeSingle();
    if (!inv) return res.status(404).send('Invoice not found');
    if (!token || token !== inv.access_token) return res.status(403).send('Not authorized');
    res.set('Content-Type', 'text/html; charset=utf-8').send(buildTaxInvoiceHTML(inv));
  } catch (e) {
    res.status(500).send('Could not render invoice');
  }
}

// GET /api/invoices/booking/:bookingId/view — OWNER-GATED invoice view for the
// guest dashboard. Unlike the token link, this requires a session and checks the
// booking belongs to the caller, so it is NOT shareable — opening it needs to be
// logged in as the buyer. (The emailed token link stays for guests without an
// account.) Fetched with the Bearer token and shown as a local blob by the client.
async function viewBookingInvoice(req, res) {
  try {
    const { bookingId } = req.params;
    const uid = req.user.id;
    const { data: bk } = await supabaseAdmin
      .from('bookings').select('id, guest_id').eq('id', bookingId).maybeSingle();
    if (!bk) return res.status(404).send('Booking not found');
    if (bk.guest_id !== uid) return res.status(403).send('Not authorized');
    const { data: inv } = await supabaseAdmin
      .from('invoices').select('*').eq('source_type', 'booking').eq('source_id', bookingId).maybeSingle();
    if (!inv) return res.status(404).send('Invoice not available yet');
    res.set('Content-Type', 'text/html; charset=utf-8').send(buildTaxInvoiceHTML(inv));
  } catch (e) {
    res.status(500).send('Could not render invoice');
  }
}

// GET /api/invoices/mine — the logged-in host's own invoices (subscriptions +
// bookings they were billed for). Buyer identity is the session user.
async function listMyInvoices(req, res) {
  try {
    const uid = req.user.id;
    // subscription invoices: source_id -> subscription_payments of this vendor
    const { data: subPays } = await supabaseAdmin
      .from('subscription_payments').select('id').eq('vendor_id', uid);
    const subIds = (subPays || []).map((r) => r.id);
    // booking invoices where this user was the guest
    const { data: bks } = await supabaseAdmin
      .from('bookings').select('id').eq('guest_id', uid);
    const bkIds = (bks || []).map((r) => r.id);
    const ids = [...subIds, ...bkIds];
    if (!ids.length) return res.json([]);
    // Type-scope to the caller's OWN documents. A commission invoice shares its
    // source_id with the guest's booking (buyer = the HOST), so filtering on
    // source_id alone would leak the host's commission invoice — and its
    // access_token, which unlocks the full PDF — into the guest's list. The
    // buyer only ever owns 'booking' (as guest) and 'subscription' (as vendor).
    const { data: invs } = await supabaseAdmin
      .from('invoices')
      .select('id, invoice_number, total, issued_at, access_token, source_type')
      .in('source_id', ids)
      .in('source_type', ['booking', 'subscription'])
      .order('issued_at', { ascending: false });
    res.json(invs || []);
  } catch (e) {
    res.status(500).json({ message: 'Could not load invoices' });
  }
}

module.exports = { getInvoice, listMyInvoices, viewBookingInvoice };

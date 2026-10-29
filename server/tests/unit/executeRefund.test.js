// Unit tests for financeAdminController.executeRefund. The refund itself now lives
// in the shared refundService (issueBookingRefund, tested in refundService.test.js);
// this endpoint only maps the issuer's result to admin-facing HTTP + audit, so
// that mapping is what these tests pin.

jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: jest.fn() } }));
jest.mock('../../services/auditService', () => ({ audit: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../services/ledger/journalTemplates', () => ({
  adjustmentEntry: jest.fn(), reversalEntry: jest.fn(), bankTransferEntry: jest.fn(),
}));
jest.mock('../../services/ledger/postingService', () => ({ post: jest.fn().mockResolvedValue('je-1') }));
jest.mock('../../services/bookingCapture', () => ({ recordBookingRefund: jest.fn() }));
jest.mock('../../services/refundService', () => ({ issueBookingRefund: jest.fn() }));
jest.mock('../../utils/httpError', () => ({ safeError: (res, e) => res.status(500).json({ message: e.message }) }));

const { audit } = require('../../services/auditService');
const { issueBookingRefund } = require('../../services/refundService');
const { executeRefund } = require('../../controllers/financeAdminController');

const mkRes = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn() });
beforeEach(() => jest.clearAllMocks());

test('400 without a booking_id — no refund attempted', async () => {
  const res = mkRes();
  await executeRefund({ body: {} }, res);
  expect(res.status).toHaveBeenCalledWith(400);
  expect(issueBookingRefund).not.toHaveBeenCalled();
});

test('passes the admin email + mode through to the issuer, returns 200 + audits', async () => {
  issueBookingRefund.mockResolvedValue({ ok: true, amount: 500, refundId: 'rfnd_1', paymentStatus: 'paid', transferReversed: true, ledgerPosted: true });
  const res = mkRes();
  await executeRefund({ body: { booking_id: 'b1', mode: 'tiered' }, admin: { email: 'ops@x.com' } }, res);
  expect(issueBookingRefund).toHaveBeenCalledWith(expect.objectContaining({ bookingId: 'b1', mode: 'tiered', actorEmail: 'ops@x.com' }));
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true, refund_id: 'rfnd_1', amount: 500, payment_status: 'paid' }));
  expect(audit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'FINANCE_REFUND_EXECUTED' }));
});

test('a full refund surfaces payment_status=refunded from the issuer', async () => {
  issueBookingRefund.mockResolvedValue({ ok: true, amount: 590, refundId: 'rfnd_2', paymentStatus: 'refunded', transferReversed: true, ledgerPosted: true });
  const res = mkRes();
  await executeRefund({ body: { booking_id: 'b1', mode: 'full' } }, res);
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true, amount: 590, payment_status: 'refunded' }));
});

test('settled payout → 409 + a FINANCE_REFUND_BLOCKED audit', async () => {
  issueBookingRefund.mockResolvedValue({ ok: false, blocked: 'payout_settled' });
  const res = mkRes();
  await executeRefund({ body: { booking_id: 'b1', mode: 'full' } }, res);
  expect(res.status).toHaveBeenCalledWith(409);
  expect(audit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'FINANCE_REFUND_BLOCKED' }));
});

test('already refunded → 409', async () => {
  issueBookingRefund.mockResolvedValue({ ok: false, reason: 'already_refunded', amount: 100 });
  const res = mkRes();
  await executeRefund({ body: { booking_id: 'b1', mode: 'tiered' } }, res);
  expect(res.status).toHaveBeenCalledWith(409);
});

test('inside the no-refund window → 400', async () => {
  issueBookingRefund.mockResolvedValue({ ok: false, reason: 'not_eligible' });
  const res = mkRes();
  await executeRefund({ body: { booking_id: 'b1', mode: 'tiered' } }, res);
  expect(res.status).toHaveBeenCalledWith(400);
});

test('unknown booking → 404', async () => {
  issueBookingRefund.mockResolvedValue({ ok: false, reason: 'booking_not_found' });
  const res = mkRes();
  await executeRefund({ body: { booking_id: 'nope', mode: 'tiered' } }, res);
  expect(res.status).toHaveBeenCalledWith(404);
});

test('not paid → 400', async () => {
  issueBookingRefund.mockResolvedValue({ ok: false, reason: 'not_paid' });
  const res = mkRes();
  await executeRefund({ body: { booking_id: 'b1', mode: 'tiered' } }, res);
  expect(res.status).toHaveBeenCalledWith(400);
});

# Admin Payout Approval — Design Spec

_Date: 2026-06-15_
_Status: approved, ready for implementation plan_

## Problem

Vendors can request payouts ([client/src/pages/Payouts.jsx](../../../client/src/pages/Payouts.jsx) → `POST /api/vendor/payout/request`), but admins have **no way to act on those requests**:

- Admin permissions `payouts.view / payouts.approve / payouts.release` exist in [server/lib/adminPermissions.js](../../../server/lib/adminPermissions.js) and are granted to the finance role, but **no routes, controller, or UI implement them**.
- The ops summary deep-links to `/admin/finance/payouts?status=pending`, but that route does not exist — the real route `/admin/finance/earnings` renders an **empty `AdminEarnings` shell**.
- Approving a payout has **no tie to the financial ledger**: the per-booking Vendor Payables (account 2000) credited at order payment is never relieved.

This spec covers a **pragmatic manual** workflow: an admin authorizes a request, sends money manually (bank / Razorpay dashboard), then records the payment reference. No automated disbursement, no settlement engine.

## Scope decisions (confirmed)

- **Workflow depth:** pragmatic manual (not minimal, not full P2 settlement engine).
- **Disbursement:** manual + record reference. No Razorpay Payout/Route API integration.

## Status model

```
pending ──approve──▶ approved ──pay──▶ paid   (terminal)
   │
   └────reject────▶ rejected               (terminal)
```

- **approve** — authorization only. No money moved, no ledger entry. `pending → approved`.
- **mark paid** — requires `payment_reference`. Posts the ledger entry. `approved → paid`. Stamps `paid_at`, `paid_by`.
- **reject** — requires a reason (stored in existing `admin_note`). Frees the reserved balance. `pending → rejected`.

Only these transitions are valid; any other transition (e.g. pay a `pending`, approve a `paid`) is rejected with 409.

## Database

Migration `server/migrations/v3.8_payout_approval.sql`, ALTER existing `payout_requests`:

Current schema (from `v1.4.sql`): `id, host_id, amount NUMERIC(10,2), notes TEXT, status TEXT CHECK(pending|approved|rejected), admin_note TEXT, created_at, updated_at`.

Changes:
- Drop + recreate the status CHECK to include `'paid'`: `CHECK (status IN ('pending','approved','rejected','paid'))`.
- Add columns:
  - `approved_by UUID` — admin_users.id of approver (no FK, loose coupling)
  - `approved_at TIMESTAMPTZ`
  - `paid_by UUID` — admin_users.id of releaser
  - `paid_at TIMESTAMPTZ`
  - `payment_reference TEXT` — UTR / bank txn id, required at mark-paid
  - `rejected_at TIMESTAMPTZ`
- RLS unchanged (admin acts via service-role `supabaseAdmin`, which bypasses RLS).

Reject reason reuses the existing `admin_note` column — no new column.

## Balance semantics

[server/controllers/vendorController.js](../../../server/controllers/vendorController.js):

- `getPayoutBalance` (~line 80): `totalWithdrawn` currently filters `status === 'approved'` only. **Must also include `'paid'`** — otherwise a paid payout disappears from the withdrawn total and `available` inflates (lets a vendor double-withdraw). New: `available = totalEarned − (pending + approved + paid)`.
- `requestPayout` (~line 143): `alreadyClaimed` currently counts `approved + pending`. **Add `paid`** for the same reason.

Reserve-on-request behavior is preserved (a `pending` request already reduces available).

## Ledger integration

New pure template in [server/services/ledger/journalTemplates.js](../../../server/services/ledger/journalTemplates.js):

```js
/** PAYOUT — relieve Vendor Payables when cash is sent to the vendor. */
function payoutEntry({ host_id, amount, reference }) {
  const tags = { vendor_id: host_id };
  return {
    description: `Vendor payout ${reference || ''}`.trim(),
    lines: [
      line(ACCOUNTS.VENDOR_PAYABLES, 'debit', amount, tags),
      line(ACCOUNTS.BANK, 'credit', amount, tags),
    ],
  };
}
```

- Posted via `post()` (throwing) **before** the status update, on mark-paid. The reconciler only self-heals ORDER_PAYMENT/SUBSCRIPTION_PAYMENT, so `postSafe` would silently lose a payout miss — therefore post first; if it throws, the row stays `approved` and the admin retries (safe, idempotent). Only after a successful post does the row flip to `paid`.
- `sourceType = 'SETTLEMENT'` (a vendor payout is a settlement; `'PAYOUT'` is not in the `journal_entries.source_type` CHECK, `'SETTLEMENT'` is — no constraint change). `sourceId = payout_request.id` → idempotent on the RPC's `UNIQUE(source_type, source_id)`, so a retry posts nothing new.
- `journalDate` = the paid date.
- Mirrors the `backfillLedger.js` section-3 payout shape and `bankTransferEntry`.

This relieves the Vendor Payables credited per booking at order payment, keeping the ledger truthful (Vendor Payables balance = unpaid vendor money).

## Server API

New `server/controllers/payoutAdminController.js`, mounted under the admin router with per-route `requireAdmin(permission)`:

| Method | Route | Perm | Behavior |
|---|---|---|---|
| GET | `/api/admin/payouts?status=` | `payouts.view` | List payout requests (optional status filter), joined with `profiles` for vendor name/username/email. Newest first. |
| POST | `/api/admin/payouts/:id/approve` | `payouts.approve` | Guard `status === 'pending'`. Set `approved`, `approved_by`, `approved_at`. Audit. |
| POST | `/api/admin/payouts/:id/reject` | `payouts.approve` | Body `{ reason }` (required). Guard `status === 'pending'`. Set `rejected`, `admin_note = reason`, `rejected_at`. Audit. |
| POST | `/api/admin/payouts/:id/pay` | `payouts.release` | Body `{ payment_reference }` (required). Guard `status === 'approved'`. Set `paid`, `payment_reference`, `paid_by`, `paid_at`. Post PAYOUT ledger entry (`postSafe`). Audit. |

- Actor id comes from `req.admin` (set by the admin auth middleware from the admin JWT).
- Invalid transitions → 409 with a clear message.
- Each mutation calls `auditService.audit()` (matches the existing destructive-mutation pattern).

## Client

- [client/src/services/api.js](../../../client/src/services/api.js): add `adminGetPayouts(status)`, `adminApprovePayout(id)`, `adminRejectPayout(id, reason)`, `adminMarkPayoutPaid(id, reference)`.
- New `client/src/pages/admin/AdminPayouts.jsx` at `/admin/finance/payouts`:
  - Status tabs: Pending · Approved · Paid · Rejected · All (Pending default).
  - Rows: vendor (name + @username) · amount · requested date · status chip · actions.
  - Actions by status: `pending` → Approve (confirm) + Reject (reason modal); `approved` → Mark Paid (reference-input modal); `paid` → show reference; `rejected` → show reason.
  - Follow the existing admin page conventions (see `AdminBookings.jsx` for table/modal/toast patterns).
- Route + nav fix: repoint the sidebar "Provider Earnings" item ([AdminLayout.jsx:149](../../../client/src/components/common/AdminLayout.jsx)) and route ([App.jsx:241](../../../client/src/App.jsx)) from the empty `/admin/finance/earnings` shell to **"Payouts" at `/admin/finance/payouts`** with perm `payouts.view`. Retire the `AdminEarnings` shell. This fixes the broken ops deep-link.

## Tests (server)

`server/tests/` for `payoutAdminController`:
- approve happy path (`pending → approved`, stamps approver).
- reject requires a reason (400 without), `pending → rejected`, frees balance.
- pay requires `payment_reference` (400 without), `approved → paid`, posts exactly **one** PAYOUT journal entry, idempotent on retry (no second entry).
- invalid transitions rejected (pay a `pending`, approve a `paid`) → 409.
- permission guards (missing perm → 403).
- balance: a `paid` payout is included in withdrawn (available does not inflate).

## Out of scope (explicit)

Holds / freezes, scheduled weekly batches, two-person (maker-checker) principle, automated Razorpay Payout/Route disbursement, vendor bank-account capture, partial payouts. These belong to the deferred ledger P2 settlement engine.

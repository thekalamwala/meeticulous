/**
 * ledgerAccounts.js — account CODE constants, mirrors the v2.8 seed.
 * Codes (not uuids) cross the JS↔SQL boundary; the RPC resolves code → id.
 */
'use strict';

// Owner of each account (full legend + worked examples in journalTemplates.js
// header and docs/ledger.md). BAS = Book A Sloth. "Host pass-through" = the
// host's money we merely hold and owe on; "Government payable" = GST/TDS/TCS we
// collect and remit, never revenue.
const ACCOUNTS = Object.freeze({
  BANK:                 '1000',   // BAS asset            — cash in bank
  RAZORPAY_RECEIVABLE:  '1100',   // BAS asset            — collected by Razorpay, not yet settled
  VENDOR_PAYABLES:      '2000',   // Host pass-through    — host's net payout we owe the host
  GST_PAYABLE:          '2100',   // Government payable   — GST collected, owed to govt
  REFUND_LIABILITY:     '2200',   // BAS liability        — refund owed, not yet paid
  TDS_PAYABLE:          '2300',   // Government payable   — 194-O income-tax withheld from host (v4)
  TCS_PAYABLE:          '2400',   // Government payable   — GST Sec 52 collected from host (v4)
  PLATFORM_FEE_REVENUE: '4000',   // BAS revenue          — booking fee, ex-GST
  COMMISSION_REVENUE:   '4100',   // BAS revenue          — commission, ex-GST
  SUBSCRIPTION_REVENUE: '4200',   // BAS revenue          — host plan fee, ex-GST
  RZP_CHARGES_ORDERS:   '5000',   // Razorpay cost        — booking MDR, HOST-borne (nets to 0)
  RZP_CHARGES_SUBS:     '5100',   // Razorpay cost        — subscription MDR, BAS-borne (real expense)
  SETTLEMENT_CHARGES:   '5200',   // Razorpay cost        — payout/settlement fees, BAS-borne
  REFUND_LOSSES:        '5300',   // BAS cost             — refund money BAS eats (non-recoverable MDR)
  REFERRAL_EXPENSE:     '5400',   // BAS cost             — host referral reward, marketing spend
});

module.exports = { ACCOUNTS };

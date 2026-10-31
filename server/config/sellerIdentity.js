'use strict';
// Fixed legal identity of the invoicing entity. Env overrides let ops change a
// value without a code edit; the defaults are the registered facts.
// ponytail: config module, promote to admin-editable DB row only if GSTIN/address
// must change without a deploy.
const env = process.env;

// ===========================================================================
// TODO(pre-deploy) — GST / legal entity migration to Rajmudra Media LLP.
// The brand is now Meeticulous, but the INVOICING ENTITY below is still the
// old registered entity (Timewheel Internet Private Limited). Every field in
// this block — legalName, gstin, pan, cin, stateCode/stateName, address,
// email, phone, website, shortName, brandSubline — AND the BAS-* invoice
// SERIES prefixes are the registered legal facts stamped on GST tax invoices.
// DO NOT ship Meeticulous invoices until the founder supplies Rajmudra Media
// LLP's registered facts (GSTIN, PAN, LLPIN/CIN, state, address, contact).
// These are env-overridable, so prod can also be flipped via SELLER_* env vars
// at deploy without a code change. Blocker tracked in docs/current-work.md.
// Only brandName + logoUrl (product display, not legal) are changed now.
// ===========================================================================
const seller = {
  legalName: env.SELLER_LEGAL_NAME || 'Timewheel Internet Private Limited',
  gstin:     env.SELLER_GSTIN      || '21AAMCT8270C1ZF',
  pan:       env.SELLER_PAN        || 'AAMCT8270C',
  cin:       env.SELLER_CIN        || 'U62012OD2026PTC052654',
  stateCode: env.SELLER_STATE_CODE || '21',
  stateName: env.SELLER_STATE      || 'Odisha',
  // Address updated 2026-10-31 (owner request) to the Eureka CoWorking office.
  // stateCode/stateName above still follow the GSTIN (Odisha 21) — they drive the
  // CGST/SGST vs IGST split, so they change only with the GST registration.
  address:   env.SELLER_ADDRESS    || 'Eureka CoWorking, 2nd & 4th floor, 11, Friends Colony, Mate Square, Pratap Nagar Rd, P & T Colony, Kotwal Nagar, Pratap Nagar, Nagpur, Maharashtra 440022, India',
  email:     env.SELLER_EMAIL      || 'team@timewheel.co.in',
  phone:     env.SELLER_PHONE      || '+91 8637758344',
  website:   env.SELLER_WEBSITE    || 'timewheel.co.in',
  // Short display name for the invoice header (legalName stays the full registered
  // name used in the From block + legalese).
  shortName: env.SELLER_SHORT_NAME || 'Timewheel Internet Pvt. Ltd.',
  brandName: 'Meeticulous',
  // TODO(pre-deploy): subline names the legal entity — flip with the GST migration.
  brandSubline: 'by Timewheel Internet (P) Ltd',
  // Hosted on the site (client/public/images/email → meeticulous.com via Vercel).
  logoUrl:   'https://meeticulous.com/images/email/meeticulous-wordmark-full-color.png',
};

// SAC code — CA-confirmed 998314 (IT design & development services). Used for
// both series until told otherwise; env-overridable per series if they ever diverge.
const SAC_SUBSCRIPTION = env.SAC_SUBSCRIPTION || '998314';
const SAC_BOOKING      = env.SAC_BOOKING      || '998314';
// Commission = platform's facilitation service TO the host. Classified under the
// same platform IT code (998314) for consistency; all platform revenue is 18%.
// NOTE: 998311's official text is "management consulting" and does NOT describe a
// commission — do not use it. Override to 996211 (retail-trade commission-agent
// code) via env if the CA prefers the literal commission-agent character.
const SAC_COMMISSION   = env.SAC_COMMISSION   || '998314';
// Reschedule fee = the same booking-facilitation supply as the booking fee, so
// it shares 998314. It gets its OWN series rather than riding BAS-BKG: a single
// booking can carry both a booking-fee invoice and a reschedule-fee invoice, and
// two BAS-BKG numbers against one booking is needlessly confusing to audit.
const SAC_RESCHEDULE   = env.SAC_RESCHEDULE   || '998314';
// Digital product = the same platform booking/facilitation supply as a booking fee,
// so it shares 998314. Own series (BAS-PRD) so a product's fee invoice is distinct.
const SAC_PRODUCT      = env.SAC_PRODUCT      || '998314';

const SERIES = {
  subscription: { code: 'SUB', prefix: 'BAS-SUB' },
  booking:      { code: 'BKG', prefix: 'BAS-BKG' },
  commission:   { code: 'COM', prefix: 'BAS-COM' },  // v4: BAS → host commission invoice
  reschedule:   { code: 'RSF', prefix: 'BAS-RSF' },  // guest-paid reschedule fee
  product:      { code: 'PRD', prefix: 'BAS-PRD' },  // digital-product platform fee
};

module.exports = { seller, SAC_SUBSCRIPTION, SAC_BOOKING, SAC_COMMISSION, SAC_RESCHEDULE, SAC_PRODUCT, SERIES };

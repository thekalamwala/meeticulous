import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Host dashboard brand drift guard (P3 of the makeover — docs/host-dashboard-makeover.md).
 *
 * The host dashboard reads as one brand system. Keep it that way: no cold Tailwind
 * grays (the kit uses the warm `neutral-*` ramp), no gradient utilities, no
 * off-palette color classes. This guards the whole surface in one place so a new
 * page — or an edit to an old one — can't quietly reintroduce the drift the
 * makeover removed.
 *
 * To add a page: drop its path in PAGES. Keep it passing.
 */

// Host surfaces routed through DashboardWrapper (+ the public service pages
// cleaned in P2). All verified clean at the time of writing.
const PAGES = [
  'pages/Dashboard.jsx',
  'pages/Bookings.jsx',
  'pages/ClientsList.jsx',
  'pages/ClientDetail.jsx',
  'pages/Earnings.jsx',
  'pages/Availability.jsx',
  'pages/Products.jsx',
  'pages/Payouts.jsx',
  'pages/Transactions.jsx',
  'pages/Invoices.jsx',
  'pages/ReferEarn.jsx',
  'pages/Feedback.jsx',
  'pages/ChatPage.jsx',
  'pages/kyc/KycHome.jsx',
  'pages/services/ServicesList.jsx',
  'pages/services/AddService.jsx',
  'pages/services/EditService.jsx',
  'pages/services/ProfessionServices.jsx',
  'pages/services/ServicesDirectory.jsx',
  // TODO: fold in once their own PRs merge — ProfileSetup (#203),
  // ServiceForm + UpgradePlan (#207). Each ships its own brand guard meanwhile
  // (ProfileSetup.brand.test.js, dashboardBrand.test.js).
];

const GRAY = /\b(?:text|bg|border|ring|from|to|via|divide|placeholder|fill|stroke)-gray-\d/g;
const GRADIENT = /gradient-to-|linear-gradient\(|radial-gradient\(/g;
// amber/yellow/green/emerald/blue/indigo/violet/purple are not in Loop & Slot.
// `red-*` is allowed only for genuine error/danger states, so it is not guarded.
const OFF_PALETTE = /\b(?:text|bg|border|ring)-(?:amber|yellow|green|emerald|blue|indigo|violet|purple)-\d/g;

describe.each(PAGES)('%s brand compliance', (rel) => {
  const src = fs.readFileSync(path.resolve(__dirname, '..', rel), 'utf8');
  it('no cold gray-* classes', () => expect(src.match(GRAY)).toBeNull());
  it('no gradient utilities', () => expect(src.match(GRADIENT)).toBeNull());
  it('no off-palette color classes', () => expect(src.match(OFF_PALETTE)).toBeNull());
});

/**
 * adminPermissions.js — Canonical RBAC catalog for the admin platform.
 *
 * This file is the SINGLE SOURCE OF TRUTH for:
 *   - the full list of permission strings (resource.action)
 *   - the six seeded roles and the permissions each grants
 *   - the `roleGrants()` / `hasPermission()` helpers used by middleware
 *
 * The same role→permissions map is seeded into `admin_roles` (migration v2.4).
 * On login the resolved permission array is embedded in the admin JWT, so
 * middleware checks are stateless. A role's permission set therefore takes
 * effect on the staff member's NEXT login (acceptable for M1; a per-request
 * DB read with cache can replace this later without changing call sites).
 *
 * Pure module — no DB, no side effects — so it is trivially unit-testable.
 */

// ── Permission catalog ────────────────────────────────────────
// Grouped by domain for readability; the flat SET is what gets validated.
const PERMISSIONS = [
  // Operations
  'ops.view',
  // Users
  'users.view', 'users.edit', 'users.suspend', 'users.delete', 'users.impersonate',
  // Professionals / KYC
  'professionals.view', 'professionals.verify', 'professionals.feature',
  'kyc.view', 'kyc.decide',
  // Host documents (contracts/agreements an admin uploads against a host).
  // Deliberately NOT covered by kyc.view: a KYC reviewer needs the identity
  // documents the host submitted, which is not a reason to read the commercial
  // paperwork ops keeps on file. Separate need, separate grant.
  'documents.view', 'documents.manage',
  // Services
  'services.view', 'services.manage',
  // Bookings
  'bookings.view', 'bookings.edit', 'bookings.cancel',
  // Finance
  'finance.view', 'finance.refund', 'finance.manage',
  'payouts.view', 'payouts.approve', 'payouts.release', 'payouts.manual',
  'commission.view', 'commission.edit',
  // GST module (docs/gst-finance-module-architecture.md §4/§18). Tax settings
  // and "mark filed" are deliberately narrower than plain finance access.
  'gst.view', 'gst.manage', 'gst.reconcile',
  'gst.returns_prepare', 'gst.returns_file', 'gst.export', 'gst.settings',
  // Growth
  'plans.view', 'plans.manage',
  'coupons.view', 'coupons.manage',
  'referrals.view', 'referrals.manage',
  'analytics.view',
  // Engagement
  'notifications.view', 'email.manage', 'whatsapp.manage',
  'campaigns.view', 'campaigns.manage',
  // Sales CRM (leads pipeline, timeline, sends, sequences)
  'leads.view', 'leads.manage',
  'badges.manage', 'announcements.manage',
  // Content
  'cms.manage', 'seo.manage',
  // Support
  'support.view', 'support.assign', 'disputes.view', 'disputes.decide',
  'reviews.moderate',
  'feedback.view', 'feedback.manage',
  // System
  'settings.manage', 'branding.manage', 'flags.manage',
  'integrations.view', 'integrations.manage',
  'health.view', 'staff.manage', 'audit.view',
];

const PERMISSION_SET = new Set(PERMISSIONS);

// Wildcard — super admin holds every current and future permission.
const WILDCARD = '*';

// ── Roles ─────────────────────────────────────────────────────
// Each role's `permissions` array is validated at module load against
// PERMISSION_SET (except the wildcard) so a typo fails fast in tests.
const ROLES = {
  super: {
    key: 'super',
    name: 'Super Admin',
    description: 'Unrestricted access to every module and action.',
    is_system: true,
    permissions: [WILDCARD],
  },

  operations: {
    key: 'operations',
    name: 'Operations Admin',
    description: 'Runs day-to-day operations: users, professionals, bookings, support.',
    is_system: true,
    permissions: [
      'ops.view',
      'users.view', 'users.edit', 'users.suspend',
      'professionals.view', 'professionals.verify', 'professionals.feature',
      'kyc.view', 'kyc.decide',
      'documents.view', 'documents.manage',
      'services.view', 'services.manage',
      'bookings.view', 'bookings.edit', 'bookings.cancel',
      'finance.view',
      'payouts.view',
      'commission.view',
      'gst.view',
      'plans.view',
      'coupons.view',
      'analytics.view',
      'notifications.view',
      'leads.view', 'leads.manage',
      'badges.manage', 'announcements.manage',
      'support.view', 'support.assign', 'disputes.view', 'disputes.decide',
      'reviews.moderate',
      'feedback.view', 'feedback.manage',
      'health.view',
      'audit.view',
    ],
  },

  support: {
    key: 'support',
    name: 'Support Admin',
    description: 'Handles tickets, disputes, reviews and read-only customer context.',
    is_system: true,
    permissions: [
      'ops.view',
      'users.view',
      'professionals.view',
      'kyc.view',
      'bookings.view', 'bookings.cancel',
      'finance.view',
      'notifications.view',
      'support.view', 'support.assign', 'disputes.view', 'disputes.decide',
      'reviews.moderate',
      'feedback.view',
    ],
  },

  finance: {
    key: 'finance',
    name: 'Finance Admin',
    description: 'Owns money: transactions, refunds, payouts, commission.',
    is_system: true,
    permissions: [
      'ops.view',
      'bookings.view',
      'finance.view', 'finance.refund', 'finance.manage',
      'payouts.view', 'payouts.approve', 'payouts.release', 'payouts.manual',
      'commission.view', 'commission.edit',
      'gst.view', 'gst.manage', 'gst.reconcile',
      'gst.returns_prepare', 'gst.returns_file', 'gst.export', 'gst.settings',
      'plans.view',
      'coupons.view',
      'referrals.view', 'referrals.manage',
      'analytics.view',
      'audit.view',
    ],
  },

  marketing: {
    key: 'marketing',
    name: 'Marketing Admin',
    description: 'Owns plans, coupons, campaigns, content, SEO and branding.',
    is_system: true,
    permissions: [
      'ops.view',
      'plans.view', 'plans.manage',
      'coupons.view', 'coupons.manage',
      'referrals.view', 'referrals.manage',
      'analytics.view',
      'notifications.view', 'email.manage', 'whatsapp.manage',
      'campaigns.view', 'campaigns.manage',
      'leads.view', 'leads.manage',
      'badges.manage', 'announcements.manage',
      'cms.manage', 'seo.manage',
      'branding.manage',
    ],
  },

  developer: {
    key: 'developer',
    name: 'Developer Admin',
    description: 'Owns integrations, feature flags, platform health and audit.',
    is_system: true,
    permissions: [
      'ops.view',
      'notifications.view',
      'integrations.view', 'integrations.manage',
      'flags.manage',
      'health.view',
      'audit.view',
    ],
  },
};

// Fail fast on any typo in a role's permission list.
for (const role of Object.values(ROLES)) {
  for (const p of role.permissions) {
    if (p !== WILDCARD && !PERMISSION_SET.has(p)) {
      throw new Error(`adminPermissions: role "${role.key}" references unknown permission "${p}"`);
    }
  }
}

/** Return the permission array a role grants (['*'] for super). */
const roleGrants = (roleKey) => (ROLES[roleKey] ? ROLES[roleKey].permissions.slice() : []);

/**
 * Does a granted permission list satisfy a required permission?
 * `granted` is the array embedded in the JWT (may be ['*']).
 */
const hasPermission = (granted, required) => {
  if (!Array.isArray(granted)) return false;
  if (granted.includes(WILDCARD)) return true;
  if (!required) return true; // no specific permission required → any authenticated admin
  return granted.includes(required);
};

const isValidRole = (roleKey) => Object.prototype.hasOwnProperty.call(ROLES, roleKey);

module.exports = {
  PERMISSIONS,
  PERMISSION_SET,
  WILDCARD,
  ROLES,
  roleGrants,
  hasPermission,
  isValidRole,
};

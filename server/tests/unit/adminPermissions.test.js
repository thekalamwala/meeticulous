/**
 * tests/unit/adminPermissions.test.js
 * RBAC catalog integrity + the seeded role matrix. Pure module, no mocks.
 */
const {
  PERMISSIONS, ROLES, roleGrants, hasPermission, isValidRole, WILDCARD,
} = require('../../lib/adminPermissions');

describe('permission catalog', () => {
  test('has no duplicate permission strings', () => {
    expect(new Set(PERMISSIONS).size).toBe(PERMISSIONS.length);
  });

  test('every permission is a dot-namespaced resource.action', () => {
    for (const p of PERMISSIONS) expect(p).toMatch(/^[a-z]+\.[a-z_]+$/);
  });

  test('every non-super role grants only known permissions', () => {
    for (const role of Object.values(ROLES)) {
      if (role.key === 'super') continue;
      for (const p of role.permissions) expect(PERMISSIONS).toContain(p);
    }
  });
});

describe('hasPermission', () => {
  test('wildcard grants everything', () => {
    expect(hasPermission([WILDCARD], 'users.delete')).toBe(true);
    expect(hasPermission([WILDCARD], 'anything.future')).toBe(true);
  });
  test('exact match required otherwise', () => {
    expect(hasPermission(['users.view'], 'users.view')).toBe(true);
    expect(hasPermission(['users.view'], 'users.delete')).toBe(false);
  });
  test('empty / invalid grants deny', () => {
    expect(hasPermission([], 'users.view')).toBe(false);
    expect(hasPermission(null, 'users.view')).toBe(false);
  });
  test('no specific permission required → any authenticated admin passes', () => {
    expect(hasPermission(['ops.view'], undefined)).toBe(true);
  });
});

describe('roleGrants / isValidRole', () => {
  test('super is the only wildcard role', () => {
    expect(roleGrants('super')).toEqual([WILDCARD]);
    for (const key of ['operations', 'support', 'finance', 'marketing', 'developer']) {
      expect(roleGrants(key)).not.toContain(WILDCARD);
    }
  });
  test('unknown role grants nothing', () => {
    expect(roleGrants('ghost')).toEqual([]);
    expect(isValidRole('ghost')).toBe(false);
    expect(isValidRole('finance')).toBe(true);
  });
});

describe('role matrix — least privilege spot checks', () => {
  const can = (role, perm) => hasPermission(roleGrants(role), perm);

  test('finance owns money but not staff or user deletion', () => {
    expect(can('finance', 'payouts.approve')).toBe(true);
    expect(can('finance', 'finance.refund')).toBe(true);
    expect(can('finance', 'staff.manage')).toBe(false);
    expect(can('finance', 'users.delete')).toBe(false);
  });

  test('support can moderate + cancel but cannot touch money or delete users', () => {
    expect(can('support', 'reviews.moderate')).toBe(true);
    expect(can('support', 'bookings.cancel')).toBe(true);
    expect(can('support', 'payouts.approve')).toBe(false);
    expect(can('support', 'users.delete')).toBe(false);
  });

  test('operations runs ops but not refunds, CMS or staff management', () => {
    expect(can('operations', 'bookings.edit')).toBe(true);
    expect(can('operations', 'professionals.verify')).toBe(true);
    expect(can('operations', 'finance.refund')).toBe(false);
    expect(can('operations', 'cms.manage')).toBe(false);
    expect(can('operations', 'staff.manage')).toBe(false);
  });

  // v3.81 — host paperwork is a separate grant from KYC identity review.
  test('support reviews KYC but cannot read admin-uploaded host documents', () => {
    expect(can('support', 'kyc.view')).toBe(true);
    expect(can('support', 'documents.view')).toBe(false);
    expect(can('support', 'documents.manage')).toBe(false);
  });

  test('operations holds both KYC review and host documents', () => {
    expect(can('operations', 'kyc.view')).toBe(true);
    expect(can('operations', 'documents.view')).toBe(true);
    expect(can('operations', 'documents.manage')).toBe(true);
  });

  test('marketing owns growth + content, not operations data', () => {
    expect(can('marketing', 'cms.manage')).toBe(true);
    expect(can('marketing', 'coupons.manage')).toBe(true);
    expect(can('marketing', 'bookings.view')).toBe(false);
    expect(can('marketing', 'users.view')).toBe(false);
  });

  test('developer owns integrations/flags/health, not customer data', () => {
    expect(can('developer', 'flags.manage')).toBe(true);
    expect(can('developer', 'integrations.manage')).toBe(true);
    expect(can('developer', 'users.view')).toBe(false);
    expect(can('developer', 'finance.view')).toBe(false);
  });

  test('only super can manage staff and impersonate', () => {
    expect(can('super', 'staff.manage')).toBe(true);
    expect(can('super', 'users.impersonate')).toBe(true);
    for (const key of ['operations', 'support', 'finance', 'marketing', 'developer']) {
      expect(can(key, 'staff.manage')).toBe(false);
      expect(can(key, 'users.impersonate')).toBe(false);
    }
  });
});

describe('campaigns permissions (v2.6)', () => {
  const can = (role, perm) => hasPermission(roleGrants(role), perm);
  test('catalog includes campaigns.view / campaigns.manage', () => {
    expect(PERMISSIONS).toContain('campaigns.view');
    expect(PERMISSIONS).toContain('campaigns.manage');
  });
  test('marketing can manage campaigns; super via wildcard', () => {
    expect(can('marketing', 'campaigns.view')).toBe(true);
    expect(can('marketing', 'campaigns.manage')).toBe(true);
    expect(can('super', 'campaigns.manage')).toBe(true);
  });
  test('finance/support cannot send campaigns', () => {
    expect(can('finance', 'campaigns.manage')).toBe(false);
    expect(can('support', 'campaigns.manage')).toBe(false);
  });
});

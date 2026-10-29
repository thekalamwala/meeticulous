// server/tests/unit/adminPermissionsFeedback.test.js
const { PERMISSIONS, ROLES } = require('../../lib/adminPermissions');

test('feedback permissions exist', () => {
  expect(PERMISSIONS).toEqual(expect.arrayContaining(['feedback.view', 'feedback.manage']));
});

test('operations role can view + manage feedback; support can view', () => {
  expect(ROLES.operations.permissions).toEqual(expect.arrayContaining(['feedback.view', 'feedback.manage']));
  expect(ROLES.support.permissions).toContain('feedback.view');
});

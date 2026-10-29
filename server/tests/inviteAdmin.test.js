'use strict';
// inviteAdminController — error-code -> HTTP mapping and creator stamping.
jest.mock('../services/inviteService', () => ({
  listLinks: jest.fn(async () => [{ slug: 'social', label: 'S', unique_visits: 10, signups: 3 }]),
  createLink: jest.fn(async (b) => ({ ...b })),
  updateLink: jest.fn(async (s, b) => ({ slug: s, ...b })),
}));
const svc = require('../services/inviteService');
const c = require('../controllers/inviteAdminController');

const mkRes = () => {
  const r = { _s: 200 };
  r.status = (s) => { r._s = s; return r; };
  r.json = (b) => { r._b = b; return r; };
  return r;
};

describe('inviteAdminController', () => {
  test('list returns links with signups', async () => {
    const res = mkRes();
    await c.list({ query: {} }, res);
    expect(res._b[0].signups).toBe(3);
  });

  test('create stamps created_by from req.admin and returns 201', async () => {
    const res = mkRes();
    await c.create({ body: { slug: 'x', label: 'X' }, admin: { id: 'adm-1' } }, res);
    expect(res._s).toBe(201);
    expect(svc.createLink).toHaveBeenCalledWith(expect.objectContaining({ created_by: 'adm-1' }));
  });

  test('reserved slug -> 400', async () => {
    svc.createLink.mockRejectedValueOnce({ code: 'RESERVED' });
    const res = mkRes();
    await c.create({ body: { slug: 'admin', label: 'x' }, admin: {} }, res);
    expect(res._s).toBe(400);
  });

  test('duplicate slug -> 409', async () => {
    svc.createLink.mockRejectedValueOnce({ code: 'DUP' });
    const res = mkRes();
    await c.create({ body: { slug: 'social', label: 'x' }, admin: {} }, res);
    expect(res._s).toBe(409);
  });
});

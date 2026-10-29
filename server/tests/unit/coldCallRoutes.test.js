'use strict';
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: jest.fn() } }));
jest.mock('../../middleware/adminMiddleware', () => ({ requireAdmin: () => (req, _res, next) => { req.admin = { id: 'admin1' }; next(); } }));
jest.mock('../../services/crm/coldCallService', () => ({
  getQueue: jest.fn(async () => ({ fresh: [] })),
  importRows: jest.fn(async (a) => ({ created: a.rows.length, merged: 0, skipped: 0, listId: 'L' })),
  recordOutcome: jest.fn(async () => { throw Object.assign(new Error('callbackAt required'), { status: 400 }); }),
  remind: jest.fn(async () => ({ id: 'f' })),
}));
const express = require('express');
const request = require('supertest');
const svc = require('../../services/crm/coldCallService');
const { COLD_CALL_TEMPLATES } = require('../../services/crm/coldCallTemplates');

const app = express();
app.use(express.json());
app.use('/api/admin/crm', require('../../routes/adminCrmRoutes'));

test('queue + import + remind wire through with the admin as actor', async () => {
  await request(app).get('/api/admin/crm/cold-calls/queue?listId=L').expect(200);
  expect(svc.getQueue).toHaveBeenCalledWith('L');
  const imp = await request(app).post('/api/admin/crm/cold-calls/import')
    .send({ listName: 'Nagpur', rows: [{ phone: '8888705552', email: 'A@B.CO' }] }).expect(200);
  expect(imp.body.created).toBe(1);
  expect(svc.importRows.mock.calls[0][0]).toMatchObject({ listName: 'Nagpur', createdBy: 'admin1' });
  expect(svc.importRows.mock.calls[0][0].rows[0].email).toBe('a@b.co'); // controller cleans emails
  await request(app).post('/api/admin/crm/cold-calls/L1/remind').send({ at: '2026-10-07T05:30:00Z' }).expect(200);
  expect(svc.remind).toHaveBeenCalledWith('L1', { at: '2026-10-07T05:30:00Z' }, 'admin1');
});

test('service 400 surfaces as 400 with its message', async () => {
  const res = await request(app).post('/api/admin/crm/cold-calls/L1/outcome').send({ outcome: 'callback' }).expect(400);
  expect(res.body.message).toBe('callbackAt required');
});

test('templates: 6 message sets × email + whatsapp; WhatsApp seeds inactive', () => {
  expect(COLD_CALL_TEMPLATES).toHaveLength(15);
  const cats = ['cold_call_interested', 'cold_call_details', 'cold_call_callback', 'cold_call_nurture', 'cold_call_missed', 'cold_call_setup_help'];
  for (const c of cats) {
    expect(COLD_CALL_TEMPLATES.filter((t) => t.category === c).map((t) => t.channel).sort()).toEqual(['email', 'whatsapp']);
  }
  expect(COLD_CALL_TEMPLATES.filter((t) => t.channel === 'whatsapp').every((t) => t.is_active === false)).toBe(true);
  expect(COLD_CALL_TEMPLATES.filter((t) => t.channel === 'email').every((t) => t.subject && t.body)).toBe(true);
});

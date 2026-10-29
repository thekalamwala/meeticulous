'use strict';
// Bulk send/enrol: payloads are validated up front, sends are QUEUED (immediate
// false → gated worker), and each action routes to the right service.
jest.mock('../../config/supabase', () => ({ supabaseAdmin: {} }));
jest.mock('../../services/crm/leadService', () => ({
  changeStatus: jest.fn(), assignOwner: jest.fn(), addTag: jest.fn(), removeTag: jest.fn(), setDnc: jest.fn(),
}));
jest.mock('../../services/crm/messageService', () => ({ enqueue: jest.fn(() => Promise.resolve({})) }));
jest.mock('../../services/crm/sequenceService', () => ({ enroll: jest.fn(() => Promise.resolve({})) }));
jest.mock('../../services/crm/followUpService', () => ({}));
jest.mock('../../services/crm/attribution', () => ({}));
jest.mock('../../services/crm/timeline', () => ({}));

const messageService = require('../../services/crm/messageService');
const sequenceService = require('../../services/crm/sequenceService');
const c = require('../../controllers/adminCrmController');

const mkRes = () => {
  const res = { statusCode: 200, body: null };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
};
const req = (body) => ({ body, admin: { id: 'admin1' } });

beforeEach(() => jest.clearAllMocks());

test('whatsapp without templateKey → 400', async () => {
  const res = mkRes();
  await c.bulk(req({ ids: ['a'], action: 'whatsapp', payload: {} }), res);
  expect(res.statusCode).toBe(400);
  expect(messageService.enqueue).not.toHaveBeenCalled();
});

test('email without subject/html → 400', async () => {
  const res = mkRes();
  await c.bulk(req({ ids: ['a'], action: 'email', payload: { subject: 'hi' } }), res);
  expect(res.statusCode).toBe(400);
});

test('bulk whatsapp enqueues one queued message per lead', async () => {
  const res = mkRes();
  await c.bulk(req({ ids: ['a', 'b'], action: 'whatsapp', payload: { templateKey: 'Camp', params: ['{{first_name}}'] } }), res);
  expect(messageService.enqueue).toHaveBeenCalledTimes(2);
  expect(messageService.enqueue).toHaveBeenCalledWith(expect.objectContaining({ leadId: 'a', channel: 'whatsapp', templateKey: 'Camp', immediate: false }));
  expect(res.body).toEqual({ done: 2, total: 2 });
});

test('bulk enroll calls sequenceService.enroll per lead', async () => {
  const res = mkRes();
  await c.bulk(req({ ids: ['a', 'b'], action: 'enroll', payload: { sequenceId: 'seq1' } }), res);
  expect(sequenceService.enroll).toHaveBeenCalledTimes(2);
  expect(sequenceService.enroll).toHaveBeenCalledWith('seq1', 'a', 'admin1');
});

test('enroll without sequenceId → 400', async () => {
  const res = mkRes();
  await c.bulk(req({ ids: ['a'], action: 'enroll', payload: {} }), res);
  expect(res.statusCode).toBe(400);
  expect(sequenceService.enroll).not.toHaveBeenCalled();
});

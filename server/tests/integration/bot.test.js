/**
 * tests/integration/bot.test.js — /api/bot HTTP layer.
 * botService + escalationService are mocked; service logic is covered in unit tests.
 * Here we verify validation, the auth-branched escalation wiring, the anon contact-OTP
 * endpoints, and feedback delegation. All requests here are anonymous (no auth header →
 * optionalProtect leaves req.user unset), so escalation takes the "needs contact" path.
 */
jest.mock('../../services/botService', () => ({
  askBot: jest.fn(),
  askBotStream: jest.fn(),
  recordFeedback: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../services/bot/escalationService', () => ({
  buildReference: jest.fn(() => 'CHAT-ABCDEF'),
  recordAndNotify: jest.fn().mockResolvedValue({ reference: 'CHAT-ABCDEF', escalationId: 'e-1' }),
  sendContactOtp: jest.fn().mockResolvedValue({ ok: true }),
  verifyContactOtp: jest.fn().mockResolvedValue({ valid: true }),
  recordRating: jest.fn().mockResolvedValue({ ok: true }),
}));
// optionalProtect loads config/supabase at import; stub it as anonymous pass-through.
jest.mock('../../middleware/authMiddleware', () => ({
  optionalProtect: (req, res, next) => next(),
  protect: (req, res, next) => next(),
  requireHost: (req, res, next) => next(),
}));
// Limiters are real per-IP middleware; make them no-ops so the OTP tests don't 429.
jest.mock('../../middleware/security', () => ({
  botLimiter: (q, s, n) => n(), botGlobalLimiter: (q, s, n) => n(),
  otpLimiter: (q, s, n) => n(), otpContactLimiter: (q, s, n) => n(),
}));

const request = require('supertest');
const express = require('express');
const botService = require('../../services/botService');
const escalation = require('../../services/bot/escalationService');
const botRoutes = require('../../routes/botRoutes');

const app = express();
app.use(express.json());
app.use('/api/bot', botRoutes);

const UUID = '11111111-1111-4111-8111-111111111111';
const flush = () => new Promise((r) => setImmediate(r));

afterEach(() => jest.clearAllMocks());

describe('POST /api/bot/ask', () => {
  it('400s on an empty question', async () => {
    const res = await request(app).post('/api/bot/ask').send({ question: '   ' });
    expect(res.status).toBe(400);
    expect(botService.askBot).not.toHaveBeenCalled();
  });

  it('400s on an over-long question', async () => {
    const res = await request(app).post('/api/bot/ask').send({ question: 'x'.repeat(2001) });
    expect(res.status).toBe(400);
  });

  it('400s on a malformed conversationId', async () => {
    const res = await request(app).post('/api/bot/ask').send({ question: 'hi', conversationId: 'not-a-uuid' });
    expect(res.status).toBe(400);
  });

  it('returns a grounded answer and does NOT escalate', async () => {
    botService.askBot.mockResolvedValue({
      answer: 'Connect it from Dashboard → Calendar.',
      cited_sources: [{ source_file: 'docs/architecture.md', heading: 'Google Calendar' }],
      escalate: false, conversationId: UUID, messageId: UUID,
    });
    const res = await request(app).post('/api/bot/ask').send({ question: 'How do I connect Google Calendar?' });
    expect(res.status).toBe(200);
    expect(res.body.escalate).toBe(false);
    expect(res.body.needsContact).toBe(false);
    expect(escalation.recordAndNotify).not.toHaveBeenCalled();
  });

  it('anonymous escalation asks for contact and does NOT email yet', async () => {
    botService.askBot.mockResolvedValue({
      answer: 'handing to a human', cited_sources: [], escalate: true,
      escalateReason: 'sensitive', conversationId: UUID, messageId: UUID,
    });
    const res = await request(app).post('/api/bot/ask').send({ question: 'I want a refund' });
    expect(res.status).toBe(200);
    expect(res.body.escalate).toBe(true);
    expect(res.body.needsContact).toBe(true);
    expect(res.body.escalateReason).toBe('sensitive');
    expect(res.body.reference).toBeNull();
    await flush();
    expect(escalation.recordAndNotify).not.toHaveBeenCalled(); // deferred until contact verified
  });
});

describe('POST /api/bot/escalate/send-otp', () => {
  it('400s on a bad channel', async () => {
    const res = await request(app).post('/api/bot/escalate/send-otp').send({ channel: 'pigeon', contact: 'a@b.com' });
    expect(res.status).toBe(400);
  });
  it('400s on an invalid email', async () => {
    const res = await request(app).post('/api/bot/escalate/send-otp').send({ channel: 'email', contact: 'nope' });
    expect(res.status).toBe(400);
    expect(escalation.sendContactOtp).not.toHaveBeenCalled();
  });
  it('sends an OTP for a valid whatsapp number (normalized to country code)', async () => {
    const res = await request(app).post('/api/bot/escalate/send-otp').send({ channel: 'whatsapp', contact: '98765 43210' });
    expect(res.status).toBe(200);
    expect(escalation.sendContactOtp).toHaveBeenCalledWith(expect.objectContaining({ channel: 'whatsapp', contact: '919876543210' }));
  });
});

describe('POST /api/bot/escalate/verify-otp', () => {
  it('400s on a non-6-digit code', async () => {
    const res = await request(app).post('/api/bot/escalate/verify-otp').send({ channel: 'email', contact: 'a@b.com', otp: '12' });
    expect(res.status).toBe(400);
  });
  it('rejects a wrong code', async () => {
    escalation.verifyContactOtp.mockResolvedValueOnce({ valid: false, reason: 'mismatch' });
    const res = await request(app).post('/api/bot/escalate/verify-otp').send({ channel: 'email', contact: 'a@b.com', otp: '000000' });
    expect(res.status).toBe(400);
    expect(escalation.recordAndNotify).not.toHaveBeenCalled();
  });
  it('records + returns a reference on a valid code', async () => {
    const res = await request(app).post('/api/bot/escalate/verify-otp')
      .send({ channel: 'email', contact: 'a@b.com', otp: '123456', conversationId: UUID, visitorId: 'v-1' });
    expect(res.status).toBe(200);
    expect(res.body.reference).toBe('CHAT-ABCDEF');
    expect(res.body.escalationId).toBe('e-1');
    expect(escalation.recordAndNotify).toHaveBeenCalledWith(expect.objectContaining({
      identity: expect.objectContaining({ contact_channel: 'email', email: 'a@b.com', contact_verified: true }),
    }));
  });
});

describe('POST /api/bot/escalate/rating', () => {
  const EID = '22222222-2222-4222-8222-222222222222';
  it('400s on a non-uuid escalation id', async () => {
    const res = await request(app).post('/api/bot/escalate/rating').send({ escalationId: 'nope', rating: 5 });
    expect(res.status).toBe(400);
    expect(escalation.recordRating).not.toHaveBeenCalled();
  });
  it('400s when the service rejects the rating value', async () => {
    escalation.recordRating.mockResolvedValueOnce({ ok: false, reason: 'bad_rating' });
    const res = await request(app).post('/api/bot/escalate/rating').send({ escalationId: EID, rating: 9 });
    expect(res.status).toBe(400);
  });
  it('saves a valid rating', async () => {
    const res = await request(app).post('/api/bot/escalate/rating').send({ escalationId: EID, rating: 4 });
    expect(res.status).toBe(200);
    expect(escalation.recordRating).toHaveBeenCalledWith(EID, 4);
  });
});

describe('POST /api/bot/feedback', () => {
  it('400s on an invalid feedback value', async () => {
    const res = await request(app).post('/api/bot/feedback').send({ messageId: UUID, feedback: 'meh' });
    expect(res.status).toBe(400);
    expect(botService.recordFeedback).not.toHaveBeenCalled();
  });
  it('400s on a missing/invalid messageId', async () => {
    const res = await request(app).post('/api/bot/feedback').send({ messageId: 'nope', feedback: 'up' });
    expect(res.status).toBe(400);
  });
  it('persists a valid up-vote', async () => {
    const res = await request(app).post('/api/bot/feedback').send({ messageId: UUID, feedback: 'up' });
    expect(res.status).toBe(200);
    expect(botService.recordFeedback).toHaveBeenCalledWith(UUID, 'up');
  });
});

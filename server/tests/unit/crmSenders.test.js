'use strict';
// Sender persona resolution + enroll-by-name guard for the CRM sends redesign.

const state = { senders: [], seq: null };

jest.mock('../../config/supabase', () => ({
  supabaseAdmin: {
    from(table) {
      return {
        _t: table,
        select() { return this; },
        eq() { return this; },
        maybeSingle() { return Promise.resolve({ data: table === 'crm_sequences' ? state.seq : null, error: null }); },
        then(res) { // email_senders uses .select().eq() then await → resolve rows
          return Promise.resolve({ data: state.senders, error: null }).then(res);
        },
      };
    },
  },
}));

const senderRegistry = require('../../services/email/senderRegistry');

beforeEach(() => {
  state.senders = [{ sender_key: 'tithi', from_name: 'Tithi | Meeticulous', from_email: 'tithi@meeticulous.com', reply_to: 'tithi@meeticulous.com' }];
  state.seq = null;
  senderRegistry.clearCache();
});

describe('senderRegistry.byKey', () => {
  test('resolves a known active persona', async () => {
    expect(await senderRegistry.byKey('tithi')).toEqual({
      fromName: 'Tithi | Meeticulous', fromEmail: 'tithi@meeticulous.com', replyTo: 'tithi@meeticulous.com', provider: null,
    });
  });
  test('null for unknown key / empty key (→ caller uses global default)', async () => {
    expect(await senderRegistry.byKey('ghost')).toBeNull();
    expect(await senderRegistry.byKey(null)).toBeNull();
    expect(await senderRegistry.byKey('')).toBeNull();
  });
});

describe('sequenceService.enrollByName guard', () => {
  const sequenceService = require('../../services/crm/sequenceService');
  test('missing sequence → null (no crash)', async () => {
    state.seq = null;
    expect(await sequenceService.enrollByName('Churn-winback', 'lead1')).toBeNull();
  });
  test('inactive sequence → null (never enrols)', async () => {
    state.seq = { id: 's1', is_active: false };
    expect(await sequenceService.enrollByName('Churn-winback', 'lead1')).toBeNull();
  });
});

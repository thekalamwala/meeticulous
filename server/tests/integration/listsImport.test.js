// server/tests/integration/listsImport.test.js
const upserts = [];
jest.mock('../../config/supabase', () => require('./helpers').makeSbMock());
jest.mock('../../services/crm/leadService', () => ({
  upsertLead: (patch, opts) => { upserts.push({ patch, opts }); return Promise.resolve({ lead: { id: 'x' }, created: true }); },
}));
jest.mock('../../services/crm/listService', () => ({
  createList: () => Promise.resolve({ id: 'LID', name: 'X' }),
  getList: () => Promise.resolve({ id: 'LID' }),
  listLists: () => Promise.resolve([]),
}));
const c = require('../../controllers/adminCrmController');
const mockRes = () => { const r = {}; r.status = (s) => { r._s = s; return r; }; r.json = (j) => { r._j = j; return r; }; return r; };

test('importCommit into a list sets status=list, list_id, skipMetaLead', async () => {
  upserts.length = 0;
  const req = { body: { listId: 'LID', rows: [{ name: 'A', email: 'a@b.com', website: 'https://a.io', twitter: 'https://x.com/a' }] }, admin: { id: 'adm' } };
  await c.importCommit(req, mockRes());
  expect(upserts[0].patch.status).toBe('list');
  expect(upserts[0].patch.list_id).toBe('LID');
  expect(upserts[0].patch.website).toBe('https://a.io');
  expect(upserts[0].patch.attributes.twitter).toBe('https://x.com/a'); // unknown social stashed
  expect(upserts[0].opts.skipMetaLead).toBe(true);
});

describe('cleanEmail — server-side hygiene net', () => {
  test('strips scraper artefacts, repairs provider concat, drops placeholders/junk', () => {
    expect(c.cleanEmail('u003ehelp@skool.com')).toBe('help@skool.com');   // leaked >
    expect(c.cleanEmail('x@gmail.comviews')).toBe('x@gmail.com');          // provider concat bug
    expect(c.cleanEmail('you@company.com')).toBe('');                      // placeholder
    expect(c.cleanEmail(' Good@Domain.IO ')).toBe('good@domain.io');       // trim + lowercase
    expect(c.cleanEmail('no@atsign')).toBe('');                            // no TLD
  });
});

test('importCommit skips a row whose email is junk and has no phone', async () => {
  upserts.length = 0;
  const req = { body: { listId: 'LID', rows: [
    { name: 'Clean', email: 'good@domain.io' },
    { name: 'Junk', email: 'u003e@neweraofcoding.bsky.social' },  // strips to '@…' → invalid, no phone → skipped
    { name: 'JunkKept', email: 'you@company.com', phone: '919999999999' }, // email blanked but phone keeps it
  ] }, admin: { id: 'adm' } };
  const res = mockRes();
  await c.importCommit(req, res);
  const emails = upserts.map((u) => u.patch.email);
  expect(emails).toContain('good@domain.io');   // clean row imported
  expect(upserts).toHaveLength(2);               // junk-no-phone row skipped; phone row kept
  expect(res._j.skipped).toBe(1);
  const kept = upserts.find((u) => u.patch.name === 'JunkKept');
  expect(kept.patch.email).toBe('');            // junk email blanked, imported via phone identity
});

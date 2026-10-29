const mockFrom = jest.fn();
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: (...a) => mockFrom(...a) } }));
jest.mock('../../utils/httpCache', () => ({ setPublicCache: jest.fn() }));
jest.mock('../../utils/sendEmail', () => jest.fn());

const { adminUpdate } = require('../../controllers/categoryController');
const res = () => { const r = {}; r.status = jest.fn(() => r); r.json = jest.fn(() => r); return r; };
beforeEach(() => jest.clearAllMocks());

test('adminUpdate persists allow_subcategory_suggestions', async () => {
  let applied = null;
  const c = {
    update: jest.fn((row) => { applied = row; return c; }),
    eq: jest.fn(() => c), select: jest.fn(() => c),
    single: jest.fn().mockResolvedValue({ data: { id: 'c1', allow_subcategory_suggestions: true }, error: null }),
  };
  mockFrom.mockReturnValue(c);
  const r = res();
  await adminUpdate({ params: { id: 'c1' }, body: { allow_subcategory_suggestions: true } }, r);
  expect(applied).toMatchObject({ allow_subcategory_suggestions: true });
});

'use strict';

// Self-contained factory (jest hoists jest.mock above imports; it may not close
// over outer variables). Grab the upsert mock back off the mocked module below.
jest.mock('../../config/supabase', () => {
  const upsert = jest.fn();
  return { supabaseAdmin: { from: jest.fn(() => ({ upsert })) } };
});

const { recordFeatureInterest, FEATURES } = require('../../controllers/featureInterestController');
const { supabaseAdmin } = require('../../config/supabase');
const upsert = supabaseAdmin.from().upsert; // same closure fn across from() calls

const mockRes = () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

beforeEach(() => {
  jest.clearAllMocks();
  upsert.mockResolvedValue({ error: null });
});

describe('recordFeatureInterest', () => {
  it('rejects an unknown feature with 400', async () => {
    const res = mockRes();
    await recordFeatureInterest({ user: { id: 'h1' }, body: { feature: 'bananas' } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(supabaseAdmin.from).not.toHaveBeenCalled();
  });

  it('records interest for a known feature', async () => {
    const res = mockRes();
    await recordFeatureInterest({ user: { id: 'h1' }, body: { feature: 'membership' } }, res);
    expect(supabaseAdmin.from).toHaveBeenCalledWith('feature_interest');
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ host_id: 'h1', feature: 'membership' }),
      expect.objectContaining({ onConflict: 'host_id,feature' }),
    );
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
  });

  it('is schema-fallback safe: a missing table still returns ok (never 500)', async () => {
    upsert.mockResolvedValueOnce({ error: { message: 'relation "feature_interest" does not exist' } });
    const res = mockRes();
    await recordFeatureInterest({ user: { id: 'h1' }, body: { feature: 'coupons' } }, res);
    expect(res.status).not.toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
  });

  it('does NOT swallow a genuine error (column drift) as success', async () => {
    upsert.mockResolvedValueOnce({ error: { message: 'column "feature" does not exist' } });
    const res = mockRes();
    await recordFeatureInterest({ user: { id: 'h1' }, body: { feature: 'courses' } }, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it('exposes the three gated features', () => {
    expect([...FEATURES].sort()).toEqual(['coupons', 'courses', 'membership']);
  });
});

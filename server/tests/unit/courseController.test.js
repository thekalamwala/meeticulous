/**
 * tests/unit/courseController.test.js
 * Covers the two load-bearing rules of the video-courses feature:
 *   1. Pro gate — a free-plan host cannot create a course (server-enforced).
 *   2. Purchase grants access — only the host or a PAID buyer gets lesson
 *      video_urls via /:id/content; everyone else is 403.
 */
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: jest.fn(), rpc: jest.fn() } }));
jest.mock('../../services/planService', () => ({
  isFreeSlug: jest.fn(),
  resolveVendorPlan: (p) => p.plan,
}));
jest.mock('../../services/platformConfig', () => ({ getConfig: jest.fn().mockResolvedValue({ platformFee: 10, gstRate: 0.18 }) }));
jest.mock('../../services/razorpayConfig', () => ({}));
jest.mock('../../utils/logger', () => ({ auditLog: jest.fn(), securityLog: jest.fn() }));

const { supabaseAdmin } = require('../../config/supabase');
const planService = require('../../services/planService');
const { createCourse, getCourseContent } = require('../../controllers/courseController');

const res = () => {
  const r = {};
  r.status = jest.fn().mockReturnValue(r);
  r.json = jest.fn().mockReturnValue(r);
  return r;
};
const req = (body = {}, params = {}, user = { id: 'host-1' }) => ({ body, params, user });

beforeEach(() => jest.clearAllMocks());

describe('createCourse — Pro gate', () => {
  test('free-plan host is blocked with 403 + upgrade_required', async () => {
    // callerIsFreePlan → profiles.select().eq().single() → { plan:'free' }
    supabaseAdmin.from.mockReturnValue({
      select: () => ({ eq: () => ({ single: () => ({ data: { plan: 'free' } }) }) }),
    });
    planService.isFreeSlug.mockReturnValue(true);

    const r = res();
    await createCourse(req({ title: 'X', price: 100 }), r);

    expect(r.status).toHaveBeenCalledWith(403);
    expect(r.json).toHaveBeenCalledWith(expect.objectContaining({ upgrade_required: true }));
  });

  test('paid-plan host passes the gate and inserts the course', async () => {
    planService.isFreeSlug.mockReturnValue(false);
    let inserted;
    supabaseAdmin.from.mockImplementation((table) => {
      if (table === 'profiles') return { select: () => ({ eq: () => ({ single: () => ({ data: { plan: 'premium' } }) }) }) };
      if (table === 'courses') return {
        select: () => ({ eq: () => ({ like: () => ({ data: [] }) }) }), // uniqueHostSlug
        insert: (p) => { inserted = p; return { select: () => ({ single: () => ({ data: { id: 'c1', ...p }, error: null }) }) }; },
      };
      if (table === 'course_lessons') return { delete: () => ({ eq: () => ({}) }), insert: () => ({}) };
      return {};
    });

    const r = res();
    await createCourse(req({ title: 'My Course', price: 100, lessons: [{ title: 'L1', video_url: 'https://v/1' }] }), r);

    expect(r.status).toHaveBeenCalledWith(201);
    expect(inserted).toMatchObject({ host_id: 'host-1', title: 'My Course', price: 100 });
  });
});

describe('getCourseContent — purchase grants access', () => {
  const wireAccess = ({ hostId, purchase }) => {
    supabaseAdmin.from.mockImplementation((table) => {
      if (table === 'courses') return {
        select: () => ({
          eq: () => ({
            maybeSingle: () => ({ data: { host_id: hostId } }),          // hasAccess lookup
            single: () => ({ data: { id: 'c1', title: 'C', course_lessons: [{ id: 'l1', title: 'L1', video_url: 'https://v/1', sort_order: 0 }] }, error: null }),
          }),
        }),
      };
      if (table === 'course_purchases') return {
        select: () => ({ eq: () => ({ eq: () => ({ eq: () => ({ limit: () => ({ maybeSingle: () => ({ data: purchase }) }) }) }) }) }),
      };
      return {};
    });
  };

  test('non-buyer gets 403 (no video_url leaked)', async () => {
    wireAccess({ hostId: 'someone-else', purchase: null });
    const r = res();
    await getCourseContent(req({}, { id: 'c1' }, { id: 'guest-9' }), r);
    expect(r.status).toHaveBeenCalledWith(403);
  });

  test('paid buyer gets the lessons with video_url', async () => {
    wireAccess({ hostId: 'someone-else', purchase: { id: 'p1' } });
    const r = res();
    await getCourseContent(req({}, { id: 'c1' }, { id: 'buyer-7' }), r);
    expect(r.status).not.toHaveBeenCalledWith(403);
    const payload = r.json.mock.calls[0][0];
    expect(payload.course_lessons[0].video_url).toBe('https://v/1');
  });

  test('the host always has access to their own course', async () => {
    wireAccess({ hostId: 'host-1', purchase: null });
    const r = res();
    await getCourseContent(req({}, { id: 'c1' }, { id: 'host-1' }), r);
    expect(r.status).not.toHaveBeenCalledWith(403);
    expect(r.json.mock.calls[0][0].course_lessons[0].video_url).toBe('https://v/1');
  });
});

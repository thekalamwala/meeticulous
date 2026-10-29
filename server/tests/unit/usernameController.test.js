jest.mock('../../services/usernameService', () => ({
  changeUsername: jest.fn(),
  usernameExists: jest.fn(),
  resolve: jest.fn(),
  createInitialUsername: jest.fn(),
  recordInitialUsername: jest.fn(),
}));
jest.mock('../../utils/httpError', () => ({
  safeError: (res) => res.status(500).json({ message: 'error' }),
}));

const usernameService = require('../../services/usernameService');
const { checkUsername, resolveUsername, changeUsername } = require('../../controllers/usernameController');

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('usernameController.changeUsername', () => {
  beforeEach(() => jest.clearAllMocks());

  it('401 without an authenticated user', async () => {
    const res = mockRes();
    await changeUsername({ body: { username: 'cool-name-x1' } }, res);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(usernameService.changeUsername).not.toHaveBeenCalled();
  });

  it('400 on bad format', async () => {
    const res = mockRes();
    await changeUsername({ user: { id: 'u1' }, body: { username: 'Bad__Name!!' } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(usernameService.changeUsername).not.toHaveBeenCalled();
  });

  it('400 on reserved word', async () => {
    const res = mockRes();
    await changeUsername({ user: { id: 'u1' }, body: { username: 'dashboard' } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(usernameService.changeUsername).not.toHaveBeenCalled();
  });

  it('403 when WhatsApp is unverified', async () => {
    usernameService.changeUsername.mockResolvedValue({ ok: false, reason: 'whatsapp_unverified' });
    const res = mockRes();
    await changeUsername({ user: { id: 'u1' }, body: { username: 'new-handle-22' } }, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('409 when taken', async () => {
    usernameService.changeUsername.mockResolvedValue({ ok: false, reason: 'taken' });
    const res = mockRes();
    await changeUsername({ user: { id: 'u1' }, body: { username: 'new-handle-22' } }, res);
    expect(res.status).toHaveBeenCalledWith(409);
  });

  it('429 when over the yearly limit', async () => {
    usernameService.changeUsername.mockResolvedValue({ ok: false, reason: 'limit_reached' });
    const res = mockRes();
    await changeUsername({ user: { id: 'u1' }, body: { username: 'new-handle-22' } }, res);
    expect(res.status).toHaveBeenCalledWith(429);
  });

  it('429 with next_eligible when too soon', async () => {
    usernameService.changeUsername.mockResolvedValue({
      ok: false, reason: 'too_soon', next_eligible: '2026-12-18T00:00:00Z',
    });
    const res = mockRes();
    await changeUsername({ user: { id: 'u1' }, body: { username: 'new-handle-22' } }, res);
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ next_eligible: '2026-12-18T00:00:00Z' }));
  });

  it('200 on success', async () => {
    usernameService.changeUsername.mockResolvedValue({ ok: true, username: 'new-handle-22' });
    const res = mockRes();
    await changeUsername({ user: { id: 'u1' }, body: { username: 'new-handle-22' } }, res);
    expect(res.json).toHaveBeenCalledWith({ success: true, username: 'new-handle-22' });
    expect(usernameService.changeUsername).toHaveBeenCalledWith('u1', 'new-handle-22');
  });
});

describe('usernameController.checkUsername', () => {
  beforeEach(() => jest.clearAllMocks());

  it('reports unavailable for reserved/invalid', async () => {
    const res = mockRes();
    await checkUsername({ params: { slug: 'admin' } }, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ available: false }));
  });

  it('reports available when not taken', async () => {
    usernameService.usernameExists.mockResolvedValue(false);
    const res = mockRes();
    await checkUsername({ params: { slug: 'fresh-handle-9' } }, res);
    expect(res.json).toHaveBeenCalledWith({ available: true, reason: null });
  });

  it('reports taken', async () => {
    usernameService.usernameExists.mockResolvedValue(true);
    const res = mockRes();
    await checkUsername({ params: { slug: 'fresh-handle-9' } }, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ available: false }));
  });
});

describe('usernameController.resolveUsername', () => {
  beforeEach(() => jest.clearAllMocks());

  it('404 when never used', async () => {
    usernameService.resolve.mockResolvedValue(null);
    const res = mockRes();
    await resolveUsername({ params: { slug: 'ghost' } }, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns canonical + isCurrent', async () => {
    usernameService.resolve.mockResolvedValue({ userId: 'u1', currentUsername: 'now-name-7', isCurrent: false });
    const res = mockRes();
    await resolveUsername({ params: { slug: 'old-name-3' } }, res);
    expect(res.json).toHaveBeenCalledWith({ found: true, current: 'now-name-7', isCurrent: false });
  });
});

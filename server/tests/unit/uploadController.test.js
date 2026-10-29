/**
 * tests/unit/uploadController.test.js
 * Tests for uploadProductFile: size cap, magic-byte allowlist,
 * happy-path upload + returned shape.
 */
jest.mock('../../config/supabase', () => {
  const uploadMock = jest.fn().mockResolvedValue({ data: { path: 'x' }, error: null });
  const getPublicUrlMock = jest.fn().mockReturnValue({
    data: { publicUrl: 'https://cdn.example/products/host-1/123_abc.pdf' },
  });
  const storageFrom = jest.fn().mockReturnValue({
    upload: uploadMock,
    getPublicUrl: getPublicUrlMock,
  });
  const profilesBuilder = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: { role: 'host' } }),
  };
  return {
    supabaseAdmin: {
      from: jest.fn().mockReturnValue(profilesBuilder),
      storage: { from: storageFrom },
      __uploadMock: uploadMock,
      __storageFrom: storageFrom,
    },
  };
});

const { supabaseAdmin } = require('../../config/supabase');
const { uploadProductFile } = require('../../controllers/uploadController');

const res = () => {
  const r = {};
  r.status = jest.fn().mockReturnValue(r);
  r.json = jest.fn().mockReturnValue(r);
  return r;
};

// Minimal valid magic-byte buffers, padded to >= 16 bytes.
const pad = (head) => Buffer.concat([Buffer.from(head), Buffer.alloc(16)]);
const PDF_BUF = pad([0x25, 0x50, 0x44, 0x46]);             // %PDF
const ZIP_BUF = pad([0x50, 0x4b, 0x03, 0x04]);             // PK\x03\x04 (docx/xlsx/pptx/zip/epub)
const PNG_BUF = pad([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const TEXT_BUF = Buffer.from('this is plainly not a binary file at all');

const req = (file, user = { id: 'host-1' }) => ({ file, user, admin: null, query: {} });

beforeEach(() => {
  jest.clearAllMocks();
  supabaseAdmin.from.mockReturnValue({
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: { role: 'host' } }),
  });
});

describe('uploadProductFile', () => {
  test('400 when no file provided', async () => {
    const r = res();
    await uploadProductFile({ user: { id: 'host-1' }, query: {} }, r);
    expect(r.status).toHaveBeenCalledWith(400);
  });

  test('400 when file exceeds 2 MB', async () => {
    const big = Buffer.concat([PDF_BUF, Buffer.alloc(2 * 1024 * 1024 + 1)]);
    const r = res();
    await uploadProductFile(req({ size: big.length, buffer: big, originalname: 'big.pdf' }), r);
    expect(r.status).toHaveBeenCalledWith(400);
    expect(r.json.mock.calls[0][0].message).toMatch(/2\s*MB/i);
  });

  test('400 when extension is allowed but magic bytes do not match (spoofed .pdf)', async () => {
    const r = res();
    await uploadProductFile(
      req({ size: TEXT_BUF.length, buffer: TEXT_BUF, originalname: 'fake.pdf' }),
      r,
    );
    expect(r.status).toHaveBeenCalledWith(400);
    expect(r.json.mock.calls[0][0].message).toMatch(/not a (valid|supported)/i);
  });

  test('400 when extension is not on the allowlist (.exe)', async () => {
    const r = res();
    await uploadProductFile(
      req({ size: PDF_BUF.length, buffer: PDF_BUF, originalname: 'evil.exe' }),
      r,
    );
    expect(r.status).toHaveBeenCalledWith(400);
  });

  test('403 when uploader is not a host', async () => {
    supabaseAdmin.from.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: { role: 'guest' } }),
    });
    const r = res();
    await uploadProductFile(
      req({ size: PDF_BUF.length, buffer: PDF_BUF, originalname: 'guide.pdf' }),
      r,
    );
    expect(r.status).toHaveBeenCalledWith(403);
  });

  test('uploads a valid PDF and returns { url, name, size }', async () => {
    const r = res();
    await uploadProductFile(
      req({ size: PDF_BUF.length, buffer: PDF_BUF, originalname: 'My Guide.pdf' }),
      r,
    );
    expect(supabaseAdmin.storage.from).toHaveBeenCalledWith('products');
    const out = r.json.mock.calls[0][0];
    expect(out.url).toMatch(/^https:\/\//);
    expect(out.name).toBe('My Guide.pdf');
    expect(out.size).toBe(PDF_BUF.length);
    // Path is products/{host_id}/{ts}_{rand}.pdf
    const uploadedPath = supabaseAdmin.__uploadMock.mock.calls[0][0];
    expect(uploadedPath).toMatch(/^products\/host-1\/\d+_[a-z0-9]+\.pdf$/);
  });

  test('accepts a docx (PK zip magic) by .docx extension', async () => {
    const r = res();
    await uploadProductFile(
      req({ size: ZIP_BUF.length, buffer: ZIP_BUF, originalname: 'slides.docx' }),
      r,
    );
    const out = r.json.mock.calls[0][0];
    expect(out.url).toMatch(/^https:\/\//);
    const uploadedPath = supabaseAdmin.__uploadMock.mock.calls[0][0];
    expect(uploadedPath).toMatch(/\.docx$/);
  });

  test('accepts a png', async () => {
    const r = res();
    await uploadProductFile(
      req({ size: PNG_BUF.length, buffer: PNG_BUF, originalname: 'cover.png' }),
      r,
    );
    expect(r.json.mock.calls[0][0].url).toMatch(/^https:\/\//);
  });

  test('admin bypass: req.admin skips role DB check and succeeds with { url, name, size }', async () => {
    // Arrange: admin request — req.user is null/undefined, req.admin is set.
    // The controller's `if (!req.admin)` guard means supabaseAdmin.from should
    // NOT be called for the role lookup. The storage mock is the default happy-path.
    const adminReq = {
      file: { size: PDF_BUF.length, buffer: PDF_BUF, originalname: 'admin-guide.pdf' },
      user: undefined,
      admin: { id: 'admin-1' },
      query: {},
    };
    const r = res();

    await uploadProductFile(adminReq, r);

    // Must NOT have called supabaseAdmin.from (role check bypassed).
    expect(supabaseAdmin.from).not.toHaveBeenCalled();
    // Must NOT 403.
    expect(r.status).not.toHaveBeenCalledWith(403);
    // Must return { url, name, size }.
    const out = r.json.mock.calls[0][0];
    expect(out.url).toMatch(/^https:\/\//);
    expect(out.name).toBe('admin-guide.pdf');
    expect(out.size).toBe(PDF_BUF.length);
    // Storage path must use admin-1 as the host segment.
    const uploadedPath = supabaseAdmin.__uploadMock.mock.calls[0][0];
    expect(uploadedPath).toMatch(/^products\/admin-1\/\d+_[a-z0-9]+\.pdf$/);
  });

  test('storage upload error returns 500 with clean message (no crash)', async () => {
    // Arrange: make the 'products' bucket upload fail, simulating a missing
    // bucket (pre-migration scenario). The handler must call safeError → 500
    // without throwing.
    supabaseAdmin.__uploadMock.mockResolvedValueOnce({
      data: null,
      error: { message: 'Bucket not found' },
    });

    const r = res();
    await uploadProductFile(
      req({ size: PDF_BUF.length, buffer: PDF_BUF, originalname: 'guide.pdf' }),
      r,
    );

    expect(r.status).toHaveBeenCalledWith(500);
    expect(r.json.mock.calls[0][0].message).toMatch(/file upload failed/i);
    // Confirm res.json was called exactly once (no double-response crash).
    expect(r.json).toHaveBeenCalledTimes(1);
  });
});
